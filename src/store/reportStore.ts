import { IncidentReport, IncidentStatus, IncidentCategory, ReportFilter } from '../types';
import { getAuthHeaders } from './userStore';
import { toAsuncionDateKey, toAsuncionMonthKey } from '../utils/dateFilterUtils';
import * as XLSX from 'xlsx';

type Listener = (reports: IncidentReport[]) => void;
const listeners = new Set<Listener>();

let reportsState: IncidentReport[] = [];
let initPromise: Promise<IncidentReport[]> | null = null;

function notify() {
  listeners.forEach((fn) => fn(reportsState));
}

export function getReportHistory(report: IncidentReport) {
  if (report.statusHistory && report.statusHistory.length > 0) {
    return report.statusHistory;
  }
  return [
    {
      id: `${report.id}-init`,
      timestamp: report.createdAt,
      newStatus: report.status,
      changedBy: report.citizenName || 'Ciudadano',
      notes: report.resolutionNotes || 'Reporte registrado en plataforma ciudadana.'
    }
  ];
}

export const reportStore = {
  async refresh(filters?: { date?: string; month?: string }): Promise<IncidentReport[]> {
    if (typeof window === 'undefined' || typeof fetch === 'undefined') {
      return reportsState;
    }
    try {
      const params = new URLSearchParams();
      if (filters?.date) params.set('date', filters.date);
      if (filters?.month) params.set('month', filters.month);
      const qs = params.toString();
      const res = await fetch(`/api/reports${qs ? `?${qs}` : ''}`, {
        headers: getAuthHeaders(),
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.reports)) {
          reportsState = data.reports;
          notify();
        }
      }
    } catch (err) {
      console.error('Failed loading reports from SQLite API:', err);
    }
    return reportsState;
  },

  init(): Promise<IncidentReport[]> {
    if (!initPromise) {
      initPromise = this.refresh();
    }
    return initPromise;
  },

  getReports(): IncidentReport[] {
    return reportsState;
  },

  async addReport(
    data: Omit<IncidentReport, 'id' | 'createdAt' | 'updatedAt' | 'status'>
  ): Promise<IncidentReport> {
    const res = await fetch('/api/reports', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      credentials: 'include',
      body: JSON.stringify(data)
    });

    const payload = await res.json();
    if (!res.ok || !payload.report) {
      throw new Error(payload.error || 'No se pudo guardar el reporte en SQLite.');
    }

    const created: IncidentReport = payload.report;
    reportsState = [created, ...reportsState];
    notify();
    return created;
  },

  async updateStatus(
    id: string,
    newStatus: IncidentStatus,
    notes?: string,
    changedBy?: string
  ): Promise<boolean> {
    const res = await fetch(`/api/reports/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      credentials: 'include',
      body: JSON.stringify({ status: newStatus, notes, changedBy })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      console.error('Error updating report status in SQLite:', errData.error || res.status);
      return false;
    }

    const payload = await res.json();
    if (payload.report) {
      reportsState = reportsState.map((r) => (r.id === id ? payload.report : r));
      notify();
    }
    return true;
  },

  async bulkUpdateStatus(
    ids: string[],
    newStatus: IncidentStatus,
    notes?: string
  ): Promise<number> {
    if (!ids || ids.length === 0) return 0;

    const res = await fetch('/api/reports/bulk-status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      credentials: 'include',
      body: JSON.stringify({ ids, status: newStatus, notes })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      console.error('Error in bulk update in SQLite:', errData.error || res.status);
      return 0;
    }

    const payload = await res.json();
    if (Array.isArray(payload.reports)) {
      reportsState = payload.reports;
      notify();
    }
    return Number(payload.updatedCount || 0);
  },

  async deleteReport(id: string): Promise<boolean> {
    const res = await fetch(`/api/reports/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
      credentials: 'include'
    });
    if (!res.ok) return false;
    reportsState = reportsState.filter((r) => r.id !== id);
    notify();
    return true;
  },

  subscribe(listener: Listener) {
    listeners.add(listener);
    listener(reportsState);
    return () => {
      listeners.delete(listener);
    };
  },

  filterReports(filter: ReportFilter): IncidentReport[] {
    return reportsState.filter((r) => {
      if (filter.category && filter.category !== 'Todas' && r.category !== filter.category) {
        return false;
      }
      if (filter.status && filter.status !== 'Todos' && r.status !== filter.status) {
        return false;
      }
      if (filter.barrio && filter.barrio !== 'Todos' && r.location.barrio !== filter.barrio) {
        return false;
      }
      if (filter.severity && filter.severity !== 'Todas' && r.severity !== filter.severity) {
        return false;
      }
      const rDate = r.reportDate || toAsuncionDateKey(r.createdAt);
      const rMonth = r.reportMonth || toAsuncionMonthKey(r.createdAt);
      if (filter.date && rDate !== filter.date) {
        return false;
      }
      if (filter.month && rMonth !== filter.month) {
        return false;
      }
      if (filter.searchQuery && filter.searchQuery.trim() !== '') {
        const q = filter.searchQuery.toLowerCase();
        const match =
          r.id.toLowerCase().includes(q) ||
          r.citizenName.toLowerCase().includes(q) ||
          r.location.address.toLowerCase().includes(q) ||
          r.location.barrio.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  },

  getMetrics(sourceReports: IncidentReport[] = reportsState) {
    const total = sourceReports.length;
    const resolved = sourceReports.filter((r) => r.status === 'Solucionado').length;
    const pending = sourceReports.filter((r) => r.status === 'Pendiente').length;
    const inReview = sourceReports.filter((r) => r.status === 'En revisión').length;

    const rate = total > 0 ? Math.round((resolved / total) * 100) : 0;

    const resolvedItems = sourceReports.filter((r) => r.status === 'Solucionado' && r.resolvedAt);
    let avgResolutionHours = 0;
    if (resolvedItems.length > 0) {
      const totalHours = resolvedItems.reduce((acc, item) => {
        const created = new Date(item.createdAt).getTime();
        const resolvedTime = new Date(item.resolvedAt!).getTime();
        const diffHours = Math.max(1, (resolvedTime - created) / (1000 * 3600));
        return acc + diffHours;
      }, 0);
      avgResolutionHours = Math.round((totalHours / resolvedItems.length) * 10) / 10;
    } else {
      avgResolutionHours = 48.0;
    }

    const avgResolutionDays = (avgResolutionHours / 24).toFixed(1);

    const categories: IncidentCategory[] = [
      'Bache',
      'Badén en mal estado',
      'Alcantarilla sin tapa',
      'Suciedad / Basura'
    ];
    const categoryStats = categories.map((cat) => {
      const count = sourceReports.filter((r) => r.category === cat).length;
      const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
      return { category: cat, count, percentage };
    });

    const barrioMap: Record<string, number> = {};
    sourceReports.forEach((r) => {
      barrioMap[r.location.barrio] = (barrioMap[r.location.barrio] || 0) + 1;
    });

    const barrioStats = Object.entries(barrioMap)
      .map(([barrio, count]) => ({
        barrio,
        count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0
      }))
      .sort((a, b) => b.count - a.count);

    return {
      total,
      resolved,
      pending,
      inReview,
      rate,
      avgResolutionHours,
      avgResolutionDays,
      categoryStats,
      barrioStats
    };
  },

  exportToExcel(targetReports: IncidentReport[] = reportsState) {
    const data = targetReports.map((r) => ({
      'Código Incidencia': r.id,
      'Categoría': r.category,
      'Estado': r.status,
      'Gravedad': r.severity,
      'Barrio (Asunción)': r.location.barrio,
      'Dirección / Cruce': r.location.address,
      'Latitud': r.location.lat,
      'Longitud': r.location.lng,
      'Ciudadano Reportante': r.citizenName,
      'C.I. Ciudadano': r.citizenId || 'N/D',
      'Teléfono Contacto': r.citizenPhone || 'N/D',
      'Fecha (YYYY-MM-DD)': r.reportDate || toAsuncionDateKey(r.createdAt),
      'Mes (YYYY-MM)': r.reportMonth || toAsuncionMonthKey(r.createdAt),
      'Fecha y Hora Reporte': new Date(r.createdAt).toLocaleString('es-PY'),
      'Última Actualización': new Date(r.updatedAt).toLocaleString('es-PY'),
      'Descripción': r.description,
      'Notas de Resolución': r.resolutionNotes || 'Sin notas registradas'
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Reportes Asuncion');

    const maxCols = [15, 22, 14, 12, 18, 30, 12, 12, 22, 14, 15, 16, 14, 22, 22, 40, 30];
    worksheet['!cols'] = maxCols.map((wch) => ({ wch }));

    const dateStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `Reportes_Asuncion_Se_Levanta_${dateStr}.xlsx`);
  },

  exportToPDF() {
    window.print();
  }
};

if (typeof window !== 'undefined') {
  reportStore.init();
}
