import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createTestSchema, TEST_DB_URL, type TestSchema } from './testSupport.ts';
import type { AsuncionDb } from './db.ts';
import { validateReportInput } from './validation.ts';
import { serializeReport } from './privacy.ts';

const jpeg = 'data:image/jpeg;base64,' + Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]).toString('base64');
const SECRET = 'test-secret';

const DESC = 'Bache frente a la escuela';

describe('Privacidad con la base real', { skip: TEST_DB_URL ? false : 'define TEST_DATABASE_URL para correr estos tests' }, () => {
  let ts: TestSchema;
  let db: AsuncionDb;

  before(async () => {
    ts = await createTestSchema();
    db = await ts.open();
    const v = validateReportInput({
      category: 'Bache', severity: 'Alta', description: DESC, photoUrl: jpeg,
      location: { lat: -25.2867, lng: -57.6333, address: 'Av. España', barrio: 'Villa Morra' },
      citizenId: '4567123', citizenName: 'Zacarías Quintanilla Benítez', citizenPhone: '0981123456'
    });
    assert.ok(v.ok);
    await db.createReport(v.data);
  });
  after(async () => {
    await ts.dispose();
  });

  test('el público nunca recibe nombre completo, cédula completa ni teléfono', async () => {
    const reports = (await db.listReports({})).map((r) => serializeReport(r, false, SECRET));
    const mine = reports.find((r) => r.description === DESC)!;
    assert.equal(mine.citizenName, 'Zacarías');
    assert.equal(mine.citizenId, '••••123');
    const json = JSON.stringify(mine);
    for (const secret of ['Quintanilla', '4567123', '0981123456']) assert.ok(!json.includes(secret), secret);
  });

  test('el administrador recibe todo completo', async () => {
    const r = (await db.listReports({})).map((x) => serializeReport(x, true, SECRET)).find((x) => x.description === DESC)!;
    assert.equal(r.citizenName, 'Zacarías Quintanilla Benítez');
    assert.equal(r.citizenId, '4567123');
    assert.equal(r.citizenPhone, '0981123456');
  });

  test('la búsqueda pública no encuentra por nombre del ciudadano; la de admin sí', async () => {
    assert.equal((await db.listReports({ q: 'Quintanilla' })).length, 0);
    assert.equal((await db.listReports({ q: 'Quintanilla', searchCitizen: true })).length, 1);
    assert.equal((await db.listReports({ q: 'frente a la escuela' })).length, 1);
  });
});
