import crypto from 'node:crypto';
import type { IncidentReport } from '../src/types.ts';

/** Primer nombre del ciudadano ("Juan Carlos Benítez" -> "Juan"). */
export function firstName(fullName: string | null | undefined): string {
  const first = (fullName || '').trim().split(/\s+/)[0];
  return first || 'Vecino';
}

/** Muestra solo los últimos 3 dígitos de la cédula ("4567123" -> "••••123"). */
export function maskCI(ci: string | null | undefined): string | undefined {
  const digits = (ci || '').replace(/\D/g, '');
  if (!digits) return undefined;
  return `••••${digits.slice(-3)}`;
}

/**
 * Identificador opaco y estable por ciudadano. Es un HMAC (no un hash simple)
 * porque las cédulas tienen pocas combinaciones y un hash simple se invertiría
 * probándolas todas. Permite agrupar el ranking y reconocer "mis reportes" en el
 * navegador sin exponer la cédula.
 */
export function citizenKey(secret: string, citizenId: string | null | undefined, fallbackName = ''): string {
  const basis = citizenId && citizenId.trim() ? `ci:${citizenId.trim()}` : `name:${fallbackName.trim().toLowerCase()}`;
  return crypto.createHmac('sha256', secret).update(basis).digest('hex').slice(0, 16);
}

/** Reporte para el público: sin teléfono, con primer nombre y cédula enmascarada. */
export function toPublicReport(report: IncidentReport, secret: string): IncidentReport {
  const fullName = report.citizenName;
  const publicName = firstName(fullName);
  return {
    ...report,
    citizenKey: citizenKey(secret, report.citizenId, fullName),
    citizenName: publicName,
    citizenId: maskCI(report.citizenId),
    citizenPhone: undefined,
    // El historial registra al ciudadano como autor del alta: también se abrevia.
    statusHistory: report.statusHistory?.map((h) =>
      h.changedBy.trim() === fullName.trim() ? { ...h, changedBy: publicName } : h
    )
  };
}

/** Reporte para administradores: datos completos (+ clave para agrupar igual que el público). */
export function toAdminReport(report: IncidentReport, secret: string): IncidentReport {
  return { ...report, citizenKey: citizenKey(secret, report.citizenId, report.citizenName) };
}

export function serializeReport(report: IncidentReport, isAdmin: boolean, secret: string): IncidentReport {
  return isAdmin ? toAdminReport(report, secret) : toPublicReport(report, secret);
}
