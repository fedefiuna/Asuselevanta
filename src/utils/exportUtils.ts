import { IncidentReport, IncidentCategory, IncidentStatus } from '../types';

/**
 * Escapes a cell value for RFC-4180 CSV compliance.
 */
export function escapeCSVCell(value: unknown): string {
  if (value === null || value === undefined) {
    return '""';
  }
  const str = String(value);
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}

export interface ExportFilterSummary {
  category?: IncidentCategory | 'Todas';
  status?: IncidentStatus | 'Todos';
  barrio?: string;
  owner?: 'all' | 'mine';
}

/**
 * Generates an RFC-4180 CSV string with UTF-8 BOM for Spanish character support in Excel.
 */
export function generateCSV(reports: IncidentReport[]): string {
  const BOM = '\uFEFF';
  const headers = [
    'Código Incidencia',
    'Categoría',
    'Estado',
    'Gravedad',
    'Barrio',
    'Dirección / Cruce',
    'Latitud',
    'Longitud',
    'Ciudadano Reportante',
    'Fecha de Reporte',
    'Última Actualización',
    'Fecha de Resolución',
    'Descripción',
    'Bitácora / Notas Municipales'
  ];

  const rows = reports.map((r) => [
    r.id,
    r.category,
    r.status,
    r.severity,
    r.location.barrio,
    r.location.address,
    r.location.lat,
    r.location.lng,
    r.citizenName,
    new Date(r.createdAt).toLocaleString('es-PY'),
    new Date(r.updatedAt).toLocaleString('es-PY'),
    r.resolvedAt ? new Date(r.resolvedAt).toLocaleString('es-PY') : 'Pendiente',
    r.description,
    r.resolutionNotes || 'Sin notas registradas'
  ]);

  const csvContent = [
    headers.map(escapeCSVCell).join(','),
    ...rows.map((row) => row.map(escapeCSVCell).join(','))
  ].join('\r\n');

  return BOM + csvContent;
}

/**
 * Initiates download of the CSV file in the browser.
 */
export function downloadCSV(reports: IncidentReport[], filename?: string): void {
  const csvData = generateCSV(reports);
  const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateStr = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = filename || `Transparencia_Vial_Asuncion_${dateStr}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export interface TransparencyReportStats {
  total: number;
  solved: number;
  inReview: number;
  pending: number;
  solvedRate: number;
  categoryBreakdown: Record<string, number>;
  barrioBreakdown: Record<string, number>;
}

/**
 * Pure function to compute stats for the filtered reports.
 */
export function computeTransparencyStats(reports: IncidentReport[]): TransparencyReportStats {
  const total = reports.length;
  const solved = reports.filter((r) => r.status === 'Solucionado').length;
  const inReview = reports.filter((r) => r.status === 'En revisión').length;
  const pending = reports.filter((r) => r.status === 'Pendiente').length;
  const solvedRate = total > 0 ? Math.round((solved / total) * 100) : 0;

  const categoryBreakdown: Record<string, number> = {};
  const barrioBreakdown: Record<string, number> = {};

  reports.forEach((r) => {
    categoryBreakdown[r.category] = (categoryBreakdown[r.category] || 0) + 1;
    barrioBreakdown[r.location.barrio] = (barrioBreakdown[r.location.barrio] || 0) + 1;
  });

  return {
    total,
    solved,
    inReview,
    pending,
    solvedRate,
    categoryBreakdown,
    barrioBreakdown
  };
}

/**
 * Triggers printing of the consolidated transparency report in the current browser window.
 */
export function printConsolidatedReport(): void {
  window.print();
}
