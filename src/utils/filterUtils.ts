import { isSameCitizen } from './citizenIdentity';
import { IncidentReport, IncidentCategory, IncidentStatus } from '../types';
import { isLocationInAsuncion } from './geoUtils';

export type DatePreset = 'all' | 'today' | '7days' | '30days' | 'this_month' | 'custom';

export interface PublicMapFilterOptions {
  selectedCategories: Set<IncidentCategory>;
  datePreset: DatePreset;
  customStartDate?: string; // YYYY-MM-DD
  customEndDate?: string;   // YYYY-MM-DD
  barrio?: string | 'Todos';
  status?: IncidentStatus | 'Todos';
  owner?: 'all' | 'mine';
  citizenFullName?: string;
  onlyInAsuncion?: boolean; // defaults to true for the public map
}

/**
 * Checks whether an ISO date string falls into the requested date filter.
 */
export function isDateInPresetRange(
  isoDateStr: string,
  preset: DatePreset,
  customStart?: string,
  customEnd?: string,
  nowMs: number = Date.now()
): boolean {
  if (preset === 'all') return true;

  const targetDate = new Date(isoDateStr);
  const targetTime = targetDate.getTime();
  if (isNaN(targetTime)) return false;

  const now = new Date(nowMs);

  switch (preset) {
    case 'today': {
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const endOfToday = startOfToday + 24 * 3600 * 1000 - 1;
      return targetTime >= startOfToday && targetTime <= endOfToday;
    }
    case '7days': {
      const sevenDaysAgo = nowMs - 7 * 24 * 3600 * 1000;
      return targetTime >= sevenDaysAgo && targetTime <= nowMs + 60000;
    }
    case '30days': {
      const thirtyDaysAgo = nowMs - 30 * 24 * 3600 * 1000;
      return targetTime >= thirtyDaysAgo && targetTime <= nowMs + 60000;
    }
    case 'this_month': {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      return targetTime >= startOfMonth && targetTime <= nowMs + 60000;
    }
    case 'custom': {
      if (!customStart && !customEnd) return true;
      if (customStart) {
        const start = new Date(`${customStart}T00:00:00`).getTime();
        if (!isNaN(start) && targetTime < start) return false;
      }
      if (customEnd) {
        const end = new Date(`${customEnd}T23:59:59.999`).getTime();
        if (!isNaN(end) && targetTime > end) return false;
      }
      return true;
    }
    default:
      return true;
  }
}

/**
 * Filters incident reports according to categories, date range, barrio, status, and Asunción boundary.
 */
export function filterPublicReports(
  reports: IncidentReport[],
  options: PublicMapFilterOptions,
  nowMs: number = Date.now()
): IncidentReport[] {
  const {
    selectedCategories,
    datePreset,
    customStartDate,
    customEndDate,
    barrio = 'Todos',
    status = 'Todos',
    owner = 'all',
    citizenFullName,
    onlyInAsuncion = true
  } = options;

  return reports.filter((r) => {
    // 1. Boundary check: must be strictly inside Asunción for the public map
    if (onlyInAsuncion) {
      const inAsuncion = isLocationInAsuncion(r.location.lat, r.location.lng);
      if (!inAsuncion) {
        return false;
      }
    }

    // 2. Category toggle check (must be in selected set)
    if (selectedCategories.size > 0 && !selectedCategories.has(r.category)) {
      return false;
    }

    // 3. Date check
    if (!isDateInPresetRange(r.createdAt, datePreset, customStartDate, customEndDate, nowMs)) {
      return false;
    }

    // 4. Barrio check
    if (barrio !== 'Todos' && r.location.barrio !== barrio) {
      return false;
    }

    // 5. Status check
    if (status !== 'Todos' && r.status !== status) {
      return false;
    }

    // 6. Owner check
    if (owner === 'mine' && citizenFullName) {
      if (!isSameCitizen(r, citizenFullName)) {
        return false;
      }
    }

    return true;
  });
}
