import type { IncidentReport } from '../types';

/**
 * ¿El reporte pertenece al ciudadano identificado por `identifier`?
 * El identificador es la `citizenKey` que entrega el servidor. Si el reporte no trae
 * clave (datos antiguos o tests), se compara por nombre como antes.
 */
export function isSameCitizen(report: IncidentReport, identifier: string | undefined | null): boolean {
  if (!identifier || identifier.trim() === '') return false;
  if (report.citizenKey) return report.citizenKey === identifier;
  return (report.citizenName || '').trim().toLowerCase() === identifier.trim().toLowerCase();
}

/** Identificador a usar para un ciudadano: su clave opaca si existe, y si no su nombre completo. */
export function citizenIdentifier(citizen: { citizenKey?: string; fullName: string } | null | undefined): string | undefined {
  if (!citizen) return undefined;
  return citizen.citizenKey || citizen.fullName;
}

/** Clave de agrupación para el ranking. */
export function groupingKey(report: IncidentReport): string {
  return report.citizenKey || `name:${(report.citizenName || '').trim().toLowerCase()}`;
}
