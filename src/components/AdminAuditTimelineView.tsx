import React, { useState } from 'react';
import { IncidentReport, IncidentStatus, StatusHistoryEntry } from '../types';
import { reportStore, getReportHistory } from '../store/reportStore';
import { 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  History, 
  Search, 
  MapPin, 
  User, 
  ArrowRight, 
  ShieldCheck, 
  Edit3, 
  FileText, 
  Calendar, 
  Check, 
  RefreshCw,
  Sparkles,
  ChevronRight,
  Filter
} from 'lucide-react';

interface Props {
  reports: IncidentReport[];
  selectedReportId?: string;
  onSelectReport?: (reportId: string) => void;
}

export const AdminAuditTimelineView: React.FC<Props> = ({
  reports,
  selectedReportId,
  onSelectReport
}) => {
  const [activeId, setActiveId] = useState<string>(selectedReportId || (reports[0]?.id ?? ''));
  const [searchFilter, setSearchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<IncidentStatus | 'Todos'>('Todos');

  // New state transition form
  const [newStatus, setNewStatus] = useState<IncidentStatus>('En revisión');
  const [auditNotes, setAuditNotes] = useState('');
  const [actorName, setActorName] = useState('Ing. Coordinador de Cuadrillas');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Selected report object
  const currentReport = reports.find(r => r.id === activeId) || reports[0];

  // Filtered reports for sidebar selector
  const selectableReports = reports.filter(r => {
    if (statusFilter !== 'Todos' && r.status !== statusFilter) return false;
    if (searchFilter.trim() !== '') {
      const q = searchFilter.toLowerCase().trim();
      const matchId = r.id.toLowerCase().includes(q);
      const matchName = r.citizenName.toLowerCase().includes(q);
      const matchBarrio = r.location.barrio.toLowerCase().includes(q);
      const matchAddress = r.location.address.toLowerCase().includes(q);
      if (!matchId && !matchName && !matchBarrio && !matchAddress) return false;
    }
    return true;
  });

  const handleSelect = (id: string) => {
    setActiveId(id);
    setSuccessMessage('');
    if (onSelectReport) onSelectReport(id);
  };

  const handleAddTransition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentReport) return;

    setIsSubmitting(true);
    const finalActor = actorName.trim() || 'Dirección de Obras Municipales';
    const finalNotes = auditNotes.trim() || `Transición oficial de auditoría a estado ${newStatus}.`;

    const ok = await reportStore.updateStatus(currentReport.id, newStatus, finalNotes, finalActor);
    setIsSubmitting(false);

    if (ok) {
      setSuccessMessage(`¡Estado actualizado exitosamente a «${newStatus}» con registro de auditoría!`);
      setAuditNotes('');
      setTimeout(() => {
        setSuccessMessage('');
      }, 4000);
    }
  };

  const historyEntries: StatusHistoryEntry[] = currentReport ? getReportHistory(currentReport) : [];

  // Helper for duration between two timestamps
  const formatDuration = (startIso: string, endIso: string) => {
    const diffMs = Math.max(0, new Date(endIso).getTime() - new Date(startIso).getTime());
    const hours = Math.round(diffMs / (1000 * 3600));
    if (hours < 1) return 'Menos de 1 hora';
    if (hours < 24) return `${hours} horas`;
    const days = Math.round((hours / 24) * 10) / 10;
    return `${days} días (${hours}h)`;
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-6 rounded-3xl bg-linear-to-r from-blue-700 via-indigo-800 to-slate-900 text-white shadow-xl shadow-blue-700/15 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-80 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-white text-xs font-bold backdrop-blur-md mb-2">
              <History className="w-3.5 h-3.5 text-blue-300" />
              <span>Auditoría de Gestión Pública</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight">
              Línea de Tiempo y Trazabilidad de Estados
            </h2>
            <p className="text-xs sm:text-sm text-blue-100 max-w-xl mt-1 leading-relaxed">
              Supervisión cronológica de cada reporte vial en Asunción. Audita cuándo fue recibido, qué cuadrilla técnica intervino, las notas de inspección y la fecha exacta de solución.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3.5 py-1.5 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 text-xs font-mono font-bold">
              {reports.length} reportes auditados
            </span>
          </div>
        </div>
      </div>

      {/* Main 2-Column Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Selector sidebar */}
        <div className="lg:col-span-4 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 p-5 shadow-sm space-y-4">
          <div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center justify-between">
              <span>Seleccionar Expediente</span>
              <span className="text-xs font-normal text-zinc-400">({selectableReports.length})</span>
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Elige un reporte para inspeccionar su historial
            </p>
          </div>

          {/* Search and Filters */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Código, barrio o ciudadano..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-hidden focus:border-blue-500 transition"
              />
            </div>

            <div className="flex items-center gap-1 overflow-x-auto pb-1 text-xs">
              {(['Todos', 'Pendiente', 'En revisión', 'Solucionado'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 transition cursor-pointer ${
                    statusFilter === st
                      ? 'bg-blue-600 text-white'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Report List Items */}
          <div className="space-y-2 max-h-[580px] overflow-y-auto pr-1">
            {selectableReports.map((r) => {
              const isSelected = r.id === activeId;
              const statusColor = 
                r.status === 'Solucionado'
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
                  : r.status === 'En revisión'
                  ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700'
                  : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700';

              return (
                <div
                  key={r.id}
                  onClick={() => handleSelect(r.id)}
                  className={`p-3 rounded-2xl border text-xs cursor-pointer transition ${
                    isSelected
                      ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-500 ring-2 ring-blue-500/20'
                      : 'bg-zinc-50 dark:bg-zinc-800/40 border-zinc-200/80 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="font-mono font-black text-zinc-900 dark:text-zinc-100">
                      {r.id}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusColor}`}>
                      {r.status}
                    </span>
                  </div>

                  <div className="font-bold text-zinc-800 dark:text-zinc-200 truncate">
                    {r.category}
                  </div>

                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-zinc-400 shrink-0" />
                    <span className="truncate">{r.location.address} ({r.location.barrio})</span>
                  </div>

                  <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-zinc-200/50 dark:border-zinc-800/60 text-[10px] text-zinc-400">
                    <span>Por: {r.citizenName}</span>
                    <span>{new Date(r.createdAt).toLocaleDateString('es-PY')}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Detailed Interactive Timeline */}
        <div className="lg:col-span-8 space-y-6">
          {currentReport ? (
            <>
              {/* Report Summary Card */}
              <div className="rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 p-6 shadow-sm">
                <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <img 
                      src={currentReport.photoUrl} 
                      alt={currentReport.category}
                      className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover border border-zinc-200 dark:border-zinc-700 shrink-0 shadow-sm" 
                    />
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono font-black text-sm px-2.5 py-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700">
                          {currentReport.id}
                        </span>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase ${
                          currentReport.severity === 'Crítica'
                            ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300'
                            : currentReport.severity === 'Alta'
                            ? 'bg-orange-100 dark:bg-orange-950/80 text-orange-700 dark:text-orange-300'
                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                        }`}>
                          Gravedad {currentReport.severity}
                        </span>
                      </div>
                      <h3 className="text-lg font-black text-zinc-900 dark:text-zinc-50">
                        {currentReport.category}
                      </h3>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span>{currentReport.location.address} • Barrio <strong>{currentReport.location.barrio}</strong></span>
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                        <span>Ciudadano: <strong>{currentReport.citizenName}</strong> {currentReport.citizenPhone ? `(${currentReport.citizenPhone})` : ''}</span>
                      </p>
                    </div>
                  </div>

                  <div className="text-right sm:self-center shrink-0">
                    <span className="text-[10px] uppercase font-bold text-zinc-400 block mb-1">
                      Estado Actual
                    </span>
                    <span className={`px-3 py-1 rounded-2xl text-xs font-black uppercase inline-block border ${
                      currentReport.status === 'Solucionado'
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
                        : currentReport.status === 'En revisión'
                        ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700'
                        : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700'
                    }`}>
                      {currentReport.status}
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-800/40 p-3 rounded-2xl">
                  <span className="font-bold text-zinc-800 dark:text-zinc-200 block mb-0.5">Descripción de la denuncia:</span>
                  <p className="italic leading-relaxed">"{currentReport.description}"</p>
                </div>
              </div>

              {/* TIMELINE CAROUSEL / STEP FLOW */}
              <div className="rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 p-6 sm:p-7 shadow-sm space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-wider text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span>Cronología Oficial de Cambios de Estado</span>
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Registro inmutable de auditoría para el expediente {currentReport.id}
                    </p>
                  </div>

                  <span className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2.5 py-1 rounded-xl border border-blue-200 dark:border-blue-800">
                    {historyEntries.length} Eventos Registrados
                  </span>
                </div>

                {/* Vertical Timeline Structure */}
                <div className="relative pl-6 sm:pl-8 space-y-8 before:absolute before:left-3 sm:before:left-4 before:top-3 before:bottom-3 before:w-0.5 before:bg-zinc-200 dark:before:bg-zinc-800">
                  {historyEntries.map((entry, index) => {
                    const isLast = index === historyEntries.length - 1;
                    const prevEntry = index > 0 ? historyEntries[index - 1] : null;

                    const nodeBg = 
                      entry.newStatus === 'Solucionado'
                        ? 'bg-emerald-500 text-white ring-4 ring-emerald-500/20'
                        : entry.newStatus === 'En revisión'
                        ? 'bg-blue-500 text-white ring-4 ring-blue-500/20'
                        : 'bg-amber-500 text-white ring-4 ring-amber-500/20';

                    return (
                      <div key={entry.id} className="relative group">
                        {/* Node icon bullet */}
                        <div className={`absolute -left-6 sm:-left-8 top-1.5 w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shadow-md ${nodeBg}`}>
                          {entry.newStatus === 'Solucionado' ? (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          ) : entry.newStatus === 'En revisión' ? (
                            <Clock className="w-3.5 h-3.5" />
                          ) : (
                            <AlertTriangle className="w-3.5 h-3.5" />
                          )}
                        </div>

                        {/* Content Card */}
                        <div className="p-4 sm:p-5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/80 space-y-2 hover:border-blue-400 transition">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                            <div className="flex items-center gap-2">
                              {entry.previousStatus && (
                                <>
                                  <span className="px-2 py-0.5 rounded-lg bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-[11px] font-bold">
                                    {entry.previousStatus}
                                  </span>
                                  <ArrowRight className="w-3 h-3 text-zinc-400" />
                                </>
                              )}
                              <span className={`px-2.5 py-0.5 rounded-lg text-xs font-black uppercase ${
                                entry.newStatus === 'Solucionado'
                                  ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700'
                                  : entry.newStatus === 'En revisión'
                                  ? 'bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700'
                                  : 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700'
                              }`}>
                                {entry.newStatus}
                              </span>

                              {isLast && (
                                <span className="px-2 py-0.5 rounded-md bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 text-[9px] font-black uppercase">
                                  Actual
                                </span>
                              )}
                            </div>

                            <span className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-zinc-400" />
                              {new Date(entry.timestamp).toLocaleString('es-PY', {
                                dateStyle: 'medium',
                                timeStyle: 'short'
                              })}
                            </span>
                          </div>

                          {/* Actor and notes */}
                          <div className="text-xs text-zinc-700 dark:text-zinc-200">
                            <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                              {entry.notes || 'Sin observaciones registradas.'}
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-200/60 dark:border-zinc-700/60 text-[11px] text-zinc-500 dark:text-zinc-400">
                            <span className="flex items-center gap-1">
                              <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
                              <span>Intervino: <strong>{entry.changedBy}</strong></span>
                            </span>

                            {prevEntry && (
                              <span className="text-[10px] text-zinc-400 bg-white dark:bg-zinc-800 px-2 py-0.5 rounded-md border border-zinc-200 dark:border-zinc-700 font-mono">
                                Tiempo transcurrido: {formatDuration(prevEntry.timestamp, entry.timestamp)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ACTION FORM: LOG NEW STATUS CHANGE */}
              <div className="rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 p-6 sm:p-7 shadow-sm space-y-4">
                <div className="flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <h4 className="text-sm font-black uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
                    Registrar Nueva Transición de Auditoría
                  </h4>
                </div>

                {successMessage && (
                  <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center gap-2 animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{successMessage}</span>
                  </div>
                )}

                <form onSubmit={handleAddTransition} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                        Nuevo Estado Oficial
                      </label>
                      <select
                        value={newStatus}
                        onChange={(e) => setNewStatus(e.target.value as IncidentStatus)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs font-bold text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:border-blue-500"
                      >
                        <option value="Pendiente">Pendiente (A la espera de cuadrilla)</option>
                        <option value="En revisión">En revisión (Trabajo técnico en curso)</option>
                        <option value="Solucionado">Solucionado (Reparación vial concluida)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                        Funcionario / Cuadrilla Responsable
                      </label>
                      <input
                        type="text"
                        value={actorName}
                        onChange={(e) => setActorName(e.target.value)}
                        placeholder="Ej. Ing. Mario Gómez (Fiscalización)"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-hidden focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                      Notas Técnicas de Auditoría / Informe de Cuadrilla
                    </label>
                    <textarea
                      rows={2}
                      value={auditNotes}
                      onChange={(e) => setAuditNotes(e.target.value)}
                      placeholder="Ej. Se colocó mezcla asfáltica en caliente y se compactó la superficie. Vía habilitada."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-hidden focus:border-blue-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition active:scale-95 flex items-center gap-2 cursor-pointer"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>Guardar Transición en Línea de Tiempo</span>
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="p-12 text-center text-zinc-400 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
              <History className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm font-semibold">Selecciona un reporte para visualizar su cronología de auditoría.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
