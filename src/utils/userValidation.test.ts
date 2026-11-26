import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeCI,
  isValidCI,
  formatCI,
  validateCitizenRegistration,
  validateAdminRegistration,
  canAdminEditReports,
  canAdminManageProfiles
} from './userValidation';
import { AdminUser } from '../types';

test('normalizeCI strips dots, spaces, and dashes cleanly', () => {
  assert.equal(normalizeCI('4.567.890'), '4567890');
  assert.equal(normalizeCI(' 3 210 654 '), '3210654');
  assert.equal(normalizeCI('5234111-0'), '52341110');
});

test('isValidCI validates Paraguayan C.I. digit length', () => {
  assert.equal(isValidCI('4.567.890'), true);
  assert.equal(isValidCI('12345'), true);
  assert.equal(isValidCI('1234'), false);
  assert.equal(isValidCI('abc1234'), false);
  assert.equal(isValidCI(''), false);
});

test('formatCI adds thousand separators', () => {
  assert.equal(formatCI('4567890'), '4.567.890');
});

test('validateCitizenRegistration sets C.I. as id and validates required fields', () => {
  const missingCI = validateCitizenRegistration({ cedula: '', fullName: 'Carlos Benítez' });
  assert.equal(missingCI.valid, false);

  const invalidCI = validateCitizenRegistration({ cedula: '123', fullName: 'Carlos Benítez' });
  assert.equal(invalidCI.valid, false);

  const missingName = validateCitizenRegistration({ cedula: '4567890', fullName: 'Ca' });
  assert.equal(missingName.valid, false);

  const ok = validateCitizenRegistration({
    cedula: '4.567.890',
    fullName: '  Carlos Benítez  ',
    phone: '0981 123 456'
  });
  assert.equal(ok.valid, true);
  assert.equal(ok.data?.id, '4567890');
  assert.equal(ok.data?.ci, '4567890');
  assert.equal(ok.data?.fullName, 'Carlos Benítez');
});

test('validateAdminRegistration requires C.I. (as id), employeeNumber, fullName, level, and password', () => {
  const missingEmp = validateAdminRegistration({
    ci: '3216549',
    employeeNumber: '',
    fullName: 'Valeria Gómez',
    level: 1,
    password: 'pass'
  });
  assert.equal(missingEmp.valid, false);

  const ok = validateAdminRegistration({
    ci: '3.216.549',
    employeeNumber: 'EMP-104',
    fullName: 'Lic. Valeria Gómez',
    level: 1,
    password: 'valeria123',
    email: 'VALERIA@asuncion.gov.py'
  });
  assert.equal(ok.valid, true);
  assert.equal(ok.data?.id, '3216549');
  assert.equal(ok.data?.ci, '3216549');
  assert.equal(ok.data?.employeeNumber, 'EMP-104');
  assert.equal(ok.data?.level, 1);
  assert.equal(ok.data?.email, 'valeria@asuncion.gov.py');
});

test('admin permission helpers strictly restrict Nivel 1 to read-only and grant Nivel 2 full control', () => {
  const level1: AdminUser = {
    id: '3216549',
    ci: '3216549',
    employeeNumber: 'EMP-104',
    fullName: 'Lic. Valeria Gómez',
    level: 1,
    role: 'analista',
    token: 't1'
  };
  const level2: AdminUser = {
    id: '1000001',
    ci: '1000001',
    employeeNumber: 'EMP-001',
    fullName: 'Ing. Mario Arzamendia',
    level: 2,
    role: 'administrador',
    token: 't2'
  };

  assert.equal(canAdminEditReports(level1), false);
  assert.equal(canAdminManageProfiles(level1), false);
  assert.equal(canAdminEditReports(level2), true);
  assert.equal(canAdminManageProfiles(level2), true);
  assert.equal(canAdminEditReports(null), false);
});
