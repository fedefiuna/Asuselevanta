import test from 'node:test';
import assert from 'node:assert/strict';
import { validateReportInput, LIMITS } from './validation.ts';

// Cabeceras mínimas reales: JPEG (FFD8FF), PNG (89504E47), WEBP (RIFF....WEBP)
const jpeg = 'data:image/jpeg;base64,' + Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]).toString('base64');
const png = 'data:image/png;base64,' + Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]).toString('base64');
const webp = 'data:image/webp;base64,' + Buffer.concat([Buffer.from('RIFF'), Buffer.from([1, 0, 0, 0]), Buffer.from('WEBP')]).toString('base64');

const good = () => ({
  category: 'Bache',
  severity: 'Alta',
  description: 'Bache profundo',
  photoUrl: jpeg,
  location: { lat: -25.2867, lng: -57.6333, address: 'Av. España', barrio: 'Villa Morra' },
  citizenId: '4567123',
  citizenName: 'Juan Benítez'
});

test('acepta un reporte válido (jpeg, png, webp)', () => {
  for (const photoUrl of [jpeg, png, webp]) {
    assert.equal(validateReportInput({ ...good(), photoUrl }).ok, true);
  }
});

test('rechaza categoría o severidad fuera de lista', () => {
  assert.equal(validateReportInput({ ...good(), category: 'Otra' }).ok, false);
  assert.equal(validateReportInput({ ...good(), severity: 'Extrema' }).ok, false);
});

test('severidad ausente se asume Media', () => {
  const { severity: _s, ...rest } = good();
  const r = validateReportInput(rest);
  assert.ok(r.ok && r.data.severity === 'Media');
});

test('rechaza ubicaciones fuera de Asunción o no numéricas', () => {
  assert.equal(validateReportInput({ ...good(), location: { ...good().location, lat: -34.6, lng: -58.4 } }).ok, false);
  assert.equal(validateReportInput({ ...good(), location: { ...good().location, lat: 'x' } }).ok, false);
});

test('rechaza fotos falsas, SVG, cuerpos vacíos y demasiado pesados', () => {
  const fake = 'data:image/jpeg;base64,' + Buffer.from('esto no es una imagen').toString('base64');
  assert.equal(validateReportInput({ ...good(), photoUrl: fake }).ok, false);
  assert.equal(validateReportInput({ ...good(), photoUrl: 'data:image/svg+xml;base64,PHN2Zz4=' }).ok, false);
  assert.equal(validateReportInput({ ...good(), photoUrl: '' }).ok, false);
  assert.equal(validateReportInput({ ...good(), photoUrl: jpeg + 'A'.repeat(LIMITS.photoChars) }).ok, false);
});

test('URLs externas: solo la muestra de Unsplash y solo si se permite', () => {
  const sample = 'https://images.unsplash.com/photo-1515162816999?w=600';
  assert.equal(validateReportInput({ ...good(), photoUrl: sample }).ok, false);
  assert.equal(validateReportInput({ ...good(), photoUrl: sample }, { allowSamplePhotos: true }).ok, true);
  assert.equal(validateReportInput({ ...good(), photoUrl: 'https://evil.example/x.jpg' }, { allowSamplePhotos: true }).ok, false);
  assert.equal(validateReportInput({ ...good(), photoUrl: 'http://images.unsplash.com/x.jpg' }, { allowSamplePhotos: true }).ok, false);
});

test('limita el largo de textos', () => {
  assert.equal(validateReportInput({ ...good(), description: 'x'.repeat(LIMITS.description + 1) }).ok, false);
  assert.equal(validateReportInput({ ...good(), citizenName: '' }).ok, false);
  assert.equal(validateReportInput(null).ok, false);
});
