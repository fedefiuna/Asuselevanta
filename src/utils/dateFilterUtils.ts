import { IncidentCategory, IncidentReport, IncidentStatus } from '../types';

const ASUNCION_DATE_FMT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Asuncion',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

const SPANISH_MONTH_NAMES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre'
];

/**
 * Extracts YYYY-MM-DD in America/Asuncion timezone from an ISO timestamp or Date.
 */
export function toAsuncionDateKey(input: string | Date): string {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) {
    if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}/.test(input)) {
      return input.slice(0, 10);
    }
    return '';
  }
  return ASUNCION_DATE_FMT.format(date);
}

/**
 * Extracts YYYY-MM in America/Asuncion timezone from an ISO timestamp or Date.
 */
export function toAsuncionMonthKey(input: string | Date): string {
  const dateKey = toAsuncionDateKey(input);
  return dateKey ? dateKey.slice(0, 7) : '';
}

/**
 * Formats a YYYY-MM month key into readable Spanish (e.g. '2026-11' -> 'Noviembre 2026').
 */
export function formatMonthLabelEs(monthKey: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey.trim());
  if (!match) return monthKey;
  const year = match[1];
  const monthIdx = Number(match[2]) - 1;
  const monthName = SPANISH_MONTH_NAMES[monthIdx];
  if (!monthName) return monthKey;
  return `${monthName} ${year}`;
}

export interface MonthOption {
  value: string; // YYYY-MM
  label: string;
  count: number;
}

/**
 * Computes sorted unique months (descending) present in a report collection.
 */
export function getAvailableReportMonths(reports: IncidentReport[]): MonthOption[] {
  const counts = new Map<string, number>();

  for (const r of reports) {
    const m = r.reportMonth || toAsuncionMonthKey(r.createdAt);
    if (m) {
      counts.set(m, (counts.get(m) || 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([value, count]) => ({
      value,
      label: formatMonthLabelEs(value),
      count
    }));
}

export interface AdminFilterCriteria {
  tab: 'activos' | 'solucionados';
  category: IncidentCategory | 'Todas';
  status: IncidentStatus | 'Todos';
  barrio: string | 'Todos';
  searchQuery: string;
  filterDate: string; // YYYY-MM-DD or ''
  filterMonth: string; // YYYY-MM or ''
}

/**
 * Filters reports for the Admin Dashboard across active/solved pool, category, status,
 * barrio, free-text search, exact date (YYYY-MM-DD), and month (YYYY-MM).
 */
export function filterAdminReports(
  reports: IncidentReport[],
  criteria: AdminFilterCriteria
): IncidentReport[] {
  const pool =
    criteria.tab === 'activos'
      ? reports.filter((r) => r.status !== 'Solucionado')
      : reports.filter((r) => r.status === 'Solucionado');

  const query = criteria.searchQuery.trim().toLowerCase();
  const targetDate = criteria.filterDate.trim();
  const targetMonth = criteria.filterMonth.trim();

  return pool.filter((r) => {
    if (criteria.category !== 'Todas' && r.category !== criteria.category) return false;
    if (criteria.tab === 'activos' && criteria.status !== 'Todos' && r.status !== criteria.status) {
      return false;
    }
    if (criteria.barrio !== 'Todos' && r.location.barrio !== criteria.barrio) return false;

    const rDate = r.reportDate || toAsuncionDateKey(r.createdAt);
    const rMonth = r.reportMonth || toAsuncionMonthKey(r.createdAt);

    if (targetDate && rDate !== targetDate) return false;
    if (targetMonth && rMonth !== targetMonth) return false;

    if (query !== '') {
      const matches =
        r.id.toLowerCase().includes(query) ||
        r.citizenName.toLowerCase().includes(query) ||
        (r.citizenId && r.citizenId.toLowerCase().includes(query)) ||
        r.location.address.toLowerCase().includes(query) ||
        r.location.barrio.toLowerCase().includes(query) ||
        r.description.toLowerCase().includes(query) ||
        (r.resolutionNotes && r.resolutionNotes.toLowerCase().includes(query));
      if (!matches) return false;
    }

    return true;
  });
}
