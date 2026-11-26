import { isSameCitizen, groupingKey } from './citizenIdentity';
import { IncidentReport } from '../types';

export type ContributionBadgeId = 
  | 'first_step'
  | 'active_voice'
  | 'urban_guardian'
  | 'city_pillar'
  | 'first_solution'
  | 'critical_eye'
  | 'barrio_explorer';

export interface ContributionBadge {
  id: ContributionBadgeId;
  name: string;
  icon: string;
  tier: 'bronze' | 'silver' | 'gold' | 'diamond' | 'emerald';
  description: string;
  requirementDesc: string;
  isUnlocked: boolean;
  progress: number; // 0 - 100
  progressText: string;
}

export interface ContributionLevelInfo {
  levelNumber: number;
  levelTitle: string;
  levelBadgeIcon: string;
  levelTag: string;
  levelColor: string; // Tailwind color name / classes
  currentValidatedCount: number;
  totalSubmittedCount: number;
  solvedCount: number;
  inReviewCount: number;
  pendingCount: number;
  nextLevelTitle?: string;
  reportsNeededForNextLevel: number;
  levelProgressPercent: number; // 0 to 100
  badges: ContributionBadge[];
  unlockedBadgesCount: number;
}

/**
 * Checks if a report is considered "validated" by municipal oversight
 * (either currently in review by technical crews or resolved).
 */
export function isReportValidated(report: IncidentReport): boolean {
  return report.status === 'En revisión' || report.status === 'Solucionado';
}

/**
 * Computes level title, requirements, and progress from validated report count.
 */
export function getLevelMeta(validatedCount: number): {
  levelNumber: number;
  levelTitle: string;
  levelBadgeIcon: string;
  levelTag: string;
  levelColor: string;
  nextLevelTitle?: string;
  reportsNeededForNextLevel: number;
  levelProgressPercent: number;
} {
  if (validatedCount >= 10) {
    return {
      levelNumber: 4,
      levelTitle: 'Nivel 4',
      levelBadgeIcon: '💎',
      levelTag: 'Nivel 4',
      levelColor: 'from-cyan-500 to-blue-600',
      nextLevelTitle: undefined,
      reportsNeededForNextLevel: 0,
      levelProgressPercent: 100
    };
  }

  if (validatedCount >= 5) {
    const needed = 10 - validatedCount;
    const progress = Math.min(100, Math.round(((validatedCount - 5) / 5) * 100));
    return {
      levelNumber: 3,
      levelTitle: 'Nivel 3',
      levelBadgeIcon: '🥇',
      levelTag: 'Nivel 3',
      levelColor: 'from-amber-500 to-amber-700',
      nextLevelTitle: 'Nivel 4',
      reportsNeededForNextLevel: needed,
      levelProgressPercent: progress
    };
  }

  if (validatedCount >= 2) {
    const needed = 5 - validatedCount;
    const progress = Math.min(100, Math.round(((validatedCount - 2) / 3) * 100));
    return {
      levelNumber: 2,
      levelTitle: 'Nivel 2',
      levelBadgeIcon: '🥈',
      levelTag: 'Nivel 2',
      levelColor: 'from-slate-400 to-zinc-600',
      nextLevelTitle: 'Nivel 3',
      reportsNeededForNextLevel: needed,
      levelProgressPercent: progress
    };
  }

  // Level 1: 0 or 1 validated report
  const needed = 2 - validatedCount;
  const progress = Math.min(100, Math.round((validatedCount / 2) * 100));
  return {
    levelNumber: 1,
    levelTitle: 'Nivel 1',
    levelBadgeIcon: '🥉',
    levelTag: 'Nivel 1',
    levelColor: 'from-amber-600 to-amber-800',
    nextLevelTitle: 'Nivel 2',
    reportsNeededForNextLevel: needed,
    levelProgressPercent: progress
  };
}

/**
 * Calculates badges awarded to the citizen according to reports data.
 */
export function evaluateBadges(citizenReports: IncidentReport[]): ContributionBadge[] {
  const totalCount = citizenReports.length;
  const validatedReports = citizenReports.filter(isReportValidated);
  const validatedCount = validatedReports.length;
  const solvedCount = citizenReports.filter(r => r.status === 'Solucionado').length;
  const highSeverityCount = citizenReports.filter(r => r.severity === 'Alta' || r.severity === 'Crítica').length;
  
  const distinctBarrios = new Set(
    citizenReports.map(r => r.location?.barrio?.trim().toLowerCase()).filter(Boolean)
  );

  return [
    {
      id: 'first_step',
      name: 'Primer Paso Ciudadano',
      icon: '🥉',
      tier: 'bronze',
      description: 'Enviaste tu primer reporte para fiscalizar las calles de Asunción.',
      requirementDesc: 'Realizar al menos 1 reporte',
      isUnlocked: totalCount >= 1,
      progress: Math.min(100, totalCount >= 1 ? 100 : 0),
      progressText: totalCount >= 1 ? '¡Completado!' : '0/1 reporte enviado'
    },
    {
      id: 'active_voice',
      name: 'Voz Activa',
      icon: '🥈',
      tier: 'silver',
      description: '2 de tus reportes fueron validados o asignados a cuadrilla municipal.',
      requirementDesc: 'Tener 2 reportes validados',
      isUnlocked: validatedCount >= 2,
      progress: Math.min(100, Math.round((validatedCount / 2) * 100)),
      progressText: `${Math.min(2, validatedCount)}/2 reportes validados`
    },
    {
      id: 'urban_guardian',
      name: 'Guardián del Asfalto',
      icon: '🥇',
      tier: 'gold',
      description: 'Alcanzaste 5 reportes validados, convirtiéndote en referente vecinal.',
      requirementDesc: 'Tener 5 reportes validados',
      isUnlocked: validatedCount >= 5,
      progress: Math.min(100, Math.round((validatedCount / 5) * 100)),
      progressText: `${Math.min(5, validatedCount)}/5 reportes validados`
    },
    {
      id: 'city_pillar',
      name: 'Pilar de Asunción',
      icon: '💎',
      tier: 'diamond',
      description: 'Dedicación cívica ejemplar con 10 o más reportes validados.',
      requirementDesc: 'Tener 10 reportes validados',
      isUnlocked: validatedCount >= 10,
      progress: Math.min(100, Math.round((validatedCount / 10) * 100)),
      progressText: `${Math.min(10, validatedCount)}/10 reportes validados`
    },
    {
      id: 'first_solution',
      name: 'Impacto Real',
      icon: '🛠️',
      tier: 'emerald',
      description: 'Un problema vial que reportaste llegó a ser 100% solucionado.',
      requirementDesc: 'Tener 1 reporte con estado "Solucionado"',
      isUnlocked: solvedCount >= 1,
      progress: solvedCount >= 1 ? 100 : 0,
      progressText: solvedCount >= 1 ? '¡Reparación confirmada!' : 'Pendiente de reparación final'
    },
    {
      id: 'critical_eye',
      name: 'Ojo de Águila',
      icon: '⚠️',
      tier: 'gold',
      description: 'Detectaste a tiempo un peligro vial de gravedad Alta o Crítica.',
      requirementDesc: 'Reportar una irregularidad de gravedad Alta o Crítica',
      isUnlocked: highSeverityCount >= 1,
      progress: highSeverityCount >= 1 ? 100 : 0,
      progressText: highSeverityCount >= 1 ? '¡Alerta temprana emitida!' : '0/1 peligro crítico reportado'
    },
    {
      id: 'barrio_explorer',
      name: 'Explorador Barrial',
      icon: '🗺️',
      tier: 'emerald',
      description: 'Fiscalizaste irregularidades en 2 o más barrios distintos de la capital.',
      requirementDesc: 'Reportar en al menos 2 barrios de Asunción',
      isUnlocked: distinctBarrios.size >= 2,
      progress: Math.min(100, Math.round((distinctBarrios.size / 2) * 100)),
      progressText: `${Math.min(2, distinctBarrios.size)}/2 barrios recorridos`
    }
  ];
}

/**
 * Primary pure function: Calculates full contribution metrics for a given citizen.
 */
export function calculateCitizenContribution(
  citizenFullName: string | undefined | null,
  allReports: IncidentReport[]
): ContributionLevelInfo {
  if (!citizenFullName || citizenFullName.trim() === '') {
    const meta = getLevelMeta(0);
    return {
      ...meta,
      currentValidatedCount: 0,
      totalSubmittedCount: 0,
      solvedCount: 0,
      inReviewCount: 0,
      pendingCount: 0,
      badges: evaluateBadges([]),
      unlockedBadgesCount: 0
    };
  }

  // `citizenFullName` es el identificador del ciudadano: su citizenKey (o el nombre, si no hay clave).
  const citizenReports = allReports.filter(r => isSameCitizen(r, citizenFullName));

  const totalSubmittedCount = citizenReports.length;
  const inReviewCount = citizenReports.filter(r => r.status === 'En revisión').length;
  const solvedCount = citizenReports.filter(r => r.status === 'Solucionado').length;
  const pendingCount = citizenReports.filter(r => r.status === 'Pendiente').length;
  const currentValidatedCount = inReviewCount + solvedCount;

  const meta = getLevelMeta(currentValidatedCount);
  const badges = evaluateBadges(citizenReports);
  const unlockedBadgesCount = badges.filter(b => b.isUnlocked).length;

  return {
    ...meta,
    currentValidatedCount,
    totalSubmittedCount,
    solvedCount,
    inReviewCount,
    pendingCount,
    badges,
    unlockedBadgesCount
  };
}

export interface CitizenLeaderboardEntry {
  rank: number;
  citizenKey?: string;
  citizenName: string;
  /** Nombre listo para mostrar: primer nombre + cédula enmascarada ("Juan ••••123") para distinguir homónimos. */
  displayName: string;
  levelNumber: number;
  levelTitle: string;
  levelBadgeIcon: string;
  validatedCount: number;
  totalReports: number;
  solvedCount: number;
  inReviewCount: number;
  pendingCount: number;
  unlockedBadgesCount: number;
  badges: ContributionBadge[];
  recentBarrios: string[];
  lastReportDate?: string;
}

/**
 * Calculates a live leaderboard ranking of all contributing citizens in Asunción.
 * Sorted primarily by validated reports (which govern Level), then solved cases, then total reports.
 */
export function getLeaderboard(allReports: IncidentReport[]): CitizenLeaderboardEntry[] {
  const citizenMap = new Map<string, { originalName: string; reports: IncidentReport[] }>();

  for (const report of allReports) {
    if (!report.citizenName || report.citizenName.trim() === '') continue;
    const key = groupingKey(report);
    const existing = citizenMap.get(key);
    if (!existing) {
      citizenMap.set(key, { originalName: report.citizenName.trim(), reports: [report] });
    } else {
      existing.reports.push(report);
    }
  }

  const entries: CitizenLeaderboardEntry[] = [];

  for (const [, { originalName, reports }] of citizenMap) {
    // Con clave opaca se calcula por clave; sin ella (datos antiguos) por nombre.
    const identifier = reports[0].citizenKey || originalName;
    const contribution = calculateCitizenContribution(identifier, allReports);
    const sortedReports = [...reports].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    const recentBarrios = Array.from(
      new Set(sortedReports.map(r => r.location.barrio).filter(Boolean))
    ).slice(0, 3);
    const lastReportDate = sortedReports[0]?.createdAt;

    entries.push({
      rank: 0,
      citizenKey: reports[0].citizenKey,
      citizenName: originalName,
      displayName: reports[0].citizenId && /•/.test(reports[0].citizenId)
        ? `${originalName} ${reports[0].citizenId}`
        : originalName,
      levelNumber: contribution.levelNumber,
      levelTitle: contribution.levelTitle,
      levelBadgeIcon: contribution.levelBadgeIcon,
      validatedCount: contribution.currentValidatedCount,
      totalReports: contribution.totalSubmittedCount,
      solvedCount: contribution.solvedCount,
      inReviewCount: contribution.inReviewCount,
      pendingCount: contribution.pendingCount,
      unlockedBadgesCount: contribution.unlockedBadgesCount,
      badges: contribution.badges,
      recentBarrios,
      lastReportDate
    });
  }

  // Sort: Validated DESC -> Solved DESC -> Total DESC -> Most Recent DESC
  entries.sort((a, b) => {
    if (b.validatedCount !== a.validatedCount) {
      return b.validatedCount - a.validatedCount;
    }
    if (b.solvedCount !== a.solvedCount) {
      return b.solvedCount - a.solvedCount;
    }
    if (b.totalReports !== a.totalReports) {
      return b.totalReports - a.totalReports;
    }
    return new Date(b.lastReportDate || 0).getTime() - new Date(a.lastReportDate || 0).getTime();
  });

  // Assign ranks
  entries.forEach((entry, idx) => {
    entry.rank = idx + 1;
  });

  return entries;
}
