import { IncidentReport, IncidentCategory, IncidentStatus } from '../types';

export interface CategoryStatusMetric {
  category: IncidentCategory;
  displayName: string;
  shortName: string;
  icon: string;
  Pendiente: number;
  'En revisión': number;
  Solucionado: number;
  total: number;
  resolutionRate: number; // 0 to 100
}

export interface StatusSummaryMetric {
  status: IncidentStatus;
  count: number;
  percentage: number;
  color: string;
}

export const CATEGORY_META: Record<IncidentCategory, { shortName: string; icon: string }> = {
  'Bache': { shortName: 'Bache', icon: '🕳️' },
  'Badén en mal estado': { shortName: 'Badén', icon: '〰️' },
  'Alcantarilla sin tapa': { shortName: 'Alcantarilla', icon: '⚠️' },
  'Suciedad / Basura': { shortName: 'Basura', icon: '🗑️' }
};

export const ALL_CATEGORIES: IncidentCategory[] = [
  'Bache',
  'Badén en mal estado',
  'Alcantarilla sin tapa',
  'Suciedad / Basura'
];

/**
 * Computes report counts per category grouped by their repair status.
 */
export function calculateCategoryStatusMetrics(reports: IncidentReport[]): CategoryStatusMetric[] {
  return ALL_CATEGORIES.map((cat) => {
    const categoryReports = reports.filter((r) => r.category === cat);
    const pendiente = categoryReports.filter((r) => r.status === 'Pendiente').length;
    const enRevision = categoryReports.filter((r) => r.status === 'En revisión').length;
    const solucionado = categoryReports.filter((r) => r.status === 'Solucionado').length;
    const total = categoryReports.length;
    const resolutionRate = total > 0 ? Math.round((solucionado / total) * 100) : 0;

    return {
      category: cat,
      displayName: cat,
      shortName: CATEGORY_META[cat]?.shortName || cat,
      icon: CATEGORY_META[cat]?.icon || '📍',
      Pendiente: pendiente,
      'En revisión': enRevision,
      Solucionado: solucionado,
      total,
      resolutionRate
    };
  });
}

/**
 * Computes overall status counts and percentages.
 */
export function calculateStatusDistribution(reports: IncidentReport[]): StatusSummaryMetric[] {
  const total = reports.length;
  const statuses: { status: IncidentStatus; color: string }[] = [
    { status: 'Solucionado', color: '#10b981' },
    { status: 'En revisión', color: '#3b82f6' },
    { status: 'Pendiente', color: '#f59e0b' }
  ];

  return statuses.map(({ status, color }) => {
    const count = reports.filter((r) => r.status === status).length;
    const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
    return {
      status,
      count,
      percentage,
      color
    };
  });
}
