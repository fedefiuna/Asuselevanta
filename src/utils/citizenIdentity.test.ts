import test from 'node:test';
import assert from 'node:assert/strict';
import { isSameCitizen, citizenIdentifier, groupingKey } from './citizenIdentity.ts';
import { calculateCitizenContribution, getLeaderboard } from './contributionUtils.ts';
import type { IncidentReport } from '../types.ts';

const mk = (id: string, name: string, key: string | undefined, status: IncidentReport['status'], idMasked?: string) =>
  ({
    id, category: 'Bache', description: '', photoUrl: '', location: { lat: 0, lng: 0, address: '', barrio: 'Villa Morra' },
    citizenName: name, citizenKey: key, citizenId: idMasked, severity: 'Media', status,
    createdAt: '2026-11-01T10:00:00.000Z', updatedAt: '2026-11-01T10:00:00.000Z'
  }) as IncidentReport;

test('dos "Juan" con claves distintas no se mezclan en ranking ni en contribución', () => {
  const reports = [
    mk('1', 'Juan', 'k-ana', 'Solucionado', '••••123'),
    mk('2', 'Juan', 'k-ana', 'En revisión', '••••123'),
    mk('3', 'Juan', 'k-otro', 'Pendiente', '••••999')
  ];
  const lb = getLeaderboard(reports);
  assert.equal(lb.length, 2);
  assert.equal(lb[0].displayName, 'Juan ••••123');
  assert.equal(lb[0].validatedCount, 2);
  assert.equal(lb[1].displayName, 'Juan ••••999');
  assert.equal(calculateCitizenContribution('k-ana', reports).totalSubmittedCount, 2);
  assert.equal(calculateCitizenContribution('k-otro', reports).totalSubmittedCount, 1);
});

test('sin clave se mantiene el comportamiento por nombre', () => {
  const r = mk('1', 'Ana Gómez', undefined, 'Pendiente');
  assert.equal(isSameCitizen(r, 'ana gómez'), true);
  assert.equal(isSameCitizen(r, 'Otro'), false);
  assert.equal(groupingKey(r), 'name:ana gómez');
});

test('citizenIdentifier prefiere la clave', () => {
  assert.equal(citizenIdentifier({ fullName: 'Ana', citizenKey: 'k' }), 'k');
  assert.equal(citizenIdentifier({ fullName: 'Ana' }), 'Ana');
  assert.equal(citizenIdentifier(null), undefined);
});
