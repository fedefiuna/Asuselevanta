import React from 'react';
import { IncidentReport } from '../types';
import { computeTransparencyStats, downloadCSV } from '../utils/exportUtils';
import { 
  FileText, 
  Printer, 
  Download, 
  X, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  ShieldCheck, 
  Filter, 
  Building2,
  Calendar,
  Layers
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  reports: IncidentReport[];
  filterSummary: {
    category: string;
    barrio: string;
    status: string;
    owner: string;
    date?: string;
  };
}

export const CitizenTransparencyReportModal: React.FC<Props> = ({
  isOpen,
  onClose,
  reports,
  filterSummary
}) => {
  if (!isOpen) return null;

  const stats = computeTransparencyStats(reports);
  const emissionDate = new Date().toLocaleString('es-PY', {
    dateStyle: 'long',
    timeStyle: 'medium'
  });
  const auditCode = `ASU-TRP-${Date.now().toString().slice(-6)}`;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadCSV = () => {
    const dateStr = new Date().toISOString().slice(0, 10);
    downloadCSV(reports, `Transparencia_Vial_Asuncion_${dateStr}.csv`);
  };

  // Top 5 barrios by count
  const sortedBarrios = Object.entries(stats.barrioBreakdown)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-2 sm:p-4 backdrop-blur-md overflow-y-auto animate-in fade-in print:p-0 print:bg-white print:static print:backdrop-blur-none">
      <div 
        id="transparency-report-printable"
        className="w-full max-w-5xl rounded-3xl bg-white dark:bg-zinc-900 shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden my-auto max-h-[92vh] flex flex-col text-zinc-900 dark:text-zinc-100 print:max-h-none print:shadow-none print:border-none print:rounded-none print:m-0 print:p-0 print:bg-white print:text-black"
      >
        {/* Modal Top Bar (Hidden on print) */}
        <div className="no-print p-4 sm:px-6 bg-zinc-100 dark:bg-zinc-800/80 border-b border-zinc-200 dark:border-zinc-700/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black">
                Reporte Consolidado de Transparencia Vial
              </h3>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Auditoría pública y datos abiertos en base a los filtros actuales ({reports.length} reportes)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadCSV}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-600 text-zinc-800 dark:text-zinc-100 text-xs font-bold border border-zinc-300 dark:border-zinc-600 shadow-xs transition active:scale-95 cursor-pointer"
              title="Descargar archivo CSV compatible con Excel"
            >
              <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Exportar CSV</span>
            </button>

            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition active:scale-95 cursor-pointer"
              title="Generar e imprimir o guardar PDF"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir / Guardar PDF</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition cursor-pointer"
              aria-label="Cerrar modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Printable Document Body */}
        <div className="p-6 sm:p-8 overflow-y-auto space-y-6 print:overflow-visible print:p-6 print:space-y-4">
          
          {/* Official Document Letterhead */}
          <div className="border-b-2 border-emerald-600 pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-14 h-14 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black text-2xl shadow-md shrink-0 print:border print:border-emerald-800">
                <Building2 className="w-8 h-8" />
              </div>
              <div>
                <span className="text-[11px] font-black tracking-widest uppercase text-emerald-600 dark:text-emerald-400 block print:text-emerald-800">
                  Municipalidad de la Ciudad de Asunción
                </span>
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-zinc-900 dark:text-zinc-50 print:text-black">
                  Reporte Consolidado de Transparencia Vial
                </h1>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 print:text-zinc-600">
                  Plataforma de Contraloría y Fiscalización Ciudadana «Asunción Se Levanta»
                </p>
              </div>
            </div>

            <div className="text-left sm:text-right text-xs text-zinc-600 dark:text-zinc-400 space-y-0.5 print:text-zinc-700">
              <div><strong className="text-zinc-800 dark:text-zinc-200 print:text-black">Emisión:</strong> {emissionDate}</div>
              <div><strong className="text-zinc-800 dark:text-zinc-200 print:text-black">ID Auditoría:</strong> <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 print:text-emerald-800">{auditCode}</span></div>
              <div><strong className="text-zinc-800 dark:text-zinc-200 print:text-black">Alcance:</strong> {reports.length} incidencias registradas</div>
            </div>
          </div>

          {/* Active Filter Criteria Box */}
          <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 p-4 border border-zinc-200 dark:border-zinc-800 text-xs flex flex-wrap items-center justify-between gap-3 print:bg-zinc-100 print:border-zinc-300">
            <div className="flex items-center gap-2 font-bold text-zinc-700 dark:text-zinc-300 print:text-zinc-800">
              <Filter className="w-4 h-4 text-emerald-600 dark:text-emerald-400 print:text-emerald-700" />
              <span>Criterios del Filtro Aplicado:</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-zinc-700 border border-zinc-200 dark:border-zinc-600 font-semibold print:border-zinc-400">
                Categoría: <strong>{filterSummary.category}</strong>
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-zinc-700 border border-zinc-200 dark:border-zinc-600 font-semibold print:border-zinc-400">
                Barrio: <strong>{filterSummary.barrio}</strong>
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-zinc-700 border border-zinc-200 dark:border-zinc-600 font-semibold print:border-zinc-400">
                Estado: <strong>{filterSummary.status}</strong>
              </span>
              {filterSummary.date && (
                <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-zinc-700 border border-zinc-200 dark:border-zinc-600 font-semibold print:border-zinc-400">
                  Fecha: <strong>{filterSummary.date}</strong>
                </span>
              )}
              <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-zinc-700 border border-zinc-200 dark:border-zinc-600 font-semibold print:border-zinc-400">
                Origen: <strong>{filterSummary.owner === 'mine' ? 'Mis Reportes' : 'Todos los Ciudadanos'}</strong>
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 font-bold print:border-emerald-500">
                Jurisdicción: <strong>Asunción Capital</strong>
              </span>
            </div>
          </div>

          {/* KPI Dashboard Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 p-4 border border-zinc-200 dark:border-zinc-800 print:border-zinc-300">
              <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Total Incidentes
              </div>
              <div className="text-2xl sm:text-3xl font-black mt-1 text-zinc-900 dark:text-zinc-100 print:text-black">
                {stats.total}
              </div>
              <div className="text-[10px] text-zinc-400 mt-0.5">100% analizados</div>
            </div>

            <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 p-4 border border-emerald-200 dark:border-emerald-800/60 print:border-emerald-300">
              <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                Solucionados
              </div>
              <div className="text-2xl sm:text-3xl font-black mt-1 text-emerald-600 dark:text-emerald-400">
                {stats.solved}
              </div>
              <div className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold mt-0.5">
                {stats.solvedRate}% efectividad
              </div>
            </div>

            <div className="rounded-2xl bg-blue-50 dark:bg-blue-950/30 p-4 border border-blue-200 dark:border-blue-800/60 print:border-blue-300">
              <div className="text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">
                En Revisión
              </div>
              <div className="text-2xl sm:text-3xl font-black mt-1 text-blue-600 dark:text-blue-400">
                {stats.inReview}
              </div>
              <div className="text-[10px] text-blue-700 dark:text-blue-400 font-bold mt-0.5">
                {stats.total > 0 ? Math.round((stats.inReview / stats.total) * 100) : 0}% cuadrilla asignada
              </div>
            </div>

            <div className="rounded-2xl bg-amber-50 dark:bg-amber-950/30 p-4 border border-amber-200 dark:border-amber-800/60 print:border-amber-300">
              <div className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                Pendientes
              </div>
              <div className="text-2xl sm:text-3xl font-black mt-1 text-amber-600 dark:text-amber-400">
                {stats.pending}
              </div>
              <div className="text-[10px] text-amber-700 dark:text-amber-400 font-bold mt-0.5">
                {stats.total > 0 ? Math.round((stats.pending / stats.total) * 100) : 0}% en espera
              </div>
            </div>
          </div>

          {/* Breakdown: Categories & Top Barrios */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Category breakdown */}
            <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-800/30 p-4 border border-zinc-200 dark:border-zinc-800 print:border-zinc-300">
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-3 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                Distribución por Categoría Vial
              </h4>
              <div className="space-y-2 text-xs">
                {Object.entries(stats.categoryBreakdown).map(([cat, count]) => {
                  const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
                  return (
                    <div key={cat} className="space-y-1">
                      <div className="flex justify-between font-medium">
                        <span>{cat}</span>
                        <span className="font-bold">{count} ({pct}%)</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
                        <div 
                          className="h-full bg-emerald-600 rounded-full" 
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Top Barrios breakdown */}
            <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-800/30 p-4 border border-zinc-200 dark:border-zinc-800 print:border-zinc-300">
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-3 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                Barrios con Mayor Concentración
              </h4>
              <div className="space-y-2 text-xs">
                {sortedBarrios.length === 0 ? (
                  <p className="text-zinc-400 italic">No hay datos para mostrar con este filtro</p>
                ) : (
                  sortedBarrios.map(([barrio, count]) => {
                    const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
                    return (
                      <div key={barrio} className="space-y-1">
                        <div className="flex justify-between font-medium">
                          <span>{barrio}</span>
                          <span className="font-bold">{count} ({pct}%)</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
                          <div 
                            className="h-full bg-teal-600 rounded-full" 
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Detailed Audit Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 print:text-black">
                Planilla Detallada de Irregularidades ({reports.length})
              </h4>
              <span className="text-[11px] text-zinc-400 font-medium">
                Ordenado cronológicamente
              </span>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800 print:border-zinc-300">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold border-b border-zinc-200 dark:border-zinc-700 print:bg-zinc-200 print:text-black">
                  <tr>
                    <th className="py-2.5 px-3">Código</th>
                    <th className="py-2.5 px-3">Fecha</th>
                    <th className="py-2.5 px-3">Categoría</th>
                    <th className="py-2.5 px-3">Barrio y Dirección</th>
                    <th className="py-2.5 px-3">Gravedad</th>
                    <th className="py-2.5 px-3">Estado</th>
                    <th className="py-2.5 px-3">Reportante</th>
                    <th className="py-2.5 px-3">Bitácora / Resolución</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 print:divide-zinc-300">
                  {reports.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-6 text-center text-zinc-400 italic">
                        No se encontraron reportes con los criterios actuales seleccionados.
                      </td>
                    </tr>
                  ) : (
                    reports.map((r, idx) => (
                      <tr 
                        key={r.id} 
                        className={`hover:bg-zinc-50 dark:hover:bg-zinc-800/40 print:hover:bg-transparent ${
                          idx % 2 === 1 ? 'bg-zinc-50/50 dark:bg-zinc-900/40 print:bg-zinc-50' : ''
                        }`}
                      >
                        <td className="py-2.5 px-3 font-mono font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap print:text-emerald-800">
                          {r.id}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap text-zinc-500">
                          {new Date(r.createdAt).toLocaleDateString('es-PY')}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-zinc-900 dark:text-zinc-100 print:text-black whitespace-nowrap">
                          {r.category}
                        </td>
                        <td className="py-2.5 px-3 max-w-[200px]">
                          <div className="font-semibold truncate">{r.location.address}</div>
                          <div className="text-[11px] text-zinc-400">{r.location.barrio}</div>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            r.severity === 'Alta' 
                              ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300' 
                              : r.severity === 'Media'
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                              : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                          }`}>
                            {r.severity}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            r.status === 'Solucionado'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                              : r.status === 'En revisión'
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                          }`}>
                            {r.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap text-zinc-600 dark:text-zinc-400">
                          {r.citizenName}
                        </td>
                        <td className="py-2.5 px-3 text-[11px] max-w-[220px]">
                          {r.resolutionNotes ? (
                            <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                              {r.resolutionNotes}
                            </span>
                          ) : (
                            <span className="text-zinc-400 italic">Sin notas de cuadrilla</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Official Footer */}
          <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 text-[11px] text-zinc-500 dark:text-zinc-400 flex flex-col sm:flex-row items-center justify-between gap-2 print:text-zinc-600">
            <div>
              Documento público de libre acceso para auditoría ciudadana y datos abiertos viales.
            </div>
            <div className="font-mono text-zinc-400 print:text-zinc-600">
              Sistema Asunción Se Levanta • {auditCode}
            </div>
          </div>
        </div>

        {/* Modal Bottom Bar (Hidden on print) */}
        <div className="no-print p-4 sm:px-6 bg-zinc-50 dark:bg-zinc-800/50 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <span className="text-xs text-zinc-500">
            Exportación consolidada de {reports.length} reportes
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadCSV}
              className="px-4 py-2 rounded-xl bg-white dark:bg-zinc-700 hover:bg-zinc-50 text-xs font-bold border border-zinc-200 dark:border-zinc-600 transition cursor-pointer"
            >
              Descargar CSV
            </button>
            <button
              onClick={handlePrint}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-sm cursor-pointer"
            >
              Imprimir / Guardar PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
