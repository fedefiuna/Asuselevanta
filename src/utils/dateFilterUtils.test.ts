import test from 'node:test';
import assert from 'node:assert/strict';
import {
  toAsuncionDateKey,
  toAsuncionMonthKey,
  formatMonthLabelEs,
  getAvailableReportMonths,
  filterAdminReports
} from './dateFilterUtils.js';
import { IncidentReport } from '../types.js';

const SAMPLE_REPORTS: IncidentReport[] = [
  {
    id: 'ASU-2026-001',
    category: 'Bache',
    description: 'Bache en Av. Mariscal López',
    photoUrl: 'https://example.com/1.jpg',
    location: { lat: -25.2974, lng: -57.5882, address: 'Av. Mcal. López', barrio: 'Villa Morra' },
    citizenName: 'Carlos Benítez',
    citizenId: '4567890',
    severity: 'Alta',
    status: 'Pendiente',
    createdAt: '2026-11-13T14:00:00.000Z',
    reportDate: '2026-11-13',
    reportMonth: '2026-11',
    updatedAt: '2026-11-13T14:00:00.000Z'
  },
  {
    id: 'ASU-2026-002',
    category: 'Alcantarilla sin tapa',
    description: 'Alcantarilla abierta en Sajonia',
    photoUrl: 'https://example.com/2.jpg',
    location: { lat: -25.2825, lng: -57.6412, address: 'Av. Carlos A. López', barrio: 'Sajonia' },
    citizenName: 'María Villalba',
    severity: 'Crítica',
    status: 'En revisión',
    createdAt: '2026-10-25T15:00:00.000Z',
    reportDate: '2026-10-25',
    reportMonth: '2026-10',
    updatedAt: '2026-10-26T10:00:00.000Z'
  },
  {
    id: 'ASU-2026-003',
    category: 'Suciedad / Basura',
    description: 'Basural despejado',
    photoUrl: 'https://example.com/3.jpg',
    location: { lat: -25.3088, lng: -57.6045, address: 'Av. Eusebio Ayala', barrio: 'Recoleta' },
    citizenName: 'Rodrigo Galeano',
    severity: 'Media',
    status: 'Solucionado',
    createdAt: '2026-10-12T12:00:00.000Z',
    reportDate: '2026-10-12',
    reportMonth: '2026-10',
    updatedAt: '2026-10-14T12:00:00.000Z',
    resolvedAt: '2026-10-14T12:00:00.000Z'
  }
];

test('toAsuncionDateKey and toAsuncionMonthKey extract YYYY-MM-DD and YYYY-MM reliably', () => {
  assert.equal(toAsuncionDateKey('2026-11-13T15:00:00.000Z'), '2026-11-13');
  assert.equal(toAsuncionMonthKey('2026-11-13T15:00:00.000Z'), '2026-11');
  assert.equal(formatMonthLabelEs('2026-11'), 'Noviembre 2026');
  assert.equal(formatMonthLabelEs('2026-02'), 'Febrero 2026');
});

test('getAvailableReportMonths aggregates unique months in descending order with counts', () => {
  const months = getAvailableReportMonths(SAMPLE_REPORTS);
  assert.deepEqual(months, [
    { value: '2026-11', label: 'Noviembre 2026', count: 1 },
    { value: '2026-10', label: 'Octubre 2026', count: 2 }
  ]);
});

test('filterAdminReports filters accurately by exact date, month, and active/solved tab', () => {
  // Exact date filter in activos
  const nov13 = filterAdminReports(SAMPLE_REPORTS, {
    tab: 'activos',
    category: 'Todas',
    status: 'Todos',
    barrio: 'Todos',
    searchQuery: '',
    filterDate: '2026-11-13',
    filterMonth: ''
  });
  assert.equal(nov13.length, 1);
  assert.equal(nov13[0].id, 'ASU-2026-001');

  // Month filter in activos
  const octActive = filterAdminReports(SAMPLE_REPORTS, {
    tab: 'activos',
    category: 'Todas',
    status: 'Todos',
    barrio: 'Todos',
    searchQuery: '',
    filterDate: '',
    filterMonth: '2026-10'
  });
  assert.equal(octActive.length, 1);
  assert.equal(octActive[0].id, 'ASU-2026-002');

  // Month filter in solucionados
  const octSolved = filterAdminReports(SAMPLE_REPORTS, {
    tab: 'solucionados',
    category: 'Todas',
    status: 'Todos',
    barrio: 'Todos',
    searchQuery: '',
    filterDate: '',
    filterMonth: '2026-10'
  });
  assert.equal(octSolved.length, 1);
  assert.equal(octSolved[0].id, 'ASU-2026-003');
});
