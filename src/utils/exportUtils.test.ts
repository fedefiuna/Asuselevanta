import test from 'node:test';
import assert from 'node:assert/strict';
import { escapeCSVCell, generateCSV, computeTransparencyStats } from './exportUtils.js';
import { IncidentReport } from '../types.js';

const mockReports: IncidentReport[] = [
  {
    id: 'ASU-2025-001',
    category: 'Bache',
    status: 'Pendiente',
    severity: 'Alta',
    location: {
      address: 'Avda. Mariscal López y San Martín',
      barrio: 'Villa Morra',
      lat: -25.2974,
      lng: -57.5882
    },
    citizenName: 'Juan Pérez',
    citizenPhone: '0981123456',
    description: 'Bache profundo, con agua estancada y "cráteres".',
    photoUrl: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7',
    createdAt: '2025-02-15T10:00:00.000Z',
    updatedAt: '2025-02-15T10:00:00.000Z'
  },
  {
    id: 'ASU-2025-002',
    category: 'Suciedad / Basura',
    status: 'Solucionado',
    severity: 'Media',
    location: {
      address: 'Palma y Chile',
      barrio: 'La Encarnación',
      lat: -25.2825,
      lng: -57.6351
    },
    citizenName: 'María Benítez',
    citizenPhone: '0971987654',
    description: 'Vertedero clandestino en vereda.',
    resolutionNotes: 'Cuadrilla de aseo urbano limpió y desinfectó la zona.',
    photoUrl: 'https://images.unsplash.com/photo-1605600659908-0ef719419d41',
    createdAt: '2025-02-10T08:30:00.000Z',
    updatedAt: '2025-02-12T14:00:00.000Z',
    resolvedAt: '2025-02-12T14:00:00.000Z'
  }
];

test('escapeCSVCell escapes quotes, commas, and handles nulls', () => {
  assert.equal(escapeCSVCell(null), '""');
  assert.equal(escapeCSVCell(undefined), '""');
  assert.equal(escapeCSVCell('Simple'), '"Simple"');
  assert.equal(escapeCSVCell('Con, coma'), '"Con, coma"');
  assert.equal(escapeCSVCell('Con "comillas"'), '"Con ""comillas"""');
  assert.equal(escapeCSVCell(123), '"123"');
});

test('generateCSV creates valid CSV with UTF-8 BOM and correct headers', () => {
  const csv = generateCSV(mockReports);

  // Check UTF-8 BOM
  assert.ok(csv.startsWith('\uFEFF'), 'CSV must start with UTF-8 BOM');

  // Check header existence
  assert.ok(csv.includes('Código Incidencia'));
  assert.ok(csv.includes('Categoría'));
  assert.ok(csv.includes('Estado'));
  assert.ok(csv.includes('Barrio'));

  // Check rows
  assert.ok(csv.includes('ASU-2025-001'));
  assert.ok(csv.includes('Villa Morra'));
  assert.ok(csv.includes('Bache profundo, con agua estancada y ""cráteres"".'));
  assert.ok(csv.includes('ASU-2025-002'));
  assert.ok(csv.includes('Cuadrilla de aseo urbano limpió y desinfectó la zona.'));
});

test('computeTransparencyStats calculates totals and distributions correctly', () => {
  const stats = computeTransparencyStats(mockReports);

  assert.equal(stats.total, 2);
  assert.equal(stats.pending, 1);
  assert.equal(stats.solved, 1);
  assert.equal(stats.inReview, 0);
  assert.equal(stats.solvedRate, 50);

  assert.equal(stats.categoryBreakdown['Bache'], 1);
  assert.equal(stats.categoryBreakdown['Suciedad / Basura'], 1);
  assert.equal(stats.barrioBreakdown['Villa Morra'], 1);
  assert.equal(stats.barrioBreakdown['La Encarnación'], 1);
});
