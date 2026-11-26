import test from 'node:test';
import assert from 'node:assert/strict';
import { createAsuncionDb } from './db.ts';
import { validateReportInput } from './validation.ts';
import { serializeReport } from './privacy.ts';

const jpeg = 'data:image/jpeg;base64,' + Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]).toString('base64');
const SECRET = 'test-secret';

function setup() {
  const db = createAsuncionDb(':memory:');
  const v = validateReportInput({
    category: 'Bache', severity: 'Alta', description: 'Bache frente a la escuela', photoUrl: jpeg,
    location: { lat: -25.2867, lng: -57.6333, address: 'Av. España', barrio: 'Villa Morra' },
    citizenId: '4567123', citizenName: 'Zacarías Quintanilla Benítez', citizenPhone: '0981123456'
  });
  assert.ok(v.ok);
  db.createReport(v.data);
  return db;
}

test('el público nunca recibe nombre completo, cédula completa ni teléfono', () => {
  const db = setup();
  const reports = db.listReports({}).map((r) => serializeReport(r, false, SECRET));
  const mine = reports.find((r) => r.description === 'Bache frente a la escuela')!;
  assert.equal(mine.citizenName, 'Zacarías');
  assert.equal(mine.citizenId, '••••123');
  const json = JSON.stringify(mine);
  for (const secret of ['Quintanilla', '4567123', '0981123456']) assert.ok(!json.includes(secret), secret);
});

test('el administrador recibe todo completo', () => {
  const db = setup();
  const r = db.listReports({}).map((x) => serializeReport(x, true, SECRET)).find((x) => x.description === 'Bache frente a la escuela')!;
  assert.equal(r.citizenName, 'Zacarías Quintanilla Benítez');
  assert.equal(r.citizenId, '4567123');
  assert.equal(r.citizenPhone, '0981123456');
});

test('la búsqueda pública no encuentra por nombre del ciudadano; la de admin sí', () => {
  const db = setup();
  assert.equal(db.listReports({ q: 'Quintanilla' }).length, 0);
  assert.equal(db.listReports({ q: 'Quintanilla', searchCitizen: true }).length, 1);
  assert.equal(db.listReports({ q: 'frente a la escuela' }).length, 1);
});
