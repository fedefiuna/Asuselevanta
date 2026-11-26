import test from 'node:test';
import assert from 'node:assert/strict';
import { 
  isReportValidated, 
  getLevelMeta, 
  evaluateBadges, 
  calculateCitizenContribution,
  getLeaderboard
} from './contributionUtils.js';
import { IncidentReport } from '../types.js';

test('isReportValidated identifies validated statuses correctly', () => {
  const pendingReport = { status: 'Pendiente' } as IncidentReport;
  const inReviewReport = { status: 'En revisión' } as IncidentReport;
  const solvedReport = { status: 'Solucionado' } as IncidentReport;

  assert.equal(isReportValidated(pendingReport), false);
  assert.equal(isReportValidated(inReviewReport), true);
  assert.equal(isReportValidated(solvedReport), true);
});

test('getLevelMeta scales through contribution levels accurately', () => {
  // Level 1: 0 validated
  const lvl1_zero = getLevelMeta(0);
  assert.equal(lvl1_zero.levelNumber, 1);
  assert.equal(lvl1_zero.levelTitle, 'Nivel 1');
  assert.equal(lvl1_zero.reportsNeededForNextLevel, 2);
  assert.equal(lvl1_zero.levelProgressPercent, 0);

  // Level 1: 1 validated
  const lvl1_one = getLevelMeta(1);
  assert.equal(lvl1_one.levelNumber, 1);
  assert.equal(lvl1_one.levelTitle, 'Nivel 1');
  assert.equal(lvl1_one.reportsNeededForNextLevel, 1);
  assert.equal(lvl1_one.levelProgressPercent, 50);

  // Level 2: 2 validated
  const lvl2 = getLevelMeta(2);
  assert.equal(lvl2.levelNumber, 2);
  assert.equal(lvl2.levelTitle, 'Nivel 2');
  assert.equal(lvl2.reportsNeededForNextLevel, 3);
  assert.equal(lvl2.levelProgressPercent, 0);

  // Level 3: 5 validated
  const lvl3 = getLevelMeta(5);
  assert.equal(lvl3.levelNumber, 3);
  assert.equal(lvl3.levelTitle, 'Nivel 3');
  assert.equal(lvl3.reportsNeededForNextLevel, 5);

  // Level 4: 10 validated
  const lvl4 = getLevelMeta(10);
  assert.equal(lvl4.levelNumber, 4);
  assert.equal(lvl4.levelTitle, 'Nivel 4');
  assert.equal(lvl4.reportsNeededForNextLevel, 0);
  assert.equal(lvl4.levelProgressPercent, 100);
});

test('calculateCitizenContribution calculates badges and stats for citizen reports', () => {
  const reports: IncidentReport[] = [
    {
      id: 'ASU-1',
      category: 'Bache',
      description: 'Bache profundo',
      photoUrl: 'url',
      location: { lat: -25.2974, lng: -57.5882, address: 'Mcal López', barrio: 'Villa Morra' },
      citizenName: 'Juan Pérez',
      severity: 'Alta',
      status: 'Solucionado',
      createdAt: '2026-11-10T10:00:00Z',
      updatedAt: '2026-11-10T10:00:00Z'
    },
    {
      id: 'ASU-2',
      category: 'Suciedad / Basura',
      description: 'Basural',
      photoUrl: 'url',
      location: { lat: -25.2818, lng: -57.6350, address: 'Palma', barrio: 'Centro Histórico' },
      citizenName: 'Juan Pérez',
      severity: 'Media',
      status: 'En revisión',
      createdAt: '2026-11-10T11:00:00Z',
      updatedAt: '2026-11-10T11:00:00Z'
    },
    {
      id: 'ASU-3',
      category: 'Alcantarilla sin tapa',
      description: 'Alcantarilla rota',
      photoUrl: 'url',
      location: { lat: -25.2825, lng: -57.6412, address: 'Carlos A López', barrio: 'Sajonia' },
      citizenName: 'María Villalba',
      severity: 'Crítica',
      status: 'Pendiente',
      createdAt: '2026-11-10T12:00:00Z',
      updatedAt: '2026-11-10T12:00:00Z'
    }
  ];

  const juanContribution = calculateCitizenContribution('Juan Pérez', reports);

  // Juan has 2 reports (1 Solucionado, 1 En revisión -> 2 validated)
  assert.equal(juanContribution.totalSubmittedCount, 2);
  assert.equal(juanContribution.currentValidatedCount, 2);
  assert.equal(juanContribution.solvedCount, 1);
  assert.equal(juanContribution.inReviewCount, 1);
  assert.equal(juanContribution.pendingCount, 0);

  // Level 2 reached
  assert.equal(juanContribution.levelNumber, 2);
  assert.equal(juanContribution.levelTitle, 'Nivel 2');

  // Badges check
  const badgeMap = Object.fromEntries(juanContribution.badges.map(b => [b.id, b.isUnlocked]));
  assert.equal(badgeMap['first_step'], true, 'Primer Paso Ciudadano should be unlocked');
  assert.equal(badgeMap['active_voice'], true, 'Voz Activa should be unlocked (2 validated)');
  assert.equal(badgeMap['first_solution'], true, 'Impacto Real should be unlocked (1 Solucionado)');
  assert.equal(badgeMap['critical_eye'], true, 'Ojo de Águila should be unlocked (severity Alta)');
  assert.equal(badgeMap['barrio_explorer'], true, 'Explorador Barrial should be unlocked (Villa Morra + Centro)');
  assert.equal(badgeMap['urban_guardian'], false, 'Guardián del Asfalto should be locked (< 5 validated)');
});

test('calculateCitizenContribution gracefully handles null or unknown citizens', () => {
  const result = calculateCitizenContribution(null, []);
  assert.equal(result.levelNumber, 1);
  assert.equal(result.totalSubmittedCount, 0);
  assert.equal(result.unlockedBadgesCount, 0);
});

test('getLeaderboard ranks citizens correctly by validated reports', () => {
  const mockReports: IncidentReport[] = [
    {
      id: 'R1',
      category: 'Bache',
      description: 'D1',
      photoUrl: 'url',
      location: { lat: -25.29, lng: -57.58, address: 'A1', barrio: 'Villa Morra' },
      citizenName: 'Leticia Almada',
      severity: 'Alta',
      status: 'Solucionado',
      createdAt: '2026-11-09T10:00:00Z',
      updatedAt: '2026-11-09T10:00:00Z'
    },
    {
      id: 'R2',
      category: 'Badén en mal estado',
      description: 'D2',
      photoUrl: 'url',
      location: { lat: -25.28, lng: -57.56, address: 'A2', barrio: 'Carmelitas' },
      citizenName: 'Leticia Almada',
      severity: 'Media',
      status: 'En revisión',
      createdAt: '2026-11-10T10:00:00Z',
      updatedAt: '2026-11-10T10:00:00Z'
    },
    {
      id: 'R3',
      category: 'Suciedad / Basura',
      description: 'D3',
      photoUrl: 'url',
      location: { lat: -25.30, lng: -57.60, address: 'A3', barrio: 'Recoleta' },
      citizenName: 'Juan Carlos Benítez',
      severity: 'Media',
      status: 'Pendiente',
      createdAt: '2026-11-10T11:00:00Z',
      updatedAt: '2026-11-10T11:00:00Z'
    }
  ];

  const board = getLeaderboard(mockReports);
  assert.equal(board.length, 2);
  // Leticia has 2 validated -> Rank #1
  assert.equal(board[0].rank, 1);
  assert.equal(board[0].citizenName, 'Leticia Almada');
  assert.equal(board[0].validatedCount, 2);
  assert.equal(board[0].levelNumber, 2);
  assert.equal(board[0].levelTitle, 'Nivel 2');

  // Juan Carlos has 0 validated (1 pending) -> Rank #2
  assert.equal(board[1].rank, 2);
  assert.equal(board[1].citizenName, 'Juan Carlos Benítez');
  assert.equal(board[1].validatedCount, 0);
  assert.equal(board[1].levelNumber, 1);
  assert.equal(board[1].levelTitle, 'Nivel 1');
});
