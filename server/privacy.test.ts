import test from 'node:test';
import assert from 'node:assert/strict';
import { firstName, maskCI, citizenKey, toPublicReport, toAdminReport } from './privacy.ts';
import type { IncidentReport } from '../src/types.ts';

const base: IncidentReport = {
  id: 'ASU-2026-001',
  category: 'Bache',
  description: 'Bache grande',
  photoUrl: 'data:image/jpeg;base64,/9j/4AAQ',
  location: { lat: -25.28, lng: -57.63, address: 'Av. Mcal. López', barrio: 'Villa Morra' },
  citizenId: '4567123',
  citizenName: 'Juan Carlos Benítez',
  citizenPhone: '0981123456',
  severity: 'Alta',
  status: 'Pendiente',
  createdAt: '2026-11-01T10:00:00.000Z',
  updatedAt: '2026-11-01T10:00:00.000Z',
  statusHistory: [
    { id: 'h1', timestamp: '2026-11-01T10:00:00.000Z', newStatus: 'Pendiente', changedBy: 'Juan Carlos Benítez' },
    { id: 'h2', timestamp: '2026-11-02T10:00:00.000Z', newStatus: 'En revisión', changedBy: 'Ing. Fernando Lugo' }
  ]
} as IncidentReport;

test('firstName y maskCI', () => {
  assert.equal(firstName('  Juan Carlos Benítez '), 'Juan');
  assert.equal(firstName(''), 'Vecino');
  assert.equal(maskCI('4.567.123'), '••••123');
  assert.equal(maskCI(undefined), undefined);
});

test('citizenKey es estable, depende del secreto y no revela la cédula', () => {
  const a = citizenKey('s1', '4567123');
  assert.equal(a, citizenKey('s1', '4567123'));
  assert.notEqual(a, citizenKey('s2', '4567123'));
  assert.notEqual(a, citizenKey('s1', '4567124'));
  assert.ok(!a.includes('4567123'));
});

test('toPublicReport abrevia nombre, cédula e historial y quita el teléfono', () => {
  const pub = toPublicReport(base, 'secret');
  assert.equal(pub.citizenName, 'Juan');
  assert.equal(pub.citizenId, '••••123');
  assert.equal(pub.citizenPhone, undefined);
  assert.equal(pub.statusHistory?.[0].changedBy, 'Juan');
  assert.equal(pub.statusHistory?.[1].changedBy, 'Ing. Fernando Lugo');
  const json = JSON.stringify(pub);
  assert.ok(!json.includes('Benítez') && !json.includes('4567123') && !json.includes('0981123456'));
});

test('toAdminReport mantiene todo y comparte clave con la versión pública', () => {
  const adm = toAdminReport(base, 'secret');
  assert.equal(adm.citizenName, 'Juan Carlos Benítez');
  assert.equal(adm.citizenId, '4567123');
  assert.equal(adm.citizenPhone, '0981123456');
  assert.equal(adm.citizenKey, toPublicReport(base, 'secret').citizenKey);
});

test('dos "Juan" distintos reciben claves distintas', () => {
  const other = { ...base, citizenId: '1234567', citizenName: 'Juan Pérez' };
  assert.notEqual(toPublicReport(base, 's').citizenKey, toPublicReport(other, 's').citizenKey);
});
