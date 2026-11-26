import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createAsuncionDb } from './db.ts';

function createTempDbPath(name: string) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'asuncion-sqlite-'));
  return { dir, dbPath: path.join(dir, `${name}.sqlite`) };
}

test('SQLite initializes schema, seeds root Nivel 2 admin and initial reports with dates', () => {
  const { dir, dbPath } = createTempDbPath('init');
  const db = createAsuncionDb(dbPath);

  const accounts = db.listAdminAccounts();
  const root = accounts.find((a) => a.id === '1000001');
  assert.ok(root);
  assert.equal(root.level, 2);

  const reports = db.listReports();
  assert.ok(reports.length >= 7);
  for (const r of reports) {
    assert.ok(r.createdAt);
    assert.match(r.reportDate || '', /^\d{4}-\d{2}-\d{2}$/);
    assert.match(r.reportMonth || '', /^\d{4}-\d{2}$/);
    assert.ok(Array.isArray(r.statusHistory) && r.statusHistory.length >= 1);
  }

  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

test('SQLite persists citizens, admin profiles, reports, and date/month filters across reopen', () => {
  const { dir, dbPath } = createTempDbPath('persist');
  let db = createAsuncionDb(dbPath);

  // Register citizen with C.I. as id
  const citRes = db.registerCitizen({ cedula: '4.567.890', fullName: 'Carlos Benítez', phone: '0981111222' });
  assert.equal(citRes.success, true);
  assert.equal(citRes.citizen?.id, '4567890');
  assert.ok(citRes.token);

  // Login root Nivel 2 admin and create Nivel 1 admin
  const loginRoot = db.loginAdmin('1000001', 'admin123');
  assert.equal(loginRoot.success, true);
  assert.ok(loginRoot.admin);

  const createL1 = db.createAdminAccount(
    {
      ci: '3216549',
      employeeNumber: 'EMP-104',
      fullName: 'Lic. Valeria Gómez',
      level: 1,
      password: 'secret'
    },
    loginRoot.admin
  );
  assert.equal(createL1.success, true);

  // Create two reports on different dates/months
  const rNov = db.createReport({
    category: 'Bache',
    description: 'Bache profundo sobre España',
    photoUrl: 'https://example.com/a.jpg',
    location: { lat: -25.289, lng: -57.618, address: 'Av. España 450', barrio: 'Las Mercedes' },
    citizenId: '4567890',
    citizenName: 'Carlos Benítez',
    severity: 'Alta',
    createdAt: '2026-11-13T14:00:00.000Z'
  });

  const rOct = db.createReport({
    category: 'Alcantarilla sin tapa',
    description: 'Boca abierta en Sajonia',
    photoUrl: 'https://example.com/b.jpg',
    location: { lat: -25.2825, lng: -57.6412, address: 'Av. Carlos A. López', barrio: 'Sajonia' },
    citizenId: '4567890',
    citizenName: 'Carlos Benítez',
    severity: 'Crítica',
    createdAt: '2026-10-08T16:00:00.000Z'
  });

  // Update status and verify audit history persisted
  const updated = db.updateReportStatus(rOct.id, 'Solucionado', 'Reparado por cuadrilla', 'Ing. Mario Arzamendia');
  assert.equal(updated?.status, 'Solucionado');
  assert.equal(updated?.statusHistory?.length, 2);

  // Close and reopen SQLite file from disk to verify real persistence
  db.close();
  db = createAsuncionDb(dbPath);

  const persistedCitizen = db.getCitizenBySession(citRes.token);
  assert.equal(persistedCitizen?.id, '4567890');
  assert.equal(persistedCitizen?.fullName, 'Carlos Benítez');

  const loginL1 = db.loginAdmin('3216549', 'secret');
  assert.equal(loginL1.success, true);
  assert.equal(loginL1.admin?.level, 1);

  // Query by exact date
  const nov13Reports = db.listReports({ date: '2026-11-13' });
  assert.ok(nov13Reports.some((r) => r.id === rNov.id));
  assert.ok(!nov13Reports.some((r) => r.id === rOct.id));

  // Query by month
  const octReports = db.listReports({ month: '2026-10' });
  assert.ok(octReports.some((r) => r.id === rOct.id));
  assert.ok(!octReports.some((r) => r.id === rNov.id));

  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});
