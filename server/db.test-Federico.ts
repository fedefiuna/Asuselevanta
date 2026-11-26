import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createTestSchema, TEST_DB_URL, type TestSchema } from './testSupport.ts';
import type { AsuncionDb } from './db.ts';

const base = {
  category: 'Bache' as const,
  description: 'Bache profundo',
  photoUrl: 'https://example.com/a.jpg',
  location: { lat: -25.289, lng: -57.618, address: 'Av. España 450', barrio: 'Las Mercedes' },
  citizenName: 'Carlos Benítez',
  severity: 'Alta' as const
};

describe('Postgres (esquema temporal)', { skip: TEST_DB_URL ? false : 'define TEST_DATABASE_URL para correr estos tests' }, () => {
  let ts: TestSchema;
  let db: AsuncionDb;

  before(async () => {
    ts = await createTestSchema();
    db = await ts.open();
  });
  after(async () => {
    await ts.dispose();
  });

  test('inicializa: siembra el admin Nivel 2 y los reportes de ejemplo con fechas válidas', async () => {
    const root = (await db.listAdminAccounts()).find((a) => a.id === '1000001');
    assert.ok(root);
    assert.equal(root.level, 2);

    const reports = await db.listReports();
    assert.ok(reports.length >= 7);
    for (const r of reports) {
      assert.match(r.createdAt, /^\d{4}-\d{2}-\d{2}T/);
      assert.match(r.updatedAt, /^\d{4}-\d{2}-\d{2}T/);
      assert.match(r.reportDate || '', /^\d{4}-\d{2}-\d{2}$/);
      assert.match(r.reportMonth || '', /^\d{4}-\d{2}$/);
      assert.ok(Array.isArray(r.statusHistory) && r.statusHistory.length >= 1);
      assert.equal(typeof r.location.lat, 'number');
    }
  });

  test('abrir de nuevo no duplica los datos de ejemplo ni al admin', async () => {
    const before = (await db.listReports()).length;
    const again = await ts.open();
    assert.equal((await again.listReports()).length, before);
    assert.equal((await again.listAdminAccounts()).filter((a) => a.id === '1000001').length, 1);
  });

  test('persiste ciudadanos, perfiles, reportes y filtros por fecha/mes tras reabrir', async () => {
    const cit = await db.registerCitizen({ cedula: '4.567.890', fullName: 'Carlos Benítez', phone: '0981111222' });
    assert.equal(cit.success, true);
    assert.equal(cit.citizen?.id, '4567890');
    assert.ok(cit.token);

    const loginRoot = await db.loginAdmin('1000001', 'admin123');
    assert.equal(loginRoot.success, true);
    assert.ok(loginRoot.admin);

    const l1 = await db.createAdminAccount(
      { ci: '3216549', employeeNumber: 'EMP-104', fullName: 'Lic. Valeria Gómez', level: 1, password: 'secret' },
      loginRoot.admin
    );
    assert.equal(l1.success, true);

    const rNov = await db.createReport({ ...base, citizenId: '4567890', createdAt: '2026-11-13T14:00:00.000Z' });
    const rOct = await db.createReport({
      ...base,
      category: 'Alcantarilla sin tapa',
      description: 'Boca abierta en Sajonia',
      location: { lat: -25.2825, lng: -57.6412, address: 'Av. Carlos A. López', barrio: 'Sajonia' },
      citizenId: '4567890',
      severity: 'Crítica',
      createdAt: '2026-10-08T16:00:00.000Z'
    });

    const updated = await db.updateReportStatus(rOct.id, 'Solucionado', 'Reparado por cuadrilla', 'Ing. Mario Arzamendia');
    assert.equal(updated?.status, 'Solucionado');
    assert.equal(updated?.statusHistory?.length, 2);
    assert.ok(updated?.resolvedAt);

    const db2 = await ts.open(); // conexión nueva: lo guardado está realmente en la base
    const persisted = await db2.getCitizenBySession(cit.token);
    assert.equal(persisted?.id, '4567890');
    assert.equal(persisted?.fullName, 'Carlos Benítez');

    const loginL1 = await db2.loginAdmin('3216549', 'secret');
    assert.equal(loginL1.success, true);
    assert.equal(loginL1.admin?.level, 1);
    assert.equal((await db2.loginAdmin('3216549', 'incorrecta')).success, false);

    const nov13 = await db2.listReports({ date: '2026-11-13' });
    assert.ok(nov13.some((r) => r.id === rNov.id));
    assert.ok(!nov13.some((r) => r.id === rOct.id));

    const oct = await db2.listReports({ month: '2026-10' });
    assert.ok(oct.some((r) => r.id === rOct.id));
    assert.ok(!oct.some((r) => r.id === rNov.id));
  });

  test('IDs de reporte: sin repetirse con 12 reportes simultáneos y sin chocar con los de ejemplo', async () => {
    const created = await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        db.createReport({ ...base, description: `Simultáneo ${i}`, createdAt: '2026-11-14T10:00:00.000Z' })
      )
    );
    const ids = created.map((r) => r.id);
    assert.equal(new Set(ids).size, 12);
    for (const id of ids) assert.match(id, /^ASU-2026-\d{3,}$/);
    const seqs = ids.map((id) => Number(id.split('-')[2])).sort((a, b) => a - b);
    for (let i = 1; i < seqs.length; i++) assert.equal(seqs[i], seqs[i - 1] + 1, 'números consecutivos, sin saltos');
  });

  test('el contador se autocorrige si hay reportes con un número mayor al guardado', async () => {
    const maxSeq = (await db.listReports())
      .filter((x) => x.id.startsWith('ASU-2026-'))
      .reduce((m, x) => Math.max(m, Number(x.id.split('-')[2])), 0);
    await ts.query(`update {s}.report_counters set last_seq = 1 where year = '2026'`); // lo desincronizamos a propósito
    const r = await db.createReport({ ...base, description: 'Tras desincronizar', createdAt: '2026-11-15T10:00:00.000Z' });
    assert.equal(r.id, `ASU-2026-${String(maxSeq + 1).padStart(3, '0')}`);
  });

  test('sesiones: una vencida deja de valer y purgeExpiredSessions la elimina', async () => {
    const cit = await db.registerCitizen({ cedula: '1234567', fullName: 'Ana Gómez' });
    assert.ok(cit.token);
    assert.equal((await db.getCitizenBySession(cit.token))?.id, '1234567');

    await ts.query(`update {s}.sessions set expires_at = now() - interval '1 day' where token = $1`, [cit.token]);
    assert.equal(await db.getCitizenBySession(cit.token), null);

    const cit2 = await db.registerCitizen({ cedula: '7654321', fullName: 'Luis Díaz' });
    await ts.query(`update {s}.sessions set expires_at = now() - interval '1 day' where token = $1`, [cit2.token]);
    assert.ok((await db.purgeExpiredSessions()) >= 1);
    const left = await ts.query(`select 1 from {s}.sessions where token = $1`, [cit2.token]);
    assert.equal(left.rowCount, 0);
  });

  test('cerrar sesión invalida el token', async () => {
    const cit = await db.registerCitizen({ cedula: '2223334', fullName: 'Rosa Vera' });
    await db.deleteSession(cit.token);
    assert.equal(await db.getCitizenBySession(cit.token), null);
  });

  test('búsqueda: el nombre del ciudadano solo cuenta con searchCitizen; % y _ son texto literal', async () => {
    await db.createReport({ ...base, citizenName: 'Zacarías Quintanilla', description: 'Unico_marcador 100%' });
    assert.equal((await db.listReports({ q: 'Quintanilla' })).length, 0);
    assert.equal((await db.listReports({ q: 'Quintanilla', searchCitizen: true })).length, 1);
    assert.equal((await db.listReports({ q: '100%' })).length, 1);
    assert.equal((await db.listReports({ q: '%' })).length, 1, '% no es comodín: solo el que lo contiene');
    assert.equal((await db.listReports({ q: 'Unico_marcador' })).length, 1);
    assert.equal((await db.listReports({ q: 'UnicoXmarcador' })).length, 0, '_ no es comodín');
  });

  test('actualización en lote y eliminación (borra también su historial)', async () => {
    const a = await db.createReport({ ...base, description: 'Lote A' });
    const b = await db.createReport({ ...base, description: 'Lote B' });
    const n = await db.bulkUpdateReportsStatus([a.id, b.id, 'ASU-0000-999'], 'Solucionado', 'Hecho', 'Cuadrilla');
    assert.equal(n, 2, 'ignora IDs inexistentes');
    assert.equal((await db.getReportById(a.id))?.status, 'Solucionado');
    assert.equal((await db.getReportById(b.id))?.statusHistory?.length, 2);

    assert.equal(await db.deleteReport(a.id), true);
    assert.equal(await db.getReportById(a.id), null);
    const orphan = await ts.query(`select 1 from {s}.report_status_history where report_id = $1`, [a.id]);
    assert.equal(orphan.rowCount, 0);
    assert.equal(await db.deleteReport(a.id), false);
  });

  test('perfiles admin: solo Nivel 2 crea/elimina; no se borra al principal ni a uno mismo; sin duplicados', async () => {
    const root = (await db.loginAdmin('1000001', 'admin123')).admin!;
    const input = { ci: '5555555', employeeNumber: 'EMP-555', fullName: 'Ing. Pedro Ruiz', level: 1 as const, password: 'clave123' };

    assert.equal((await db.createAdminAccount(input, null)).success, false);
    const created = await db.createAdminAccount(input, root);
    assert.equal(created.success, true);
    assert.equal((await db.createAdminAccount(input, root)).success, false, 'C.I. repetida');

    const l1 = (await db.loginAdmin('5555555', 'clave123')).admin!;
    assert.equal((await db.deleteAdminAccount('5555555', l1)).success, false, 'Nivel 1 no elimina');
    assert.equal((await db.deleteAdminAccount('1000001', root)).success, false, 'no el principal');
    assert.equal((await db.deleteAdminAccount(root.id, root)).success, false, 'no a sí mismo');

    assert.equal((await db.deleteAdminAccount('5555555', root)).success, true);
    assert.equal((await db.loginAdmin('5555555', 'clave123')).success, false);
    assert.equal(await db.getAdminBySession(l1.token), null, 'sus sesiones se eliminan');
  });
});
