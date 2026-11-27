import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createAsuncionDb } from './db.ts';

// Estos tests necesitan una base Postgres de PRUEBA (no la de producción).
// Define TEST_DATABASE_URL en el .env o en la terminal. Si no existe, se saltan.
// Cada test crea su propio schema temporal y lo borra al terminar.
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
const skip = !TEST_DATABASE_URL ? 'Define TEST_DATABASE_URL para correr estos tests' : false;

const ROOT = { ci: '1000001', password: 'TestAdmin123', fullName: 'Admin de Prueba' };

function tempSchema(name: string) {
  return `test_${name}_${crypto.randomBytes(4).toString('hex')}`;
}

test('Postgres crea el esquema y el administrador inicial Nivel 2', { skip }, async () => {
  const db = await createAsuncionDb(TEST_DATABASE_URL!, { schema: tempSchema('init'), seedAdmin: ROOT });
  try {
    const accounts = await db.listAdminAccounts();
    const root = accounts.find((a) => a.id === '1000001');
    assert.ok(root);
    assert.equal(root.level, 2);

    const reports = await db.listReports();
    assert.equal(reports.length, 0);
  } finally {
    await db.close({ dropSchema: true });
  }
});

test('Postgres persiste ciudadanos, perfiles admin, reportes y filtros por fecha/mes al reconectar', { skip }, async () => {
  const schema = tempSchema('persist');
  let db = await createAsuncionDb(TEST_DATABASE_URL!, { schema, seedAdmin: ROOT });

  try {
    const citRes = await db.registerCitizen({ cedula: '4.567.890', fullName: 'Carlos Benítez', phone: '0981111222' });
    assert.equal(citRes.success, true);
    assert.equal(citRes.citizen?.id, '4567890');
    assert.ok(citRes.token);

    const loginRoot = await db.loginAdmin('1000001', ROOT.password);
    assert.equal(loginRoot.success, true);
    assert.ok(loginRoot.admin);

    // La contraseña vieja "admin123" ya no existe
    const badLogin = await db.loginAdmin('1000001', 'admin123');
    assert.equal(badLogin.success, false);

    const createL1 = await db.createAdminAccount(
      {
        ci: '3216549',
        employeeNumber: 'EMP-104',
        fullName: 'Lic. Valeria Gómez',
        level: 1,
        password: 'secret'
      },
      loginRoot.admin!
    );
    assert.equal(createL1.success, true);

    const rNov = await db.createReport({
      category: 'Bache',
      description: 'Bache profundo sobre España',
      photoUrl: 'https://example.com/a.jpg',
      location: { lat: -25.289, lng: -57.618, address: 'Av. España 450', barrio: 'Las Mercedes' },
      citizenId: '4567890',
      citizenName: 'Carlos Benítez',
      severity: 'Alta',
      createdAt: '2026-11-13T14:00:00.000Z'
    });

    const rOct = await db.createReport({
      category: 'Alcantarilla sin tapa',
      description: 'Boca abierta en Sajonia',
      photoUrl: 'https://example.com/b.jpg',
      location: { lat: -25.2825, lng: -57.6412, address: 'Av. Carlos A. López', barrio: 'Sajonia' },
      citizenId: '4567890',
      citizenName: 'Carlos Benítez',
      severity: 'Crítica',
      createdAt: '2026-10-08T16:00:00.000Z'
    });

    // Los IDs salen del contador atómico, sin repetirse
    assert.notEqual(rNov.id, rOct.id);
    assert.match(rNov.id, /^ASU-2026-\d{3}$/);
    assert.equal(typeof rNov.createdAt, 'string');

    const updated = await db.updateReportStatus(rOct.id, 'Solucionado', 'Reparado por cuadrilla', 'Ing. Mario Arzamendia');
    assert.equal(updated?.status, 'Solucionado');
    assert.equal(updated?.statusHistory?.length, 2);

    // Cerrar y reabrir la conexión: los datos deben seguir ahí
    await db.close();
    db = await createAsuncionDb(TEST_DATABASE_URL!, { schema, seedAdmin: ROOT });

    const persistedCitizen = await db.getCitizenBySession(citRes.token);
    assert.equal(persistedCitizen?.id, '4567890');
    assert.equal(persistedCitizen?.fullName, 'Carlos Benítez');

    const loginL1 = await db.loginAdmin('3216549', 'secret');
    assert.equal(loginL1.success, true);
    assert.equal(loginL1.admin?.level, 1);

    const nov13Reports = await db.listReports({ date: '2026-11-13' });
    assert.ok(nov13Reports.some((r) => r.id === rNov.id));
    assert.ok(!nov13Reports.some((r) => r.id === rOct.id));

    const octReports = await db.listReports({ month: '2026-10' });
    assert.ok(octReports.some((r) => r.id === rOct.id));
    assert.ok(!octReports.some((r) => r.id === rNov.id));

    // La cuenta principal no se puede borrar; la creada por ella sí
    const delRoot = await db.deleteAdminAccount('1000001', loginL1.admin!);
    assert.equal(delRoot.success, false); // L1 no tiene permiso
    const loginRoot2 = await db.loginAdmin('1000001', ROOT.password);
    const delMain = await db.deleteAdminAccount('1000001', { ...loginRoot2.admin!, id: 'otro' });
    assert.equal(delMain.success, false);
    const delL1 = await db.deleteAdminAccount('3216549', loginRoot2.admin!);
    assert.equal(delL1.success, true);
  } finally {
    await db.close({ dropSchema: true });
  }
});

test('Postgres: reportes simultáneos reciben IDs distintos', { skip }, async () => {
  const db = await createAsuncionDb(TEST_DATABASE_URL!, { schema: tempSchema('concurrent'), seedAdmin: ROOT });
  try {
    const make = (i: number) =>
      db.createReport({
        category: 'Bache',
        description: `Reporte ${i}`,
        photoUrl: 'https://example.com/a.jpg',
        location: { lat: -25.29, lng: -57.62, address: `Calle ${i}`, barrio: 'Centro' },
        citizenName: `Vecino ${i}`,
        severity: 'Media',
        createdAt: '2026-11-13T14:00:00.000Z'
      });
    const created = await Promise.all(Array.from({ length: 8 }, (_, i) => make(i)));
    assert.equal(new Set(created.map((r) => r.id)).size, 8);
  } finally {
    await db.close({ dropSchema: true });
  }
});
