import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateCategoryStatusMetrics, calculateStatusDistribution } from './chartData';
import { IncidentReport } from '../types';

const mockReports: IncidentReport[] = [
  {
    id: 'ASU-2026-001',
    category: 'Bache',
    description: 'Bache profundo',
    photoUrl: '',
    location: { lat: -25.29, lng: -57.58, address: 'Av. Mariscal López', barrio: 'Recoleta' },
    citizenName: 'Carlos M.',
    severity: 'Alta',
    status: 'Pendiente',
    createdAt: '2026-03-01T10:00:00Z',
    updatedAt: '2026-03-01T10:00:00Z'
  },
  {
    id: 'ASU-2026-002',
    category: 'Bache',
    description: 'Bache peligroso',
    photoUrl: '',
    location: { lat: -25.30, lng: -57.59, address: 'Av. España', barrio: 'Villa Morra' },
    citizenName: 'Ana R.',
    severity: 'Crítica',
    status: 'En revisión',
    createdAt: '2026-03-01T11:00:00Z',
    updatedAt: '2026-03-01T11:00:00Z'
  },
  {
    id: 'ASU-2026-003',
    category: 'Bache',
    description: 'Bache reparado',
    photoUrl: '',
    location: { lat: -25.31, lng: -57.60, address: 'Av. Eusebio Ayala', barrio: 'Nazareth' },
    citizenName: 'Juan P.',
    severity: 'Media',
    status: 'Solucionado',
    createdAt: '2026-02-28T09:00:00Z',
    updatedAt: '2026-03-01T12:00:00Z',
    resolvedAt: '2026-03-01T12:00:00Z'
  },
  {
    id: 'ASU-2026-004',
    category: 'Alcantarilla sin tapa',
    description: 'Tapa rota',
    photoUrl: '',
    location: { lat: -25.28, lng: -57.63, address: 'Palma y Colón', barrio: 'Centro' },
    citizenName: 'Lucía G.',
    severity: 'Crítica',
    status: 'Solucionado',
    createdAt: '2026-02-27T08:00:00Z',
    updatedAt: '2026-03-01T08:00:00Z',
    resolvedAt: '2026-03-01T08:00:00Z'
  },
  {
    id: 'ASU-2026-005',
    category: 'Suciedad / Basura',
    description: 'Vertedero clandestino',
    photoUrl: '',
    location: { lat: -25.27, lng: -57.62, address: 'Costanera Norte', barrio: 'Barrio Obrero' },
    citizenName: 'Miguel A.',
    severity: 'Media',
    status: 'Pendiente',
    createdAt: '2026-03-02T07:00:00Z',
    updatedAt: '2026-03-02T07:00:00Z'
  }
];

test('calculateCategoryStatusMetrics correctly groups reports by category and status', () => {
  const metrics = calculateCategoryStatusMetrics(mockReports);

  // Assert all 4 categories exist
  assert.equal(metrics.length, 4);

  // Check 'Bache' metrics
  const bache = metrics.find(m => m.category === 'Bache')!;
  assert.ok(bache);
  assert.equal(bache.total, 3);
  assert.equal(bache.Pendiente, 1);
  assert.equal(bache['En revisión'], 1);
  assert.equal(bache.Solucionado, 1);
  assert.equal(bache.resolutionRate, 33); // 1 / 3 = 33%

  // Check 'Alcantarilla sin tapa' metrics
  const alcantarilla = metrics.find(m => m.category === 'Alcantarilla sin tapa')!;
  assert.ok(alcantarilla);
  assert.equal(alcantarilla.total, 1);
  assert.equal(alcantarilla.Solucionado, 1);
  assert.equal(alcantarilla.Pendiente, 0);
  assert.equal(alcantarilla.resolutionRate, 100);

  // Check 'Badén en mal estado' (no reports)
  const baden = metrics.find(m => m.category === 'Badén en mal estado')!;
  assert.ok(baden);
  assert.equal(baden.total, 0);
  assert.equal(baden.resolutionRate, 0);

  // Check 'Suciedad / Basura'
  const basura = metrics.find(m => m.category === 'Suciedad / Basura')!;
  assert.ok(basura);
  assert.equal(basura.total, 1);
  assert.equal(basura.Pendiente, 1);
  assert.equal(basura.Solucionado, 0);
  assert.equal(basura.resolutionRate, 0);
});

test('calculateStatusDistribution computes total status shares accurately', () => {
  const distribution = calculateStatusDistribution(mockReports);

  const solucionado = distribution.find(d => d.status === 'Solucionado')!;
  const pendiente = distribution.find(d => d.status === 'Pendiente')!;
  const enRevision = distribution.find(d => d.status === 'En revisión')!;

  assert.equal(solucionado.count, 2);
  assert.equal(pendiente.count, 2);
  assert.equal(enRevision.count, 1);

  // Total 5 reports: 40%, 40%, 20%
  assert.equal(solucionado.percentage, 40);
  assert.equal(pendiente.percentage, 40);
  assert.equal(enRevision.percentage, 20);
});

test('handles empty report list gracefully without NaN errors', () => {
  const metrics = calculateCategoryStatusMetrics([]);
  for (const item of metrics) {
    assert.equal(item.total, 0);
    assert.equal(item.Pendiente, 0);
    assert.equal(item['En revisión'], 0);
    assert.equal(item.Solucionado, 0);
    assert.equal(item.resolutionRate, 0);
  }

  const distribution = calculateStatusDistribution([]);
  for (const item of distribution) {
    assert.equal(item.count, 0);
    assert.equal(item.percentage, 0);
  }
});
