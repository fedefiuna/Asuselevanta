import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createAsuncionDb } from './db.ts';
import { validateReportInput } from './validation.ts';
import { serializeReport } from './privacy.ts';

// Necesita una base Postgres de PRUEBA en TEST_DATABASE_URL (no la de producción).
// Si no está definida, estos tests se saltan. Cada test usa un schema temporal que se borra al final.
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
const skip = !TEST_DATABASE_URL ? 'Define TEST_DATABASE_URL para correr estos tests' : false;

const jpeg = 'data:image/jpeg;base64,' + Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]).toString('base64');
const SECRET = 'test-secret';

async function setup() {
  const db = await createAsuncionDb(TEST_DATABASE_URL!, {
    schema: `test_privacy_${crypto.randomBytes(4).toString('hex')}`
  });
  const v = validateReportInput({
    category: 'Bache', severity: 'Alta', description: 'Bache frente a la escuela', photoUrl: jpeg,
    location: { lat: -25.2867, lng: -57.6333, address: 'Av. España', barrio: 'Villa Morra' },
    citizenId: '4567123', citizenName: 'Zacarías Quintanilla Benítez', citizenPhone: '0981123456'
  });
  assert.ok(v.ok);
  await db.createReport(v.data);
  return db;
}

test('el público nunca recibe nombre completo, cédula completa ni teléfono', { skip }, async () => {
  const db = await setup();
  try {
    const reports = (await db.listReports({})).map((r) => serializeReport(r, false, SECRET));
    const mine = reports.find((r) => r.description === 'Bache frente a la escuela')!;
    assert.equal(mine.citizenName, 'Zacarías');
    assert.equal(mine.citizenId, '••••123');
    const json = JSON.stringify(mine);
    for (const secret of ['Quintanilla', '4567123', '0981123456']) assert.ok(!json.includes(secret), secret);
  } finally {
    await db.close({ dropSchema: true });
  }
});

test('el administrador recibe todo completo', { skip }, async () => {
  const db = await setup();
  try {
    const r = (await db.listReports({}))
      .map((x) => serializeReport(x, true, SECRET))
      .find((x) => x.description === 'Bache frente a la escuela')!;
    assert.equal(r.citizenName, 'Zacarías Quintanilla Benítez');
    assert.equal(r.citizenId, '4567123');
    assert.equal(r.citizenPhone, '0981123456');
  } finally {
    await db.close({ dropSchema: true });
  }
});

test('la búsqueda pública no encuentra por nombre del ciudadano; la de admin sí', { skip }, async () => {
  const db = await setup();
  try {
    assert.equal((await db.listReports({ q: 'Quintanilla' })).length, 0);
    assert.equal((await db.listReports({ q: 'Quintanilla', searchCitizen: true })).length, 1);
    assert.equal((await db.listReports({ q: 'frente a la escuela' })).length, 1);
  } finally {
    await db.close({ dropSchema: true });
  }
});
