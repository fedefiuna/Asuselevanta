import test from 'node:test';
import assert from 'node:assert/strict';
import { isDateInPresetRange, filterPublicReports } from './filterUtils.js';
import { IncidentReport, IncidentCategory } from '../types.js';

const nowMs = new Date('2026-11-11T12:00:00.000Z').getTime();

const sampleReports: IncidentReport[] = [
  {
    id: 'ASU-1',
    category: 'Bache',
    description: 'Bache 1',
    photoUrl: 'url1',
    location: {
      lat: -25.2974, // Villa Morra (Inside Asunción)
      lng: -57.5882,
      address: 'Mcal López',
      barrio: 'Villa Morra'
    },
    citizenName: 'Juan Pérez',
    severity: 'Alta',
    status: 'Pendiente',
    createdAt: new Date(nowMs - 2 * 3600 * 1000).toISOString(), // 2 hours ago (Today)
    updatedAt: new Date(nowMs - 2 * 3600 * 1000).toISOString()
  },
  {
    id: 'ASU-2',
    category: 'Suciedad / Basura',
    description: 'Basura 2',
    photoUrl: 'url2',
    location: {
      lat: -25.2818, // Centro (Inside Asunción)
      lng: -57.6350,
      address: 'Palma',
      barrio: 'Centro Histórico'
    },
    citizenName: 'María Villalba',
    severity: 'Media',
    status: 'Solucionado',
    createdAt: new Date(nowMs - 5 * 24 * 3600 * 1000).toISOString(), // 5 days ago (Within 7 days)
    updatedAt: new Date(nowMs - 5 * 24 * 3600 * 1000).toISOString()
  },
  {
    id: 'ASU-3',
    category: 'Alcantarilla sin tapa',
    description: 'Alcantarilla 3',
    photoUrl: 'url3',
    location: {
      lat: -25.2825, // Sajonia (Inside Asunción)
      lng: -57.6412,
      address: 'Carlos A. López',
      barrio: 'Sajonia'
    },
    citizenName: 'Carlos Benítez',
    severity: 'Crítica',
    status: 'En revisión',
    createdAt: new Date(nowMs - 20 * 24 * 3600 * 1000).toISOString(), // 20 days ago (Within 30 days)
    updatedAt: new Date(nowMs - 20 * 24 * 3600 * 1000).toISOString()
  },
  {
    id: 'ASU-4-OUTSIDE',
    category: 'Bache',
    description: 'Bache en San Lorenzo (Fuera de Asunción)',
    photoUrl: 'url4',
    location: {
      lat: -25.3390, // San Lorenzo (OUTSIDE Asunción)
      lng: -57.5090,
      address: 'Ruta 2 c/ Avelino Martínez',
      barrio: 'San Lorenzo'
    },
    citizenName: 'Pedro Gómez',
    severity: 'Alta',
    status: 'Pendiente',
    createdAt: new Date(nowMs - 1 * 3600 * 1000).toISOString(),
    updatedAt: new Date(nowMs - 1 * 3600 * 1000).toISOString()
  }
];

test('isDateInPresetRange handles all date presets correctly', () => {
  const todayDate = new Date(nowMs - 3 * 3600 * 1000).toISOString();
  const fiveDaysAgo = new Date(nowMs - 5 * 24 * 3600 * 1000).toISOString();
  const fortyDaysAgo = new Date(nowMs - 40 * 24 * 3600 * 1000).toISOString();

  // All
  assert.equal(isDateInPresetRange(fortyDaysAgo, 'all', undefined, undefined, nowMs), true);

  // Today
  assert.equal(isDateInPresetRange(todayDate, 'today', undefined, undefined, nowMs), true);
  assert.equal(isDateInPresetRange(fiveDaysAgo, 'today', undefined, undefined, nowMs), false);

  // 7 Days
  assert.equal(isDateInPresetRange(fiveDaysAgo, '7days', undefined, undefined, nowMs), true);
  assert.equal(isDateInPresetRange(fortyDaysAgo, '7days', undefined, undefined, nowMs), false);

  // 30 Days
  assert.equal(isDateInPresetRange(fiveDaysAgo, '30days', undefined, undefined, nowMs), true);
  assert.equal(isDateInPresetRange(fortyDaysAgo, '30days', undefined, undefined, nowMs), false);

  // Custom
  assert.equal(isDateInPresetRange('2026-11-05T10:00:00Z', 'custom', '2026-11-01', '2026-11-10', nowMs), true);
  assert.equal(isDateInPresetRange('2026-10-25T10:00:00Z', 'custom', '2026-11-01', '2026-11-10', nowMs), false);
});

test('filterPublicReports excludes reports outside Asuncion by default', () => {
  const allCategories: Set<IncidentCategory> = new Set([
    'Bache',
    'Badén en mal estado',
    'Alcantarilla sin tapa',
    'Suciedad / Basura'
  ]);

  const filtered = filterPublicReports(
    sampleReports,
    {
      selectedCategories: allCategories,
      datePreset: 'all',
      onlyInAsuncion: true
    },
    nowMs
  );

  // ASU-4-OUTSIDE must be excluded!
  assert.equal(filtered.length, 3);
  assert.ok(filtered.every(r => r.id !== 'ASU-4-OUTSIDE'));
});

test('filterPublicReports filters by selected incident categories', () => {
  // Only "Bache"
  const onlyBaches: Set<IncidentCategory> = new Set(['Bache']);
  const result = filterPublicReports(
    sampleReports,
    {
      selectedCategories: onlyBaches,
      datePreset: 'all',
      onlyInAsuncion: true
    },
    nowMs
  );

  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'ASU-1');
});

test('filterPublicReports combines category, date preset and barrio', () => {
  const categories: Set<IncidentCategory> = new Set(['Bache', 'Suciedad / Basura']);
  const result = filterPublicReports(
    sampleReports,
    {
      selectedCategories: categories,
      datePreset: '7days',
      barrio: 'Centro Histórico',
      onlyInAsuncion: true
    },
    nowMs
  );

  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'ASU-2');
});
