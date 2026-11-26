import React, { useState, useEffect, useRef } from 'react';
import { IncidentReport, IncidentCategory, IncidentStatus } from '../types';
import { reportStore } from '../store/reportStore';
import { userStore } from '../store/userStore';
import { ASUNCION_BARRIOS } from '../data/mockReports';
import { ThemeToggle } from './ThemeToggle';
import { AdminCategoryStatusChart } from './AdminCategoryStatusChart';
import { AdminProfilesPanel } from './AdminProfilesPanel';
import { canAdminEditReports, canAdminManageProfiles } from '../utils/userValidation';
import { filterAdminReports, getAvailableReportMonths } from '../utils/dateFilterUtils';
import L from 'leaflet';
import { 
  BarChart3, 
  CheckCircle, 
  Clock, 
  AlertTriangle, 
  MapPin, 
  FileSpreadsheet, 
  FileText, 
  Search, 
  RefreshCw, 
  LogOut, 
  ShieldCheck,
  TrendingUp,
  Map as MapIcon,
  X,
  MessageSquare,
  ArrowUpRight,
  Filter,
  Layers,
  Sparkles,
  Eye,
  Users,
  Lock,
  Calendar
} from 'lucide-react';

interface Props {
  onLogout: () => void;
}

export const AdminDashboard: React.FC<Props> = ({ onLogout }) => {
  const [admin, setAdmin] = useState(userStore.getAdmin());
  const [reports, setReports] = useState<IncidentReport[]>(reportStore.getReports());
  const [metrics, setMetrics] = useState(reportStore.getMetrics());

  const canEdit = canAdminEditReports(admin);
  const canManageProfiles = canAdminManageProfiles(admin);

  // Active vs Solved vs Profiles Windows state
  const [adminTab, setAdminTab] = useState<'activos' | 'solucionados' | 'perfiles'>('activos');
  const [selectedReportIds, setSelectedReportIds] = useState<string[]>([]);
  const [bulkResolutionNotes, setBulkResolutionNotes] = useState<string>('');
  const [bulkFeedback, setBulkFeedback] = useState<string>('');

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<IncidentCategory | 'Todas'>('Todas');
  const [filterStatus, setFilterStatus] = useState<IncidentStatus | 'Todos'>('Todos');
  const [filterBarrio, setFilterBarrio] = useState<string | 'Todos'>('Todos');
  const [filterDate, setFilterDate] = useState<string>('');
  const [filterMonth, setFilterMonth] = useState<string>('');

  // Selected incident for modal
  const [inspectReport, setInspectReport] = useState<IncidentReport | null>(null);
  const [resolutionNoteInput, setResolutionNoteInput] = useState('');

  // Map reference
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);

  // Subscribe to real-time changes
  useEffect(() => {
    reportStore.refresh();
    const unsubReports = reportStore.subscribe((newReports) => {
      setReports(newReports);
      setMetrics(reportStore.getMetrics(newReports));
    });
    const unsubUser = userStore.subscribe(() => {
      setAdmin(userStore.getAdmin());
    });
    return () => {
      unsubReports();
      unsubUser();
    };
  }, []);

  // Separate pools: Active (pending or in review) vs Solved (resolved archive)
  const activeReports = reports.filter((r) => r.status !== 'Solucionado');
  const solvedReports = reports.filter((r) => r.status === 'Solucionado');
  const availableMonths = getAvailableReportMonths(reports);

  // Filtered reports for current tab (category, status, barrio, exact date, month, search)
  const filteredReports = filterAdminReports(reports, {
    tab: adminTab === 'solucionados' ? 'solucionados' : 'activos',
    category: filterCategory,
    status: filterStatus,
    barrio: filterBarrio,
    searchQuery,
    filterDate,
    filterMonth
  });

  // Initialize and update Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [-25.2974, -57.5882],
        zoom: 13,
        zoomControl: true
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap'
      }).addTo(map);

      const markers = L.layerGroup().addTo(map);
      markersGroupRef.current = markers;
      mapInstanceRef.current = map;
    }

    if (markersGroupRef.current) {
      markersGroupRef.current.clearLayers();

      filteredReports.forEach((rep) => {
        let pinColor = '#f59e0b';
        if (rep.status === 'En revisión') pinColor = '#3b82f6';
        if (rep.status === 'Solucionado') pinColor = '#059669';

        const categoryIcons: Record<IncidentCategory, string> = {
          'Bache': '🕳️',
          'Badén en mal estado': '〰️',
          'Alcantarilla sin tapa': '⚠️',
          'Suciedad / Basura': '🗑️'
        };

        const iconHtml = `
          <div style="background-color: ${pinColor}; width: 32px; height: 32px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); border: 2.5px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; cursor: pointer;">
            <span style="transform: rotate(45deg); font-size: 13px;">${categoryIcons[rep.category] || '📍'}</span>
          </div>
        `;

        const marker = L.marker([rep.location.lat, rep.location.lng], {
          icon: L.divIcon({
            className: 'admin-marker',
            html: iconHtml,
            iconSize: [32, 32],
            iconAnchor: [16, 32]
          })
        });

        marker.bindPopup(`
          <div style="font-family: sans-serif; font-size: 12px; min-width: 170px;">
            <div style="font-weight: 800; color: ${pinColor}; text-transform: uppercase;">● ${rep.status}</div>
            <div style="font-weight: bold; margin-top: 2px;">${rep.id} - ${rep.category}</div>
            <div style="color: #71717a; margin: 3px 0;">${rep.location.address} (${rep.location.barrio})</div>
            <div style="font-size: 11px; color: #a1a1aa;">Por: <strong>${rep.citizenName}</strong></div>
          </div>
        `);

        marker.on('click', () => {
          setInspectReport(rep);
          setResolutionNoteInput(rep.resolutionNotes || '');
        });

        markersGroupRef.current?.addLayer(marker);
      });
    }
  }, [filteredReports]);

  const handleToggleSelectAll = () => {
    if (!canEdit) return;
    if (selectedReportIds.length === filteredReports.length && filteredReports.length > 0) {
      setSelectedReportIds([]);
    } else {
      setSelectedReportIds(filteredReports.map((r) => r.id));
    }
  };

  const handleToggleSelectOne = (id: string) => {
    if (!canEdit) return;
    setSelectedReportIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleBulkSolve = async () => {
    if (!canEdit || selectedReportIds.length === 0) return;
    const note = bulkResolutionNotes.trim() || 'Solucionado en lote por cuadrilla vial municipal';
    const count = await reportStore.bulkUpdateStatus(selectedReportIds, 'Solucionado', note);
    if (count > 0) {
      setBulkFeedback(`¡${count} incidencias marcadas como Solucionadas y trasladadas a la Ventana de Solucionados!`);
      setSelectedReportIds([]);
      setBulkResolutionNotes('');
      setTimeout(() => setBulkFeedback(''), 6000);
    }
  };

  const handleStatusChange = async (id: string, newStatus: IncidentStatus) => {
    if (!canEdit) return;
    const ok = await reportStore.updateStatus(id, newStatus, undefined, admin?.fullName);
    if (ok && newStatus === 'Solucionado') {
      setSelectedReportIds((prev) => prev.filter((x) => x !== id));
      setBulkFeedback(`Incidencia ${id} marcada como Solucionada y archivada en la Ventana de Solucionados.`);
      setTimeout(() => setBulkFeedback(''), 5000);
    }
  };

  const handleReopenReport = async (id: string) => {
    if (!canEdit) return;
    const ok = await reportStore.updateStatus(
      id,
      'En revisión',
      'Reabierto por auditoría técnica para trabajos complementarios',
      admin?.fullName
    );
    if (ok) {
      setBulkFeedback(`Incidencia ${id} reabierta y devuelta a la lista de Reportes Activos.`);
      setTimeout(() => setBulkFeedback(''), 5000);
    }
  };

  const handleSaveResolution = async () => {
    if (!canEdit || !inspectReport) return;
    const ok = await reportStore.updateStatus(
      inspectReport.id,
      inspectReport.status,
      resolutionNoteInput,
      admin?.fullName
    );
    if (ok) {
      setInspectReport((prev) => (prev ? { ...prev, resolutionNotes: resolutionNoteInput } : null));
      if (inspectReport.status === 'Solucionado') {
        setBulkFeedback(`Incidencia ${inspectReport.id} actualizada en la Ventana de Solucionados.`);
        setTimeout(() => setBulkFeedback(''), 5000);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-sm transition-colors">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-inner">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Centro de Operaciones y Métricas
              </span>
              {admin?.level === 2 ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 text-[10px] font-black border border-emerald-200 dark:border-emerald-800">
                  <ShieldCheck className="w-3 h-3" />
                  Nivel 2 • Control Completo
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 text-[10px] font-black border border-amber-200 dark:border-amber-800">
                  <Eye className="w-3 h-3" />
                  Nivel 1 • Solo Visualización
                </span>
              )}
            </div>
            <h1 className="text-lg font-black text-zinc-900 dark:text-zinc-50 tracking-tight">
              {admin?.fullName || 'Analista Vial Municipal'}
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
              C.I. (ID): {admin?.id} • N° Empleado: {admin?.employeeNumber}
              {admin?.email ? ` • ${admin.email}` : ''}
            </p>
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <ThemeToggle />

          {canManageProfiles && (
            <button
              type="button"
              onClick={() => {
                setAdminTab('perfiles');
                setSelectedReportIds([]);
                document.getElementById('admin-operational-panel')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-bold transition border active:scale-95 cursor-pointer ${
                adminTab === 'perfiles'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20'
                  : 'bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
              }`}
              title="Crear y administrar perfiles de Nivel 1 y Nivel 2"
            >
              <Users className="w-4 h-4" />
              <span>Crear Perfiles Admin</span>
            </button>
          )}

          <button
            onClick={() => reportStore.exportToExcel()}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-md shadow-emerald-600/20 active:scale-95 cursor-pointer"
            title="Descargar base de datos completa en Excel (.xlsx)"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Exportar Excel</span>
          </button>

          <button
            onClick={() => reportStore.exportToPDF()}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-bold transition border border-zinc-200 dark:border-zinc-700 active:scale-95 cursor-pointer"
            title="Generar informe imprimible en PDF"
          >
            <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Exportar PDF</span>
          </button>

          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-rose-700 dark:text-rose-300 text-xs font-bold transition border border-rose-200 dark:border-rose-800/40 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Salir</span>
          </button>
        </div>
      </div>

      {/* Read-only notice for Nivel 1 admins */}
      {!canEdit && (
        <div className="rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 px-4 py-3 text-xs text-amber-900 dark:text-amber-200 flex items-center gap-2.5">
          <Eye className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <span>
            <strong>Perfil Nivel 1 (Solo Visualización):</strong> Tienes acceso de lectura para consultar métricas, gráficos, mapa, expedientes y exportaciones. Las acciones de edición, cambio de estado y gestión de perfiles requieren Nivel 2.
          </span>
        </div>
      )}

      {/* BENTO GRID: STATS & ANALYTICS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Bento Card 1: Main KPI & Resolution Rate (Span 2 cols on tablet/desktop) */}
        <div className="lg:col-span-2 rounded-3xl bg-linear-to-br from-emerald-600 via-emerald-700 to-teal-800 p-6 text-white shadow-xl shadow-emerald-600/15 relative overflow-hidden flex flex-col justify-between min-h-[170px]">
          <div className="absolute right-0 top-0 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="relative z-10 flex items-start justify-between">
            <div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-xs font-bold tracking-wider uppercase mb-2">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                Eficiencia de Resolución Vial
              </span>
              <h3 className="text-sm font-medium text-emerald-100">Total de irregularidades reportadas</h3>
              <div className="text-4xl sm:text-5xl font-black tracking-tight mt-1">
                {metrics.total} <span className="text-lg font-bold text-emerald-200">casos</span>
              </div>
            </div>

            {/* Circular Gauge / Badge */}
            <div className="text-right">
              <div className="inline-block p-3 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 text-center">
                <span className="block text-2xl sm:text-3xl font-black text-amber-300">{metrics.rate}%</span>
                <span className="text-[10px] font-bold text-emerald-100 uppercase">Resueltos</span>
              </div>
            </div>
          </div>

          <div className="relative z-10 pt-4 border-t border-white/15 flex items-center justify-between text-xs text-emerald-100">
            <span>{metrics.resolved} casos solucionados con éxito</span>
            <span>Tiempo promedio: ~{metrics.avgResolutionDays} días</span>
          </div>
        </div>

        {/* Bento Card 2: Pendientes */}
        <div className="rounded-3xl bg-white dark:bg-zinc-900 p-5 border border-amber-200/80 dark:border-amber-900/40 bg-amber-50/10 dark:bg-amber-950/10 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Pendientes
            </span>
            <span className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
              <AlertTriangle className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="text-3xl font-black text-zinc-900 dark:text-zinc-50">{metrics.pending}</div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">A la espera de fiscalización</p>
          </div>
          <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800 text-[11px] text-amber-600 dark:text-amber-400 font-semibold flex items-center justify-between">
            <span>Prioridad alta</span>
            <span>{Math.round((metrics.pending / Math.max(1, metrics.total)) * 100)}% del total</span>
          </div>
        </div>

        {/* Bento Card 3: En Revisión */}
        <div className="rounded-3xl bg-white dark:bg-zinc-900 p-5 border border-blue-200/80 dark:border-blue-900/40 bg-blue-50/10 dark:bg-blue-950/10 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              En Cuadrilla
            </span>
            <span className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="text-3xl font-black text-zinc-900 dark:text-zinc-50">{metrics.inReview}</div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Equipos trabajando in situ</p>
          </div>
          <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800 text-[11px] text-blue-600 dark:text-blue-400 font-semibold flex items-center justify-between">
            <span>En ejecución</span>
            <span>{Math.round((metrics.inReview / Math.max(1, metrics.total)) * 100)}% del total</span>
          </div>
        </div>
      </div>

      {/* RECHARTS DATA VISUALIZATION PANEL: CATEGORY & REPAIR STATUS */}
      <AdminCategoryStatusChart
        reports={reports}
        selectedCategory={filterCategory}
        onSelectCategory={(cat) => setFilterCategory(cat)}
        selectedStatus={filterStatus}
        onSelectStatus={(st) => setFilterStatus(st)}
      />

      {/* SPATIAL & TERRITORIAL INTELLIGENCE GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Bento Card: Territorial Map */}
        <div className="lg:col-span-8 rounded-3xl bg-white dark:bg-zinc-900 p-6 border border-zinc-200/80 dark:border-zinc-800 shadow-sm space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <MapIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Mapa Territorial Geoespacial de Incidencias</span>
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Coordenadas de cuadrículas y puntos de atención en Asunción
              </p>
            </div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
              Mostrando <strong>{filteredReports.length}</strong> puntos
            </div>
          </div>

          <div className="rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-inner relative">
            <div ref={mapContainerRef} className="w-full h-80 z-0 bg-zinc-100 dark:bg-zinc-950" />
            <div className="absolute top-3 right-3 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-[11px] shadow-sm z-10 font-semibold text-zinc-700 dark:text-zinc-300">
              💡 Toca un marcador para inspeccionar el expediente
            </div>
          </div>
        </div>

        {/* Bento Card: Neighborhood Ranking */}
        <div className="lg:col-span-4 rounded-3xl bg-white dark:bg-zinc-900 p-6 border border-zinc-200/80 dark:border-zinc-800 shadow-sm flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  Ranking de Barrios Críticos
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Zonas con mayor concentración de reportes
                </p>
              </div>
              <span className="text-xs font-bold text-zinc-400">Asunción</span>
            </div>

            <div className="mt-3 space-y-2 max-h-72 overflow-y-auto pr-1">
              {metrics.barrioStats.map((item, idx) => {
                const isSelected = filterBarrio === item.barrio;
                return (
                  <div
                    key={item.barrio}
                    onClick={() => setFilterBarrio(isSelected ? 'Todos' : item.barrio)}
                    className={`flex items-center justify-between p-2.5 rounded-2xl border text-xs cursor-pointer transition ${
                      isSelected
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 ring-2 ring-emerald-500/20'
                        : 'bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200/60 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                    }`}
                    title={`Filtrar por ${item.barrio}`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className={`w-5 h-5 rounded-lg flex items-center justify-center font-bold text-[10px] ${
                        idx === 0 
                          ? 'bg-rose-500 text-white' 
                          : idx === 1 
                          ? 'bg-amber-500 text-white' 
                          : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300'
                      }`}>
                        {idx + 1}
                      </span>
                      <span className="font-bold text-zinc-800 dark:text-zinc-200">{item.barrio}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-zinc-900 dark:text-zinc-100">{item.count}</span>
                      <span className="text-[11px] text-zinc-400">({item.percentage}%)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {filterBarrio !== 'Todos' && (
            <button
              onClick={() => setFilterBarrio('Todos')}
              className="w-full py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-bold transition text-center"
            >
              Quitar filtro de barrio ({filterBarrio})
            </button>
          )}
        </div>
      </div>

      {/* BENTO CARD: OPERATIONAL TABLE & DYNAMIC FILTERS */}
      <div
        id="admin-operational-panel"
        className="rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-sm overflow-hidden"
      >
        {/* Bulk Action & Feedback Notification */}
        {bulkFeedback && (
          <div className="p-3.5 bg-emerald-600 text-white text-xs font-bold flex items-center justify-between px-6 animate-in slide-in-from-top duration-200">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-200 shrink-0" />
              <span>{bulkFeedback}</span>
            </div>
            <button
              onClick={() => setBulkFeedback('')}
              className="text-white/80 hover:text-white text-xs underline cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        )}

        {/* Top Operational Navigation Tabs */}
        <div className="p-5 border-b border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/70 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-black text-zinc-900 dark:text-zinc-100 tracking-tight flex items-center gap-2">
              <span>Control Operativo de Calzadas</span>
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              {adminTab === 'perfiles'
                ? 'Crea y administra cuentas operativas municipales (Nivel 1 y Nivel 2)'
                : adminTab === 'activos' 
                ? canEdit
                  ? 'Supervisa, prioriza y soluciona casos activos de Asunción en lote o individualmente'
                  : 'Vista de supervisión de casos activos (Modo Solo Visualización)'
                : 'Historial archivado de reportes reparados y fiscalizados por cuadrilla municipal'}
            </p>
          </div>

          {/* Window Tabs: Activos vs Solucionados vs Perfiles (Nivel 2 only) */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-2xl bg-zinc-200/70 dark:bg-zinc-800/80 border border-zinc-300/60 dark:border-zinc-700/60 self-start lg:self-auto">
            <button
              type="button"
              onClick={() => {
                setAdminTab('activos');
                setSelectedReportIds([]);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
                adminTab === 'activos'
                  ? 'bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              <span>En Gestión / Activos</span>
              <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 text-[10px] font-black">
                {activeReports.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setAdminTab('solucionados');
                setSelectedReportIds([]);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
                adminTab === 'solucionados'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              <CheckCircle className="w-3.5 h-3.5 text-emerald-200" />
              <span>Ventana de Solucionados</span>
              <span className="px-2 py-0.5 rounded-full bg-white/20 text-current text-[10px] font-black">
                {solvedReports.length}
              </span>
            </button>

            {canManageProfiles && (
              <button
                type="button"
                onClick={() => {
                  setAdminTab('perfiles');
                  setSelectedReportIds([]);
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
                  adminTab === 'perfiles'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Perfiles Administrativos</span>
              </button>
            )}
          </div>
        </div>

        {adminTab === 'perfiles' && canManageProfiles ? (
          <AdminProfilesPanel currentAdmin={admin} />
        ) : (
          <>
            {/* Solved Window Info Banner */}
            {adminTab === 'solucionados' && (
              <div className="mx-5 mt-4 p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-xs text-emerald-900 dark:text-emerald-200 flex items-start gap-2.5">
                <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">Archivo de Incidencias Solucionadas ({solvedReports.length})</span>
                  <p className="text-[11px] text-emerald-800 dark:text-emerald-300 mt-0.5 leading-relaxed">
                    Los casos marcados como «Solucionado» se trasladan automáticamente a esta ventana para evitar que se acumulen en el panel de trabajo activo. Desde aquí puedes auditar las notas de reparación{canEdit ? ' o reabrirlos si se requiere nueva cuadrilla' : ''}.
                  </p>
                </div>
              </div>
            )}

            {/* Bulk Action Bar (Visible in Activos only for Nivel 2 when 1 or more items are selected) */}
            {canEdit && adminTab === 'activos' && selectedReportIds.length > 0 && (
              <div className="m-4 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border-2 border-emerald-500 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-black text-xs shadow-sm">
                    {selectedReportIds.length}
                  </span>
                  <div>
                    <span className="font-black text-xs text-emerald-900 dark:text-emerald-100 block">
                      {selectedReportIds.length === 1 
                        ? '1 reporte activo seleccionado' 
                        : `${selectedReportIds.length} reportes activos seleccionados`}
                    </span>
                    <span className="text-[11px] text-emerald-700 dark:text-emerald-300">
                      Se solucionarán de una y se trasladarán a la Ventana de Solucionados
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={bulkResolutionNotes}
                    onChange={(e) => setBulkResolutionNotes(e.target.value)}
                    placeholder="Nota de cuadrilla (ej: Bacheo ejecutado con mezcla asfáltica)"
                    className="rounded-xl border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 w-full sm:w-72"
                  />

                  <button
                    type="button"
                    onClick={handleBulkSolve}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md shadow-emerald-600/30 transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    <CheckCircle className="w-4 h-4 text-emerald-200" />
                    <span>Solucionar ({selectedReportIds.length}) de una</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedReportIds([])}
                    className="px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 text-xs font-semibold transition cursor-pointer"
                  >
                    Deseleccionar
                  </button>
                </div>
              </div>
            )}

        {/* Table Filter Bar */}
        <div className="p-5 border-b border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 space-y-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400">
                Mostrando {filteredReports.length} {adminTab === 'activos' ? 'reportes activos' : 'reportes solucionados'}
              </span>
            </div>

            {/* Live Search Input */}
            <div className="relative w-full md:w-72">
              <Search className="w-4 h-4 absolute left-3 top-3 text-zinc-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por código, calle o vecino..."
                className="w-full rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 pl-9 pr-4 py-2 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:border-emerald-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Dynamic Filter Dropdowns + Date & Month Filters */}
          <div className="flex flex-wrap items-center gap-2 pt-2 text-xs">
            <select
              aria-label="Filtrar por categoría"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value as any)}
              className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-xs text-zinc-800 dark:text-zinc-200 font-medium focus:border-emerald-500"
            >
              <option value="Todas">Todas las categorías</option>
              <option value="Bache">Bache</option>
              <option value="Badén en mal estado">Badén en mal estado</option>
              <option value="Alcantarilla sin tapa">Alcantarilla sin tapa</option>
              <option value="Suciedad / Basura">Suciedad / Basura</option>
            </select>

            {adminTab === 'activos' && (
              <select
                aria-label="Filtrar por estado"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-xs text-zinc-800 dark:text-zinc-200 font-medium focus:border-emerald-500"
              >
                <option value="Todos">Todos los activos</option>
                <option value="Pendiente">🟡 Solo Pendientes</option>
                <option value="En revisión">🔵 Solo En revisión</option>
              </select>
            )}

            <select
              aria-label="Filtrar por barrio"
              value={filterBarrio}
              onChange={(e) => setFilterBarrio(e.target.value)}
              className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-xs text-zinc-800 dark:text-zinc-200 font-medium focus:border-emerald-500"
            >
              <option value="Todos">Todos los barrios</option>
              {ASUNCION_BARRIOS.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>

            {/* Exact Date Filter */}
            <div className="flex items-center gap-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2.5 py-1">
              <Calendar className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 whitespace-nowrap">Fecha:</span>
              <input
                type="date"
                aria-label="Filtrar por fecha exacta"
                value={filterDate}
                onChange={(e) => {
                  setFilterDate(e.target.value);
                  if (e.target.value) setFilterMonth('');
                }}
                className="bg-transparent text-xs text-zinc-800 dark:text-zinc-200 font-medium focus:outline-hidden cursor-pointer"
              />
            </div>

            {/* Month Filter */}
            <select
              aria-label="Filtrar por mes"
              value={filterMonth}
              onChange={(e) => {
                setFilterMonth(e.target.value);
                if (e.target.value) setFilterDate('');
              }}
              className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-xs text-zinc-800 dark:text-zinc-200 font-medium focus:border-emerald-500 cursor-pointer"
            >
              <option value="">Todos los meses</option>
              {availableMonths.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label} ({m.count})
                </option>
              ))}
            </select>

            {(searchQuery || filterCategory !== 'Todas' || (adminTab === 'activos' && filterStatus !== 'Todos') || filterBarrio !== 'Todos' || filterDate !== '' || filterMonth !== '') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setFilterCategory('Todas');
                  setFilterStatus('Todos');
                  setFilterBarrio('Todos');
                  setFilterDate('');
                  setFilterMonth('');
                }}
                className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline px-2 py-1 text-xs ml-auto cursor-pointer"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        </div>

        {/* Incidents Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-zinc-700 dark:text-zinc-300">
            <thead className="bg-zinc-100/70 dark:bg-zinc-800/70 text-zinc-600 dark:text-zinc-400 font-bold uppercase tracking-wider text-[11px] border-b border-zinc-200/80 dark:border-zinc-800">
              <tr>
                {canEdit && adminTab === 'activos' && (
                  <th className="px-3 py-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={filteredReports.length > 0 && selectedReportIds.length === filteredReports.length}
                      onChange={handleToggleSelectAll}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      title="Seleccionar todos los reportes visibles"
                    />
                  </th>
                )}
                <th className="px-4 py-3">Código</th>
                <th className="px-4 py-3">Foto</th>
                <th className="px-4 py-3">Tipo & Gravedad</th>
                <th className="px-4 py-3">Ubicación</th>
                <th className="px-4 py-3">Ciudadano</th>
                <th className="px-4 py-3">Fecha</th>
                {adminTab === 'activos' ? (
                  <th className="px-4 py-3">Estado</th>
                ) : (
                  <th className="px-4 py-3">Notas de Reparación</th>
                )}
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200/60 dark:divide-zinc-800/60">
              {filteredReports.map((report) => {
                const isSelected = selectedReportIds.includes(report.id);
                return (
                  <tr 
                    key={report.id} 
                    className={`transition ${
                      isSelected 
                        ? 'bg-emerald-50/70 dark:bg-emerald-950/30' 
                        : 'hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40'
                    }`}
                  >
                    {canEdit && adminTab === 'activos' && (
                      <td className="px-3 py-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectOne(report.id)}
                          className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />
                      </td>
                    )}

                    <td className="px-4 py-3.5 font-mono font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                      {report.id}
                    </td>

                    <td className="px-4 py-3.5">
                      <img
                        src={report.photoUrl}
                        alt={report.category}
                        onClick={() => {
                          setInspectReport(report);
                          setResolutionNoteInput(report.resolutionNotes || '');
                        }}
                        className="w-12 h-10 object-cover rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-xs cursor-pointer hover:opacity-80 transition"
                      />
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="font-bold text-zinc-900 dark:text-zinc-100">{report.category}</div>
                      <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold mt-0.5 ${
                        report.severity === 'Crítica' ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300' :
                        report.severity === 'Alta' ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300' :
                        'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                      }`}>
                        {report.severity}
                      </span>
                    </td>

                    <td className="px-4 py-3.5 max-w-[200px]">
                      <div className="font-semibold text-zinc-800 dark:text-zinc-200 truncate" title={report.location.address}>
                        {report.location.address}
                      </div>
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        {report.location.barrio}
                      </div>
                    </td>

                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="font-bold text-zinc-900 dark:text-zinc-100">{report.citizenName}</div>
                      <div className="text-[10px] text-zinc-400">
                        {report.citizenId ? `C.I. ${report.citizenId}` : (report.citizenPhone || 'Sin tel')}
                      </div>
                    </td>

                    <td className="px-4 py-3.5 whitespace-nowrap text-zinc-500 dark:text-zinc-400">
                      <div className="font-semibold text-zinc-700 dark:text-zinc-300">
                        {new Date(report.createdAt).toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </div>
                      <div className="text-[10px] text-zinc-400 font-mono">
                        {new Date(report.createdAt).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      {report.resolvedAt && (
                        <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                          Resuelto: {new Date(report.resolvedAt).toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </div>
                      )}
                    </td>

                    {adminTab === 'activos' ? (
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {canEdit ? (
                          <select
                            value={report.status}
                            onChange={(e) => handleStatusChange(report.id, e.target.value as IncidentStatus)}
                            className={`rounded-xl px-2.5 py-1 text-xs font-bold border transition cursor-pointer ${
                              report.status === 'En revisión'
                                ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-700'
                                : 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700'
                            }`}
                          >
                            <option value="Pendiente">Pendiente</option>
                            <option value="En revisión">En revisión</option>
                            <option value="Solucionado">✓ Pasar a Solucionado</option>
                          </select>
                        ) : (
                          <span className={`inline-block rounded-xl px-2.5 py-1 text-xs font-bold border ${
                            report.status === 'En revisión'
                              ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-700'
                              : 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700'
                          }`}>
                            {report.status}
                          </span>
                        )}
                      </td>
                    ) : (
                      <td className="px-4 py-3.5 max-w-[220px]">
                        <span className="text-[11px] text-zinc-600 dark:text-zinc-300 line-clamp-2" title={report.resolutionNotes || 'Sin notas'}>
                          {report.resolutionNotes || 'Reparación confirmada por cuadrilla'}
                        </span>
                      </td>
                    )}

                    <td className="px-4 py-3.5 text-right whitespace-nowrap space-x-1.5">
                      {canEdit && adminTab === 'solucionados' && (
                        <button
                          type="button"
                          onClick={() => handleReopenReport(report.id)}
                          className="px-2.5 py-1 rounded-xl bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 text-amber-800 dark:text-amber-300 text-xs font-bold transition border border-amber-200 dark:border-amber-800/60 cursor-pointer"
                          title="Reabrir este caso a En revisión para trabajos adicionales"
                        >
                          Reabrir
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setInspectReport(report);
                          setResolutionNoteInput(report.resolutionNotes || '');
                        }}
                        className="px-3 py-1 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 text-xs font-bold transition cursor-pointer"
                      >
                        Expediente
                      </button>
                    </td>
                  </tr>
                );
              })}

              {filteredReports.length === 0 && (
                <tr>
                  <td colSpan={canEdit && adminTab === 'activos' ? 9 : 8} className="py-12 text-center text-zinc-400">
                    {adminTab === 'activos' 
                      ? 'No hay reportes pendientes ni activos con los filtros seleccionados.' 
                      : 'No hay reportes solucionados archivados con los filtros seleccionados.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
          </>
        )}
      </div>

      {/* Audit & Inspection Modal */}
      {inspectReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-2xl rounded-3xl bg-white dark:bg-zinc-900 shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden max-h-[92vh] flex flex-col">
            <div className="bg-zinc-900 dark:bg-black p-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-emerald-400">{inspectReport.id}</span>
                <span className="text-zinc-500">|</span>
                <span className="text-sm font-bold">{inspectReport.category}</span>
              </div>
              <button
                onClick={() => setInspectReport(null)}
                className="text-zinc-400 hover:text-white p-1 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 aspect-4/3 bg-zinc-950">
                  <img
                    src={inspectReport.photoUrl}
                    alt={inspectReport.category}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="space-y-3 text-xs">
                  <div>
                    <span className="text-zinc-400 block uppercase font-bold text-[10px]">Ubicación y Barrio:</span>
                    <span className="text-zinc-900 dark:text-zinc-100 font-bold text-sm block">{inspectReport.location.address}</span>
                    <span className="text-zinc-600 dark:text-zinc-400 font-medium">Barrio {inspectReport.location.barrio}</span>
                  </div>

                  <div>
                    <span className="text-zinc-400 block uppercase font-bold text-[10px]">Vecino Reportante:</span>
                    <span className="text-zinc-900 dark:text-zinc-100 font-bold text-sm block">{inspectReport.citizenName}</span>
                    <span className="text-zinc-500">
                      {inspectReport.citizenId ? `C.I. (ID): ${inspectReport.citizenId} • ` : ''}
                      Tel: {inspectReport.citizenPhone || 'No proporcionado'}
                    </span>
                  </div>

                  <div>
                    <span className="text-zinc-400 block uppercase font-bold text-[10px]">Fecha de Reporte:</span>
                    <span className="text-zinc-800 dark:text-zinc-200 font-semibold">
                      {new Date(inspectReport.createdAt).toLocaleString('es-PY', { dateStyle: 'medium', timeStyle: 'short' })}
                    </span>
                  </div>

                  <div>
                    <span className="text-zinc-400 block uppercase font-bold text-[10px]">
                      {canEdit ? 'Cambiar Estado:' : 'Estado Actual (Solo lectura):'}
                    </span>
                    {canEdit ? (
                      <div className="flex items-center gap-2 mt-1">
                        {(['Pendiente', 'En revisión', 'Solucionado'] as IncidentStatus[]).map((st) => (
                          <button
                            key={st}
                            type="button"
                            onClick={() => {
                              handleStatusChange(inspectReport.id, st);
                              setInspectReport((prev) => prev ? { ...prev, status: st } : null);
                            }}
                            className={`px-3 py-1 rounded-xl text-xs font-bold border transition cursor-pointer ${
                              inspectReport.status === st
                                ? st === 'Solucionado'
                                  ? 'bg-emerald-600 text-white border-emerald-600'
                                  : st === 'En revisión'
                                  ? 'bg-blue-600 text-white border-blue-600'
                                  : 'bg-amber-600 text-white border-amber-600'
                                : 'bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                            }`}
                          >
                            {st}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-1 flex items-center gap-2">
                        <span className="inline-block px-3 py-1 rounded-xl text-xs font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700">
                          {inspectReport.status}
                        </span>
                        <span className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1 font-semibold">
                          <Lock className="w-3 h-3" /> Nivel 1
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 block mb-1">
                  Descripción del Vecino:
                </label>
                <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-700 dark:text-zinc-300">
                  {inspectReport.description}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 block mb-1 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Bitácora Municipal:</span>
                </label>
                {canEdit ? (
                  <>
                    <textarea
                      value={resolutionNoteInput}
                      onChange={(e) => setResolutionNoteInput(e.target.value)}
                      rows={2}
                      placeholder="Ej. Cuadrilla N° 4 realizó bacheo en frío con mezcla asfáltica. Trabajo concluido."
                      className="w-full rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/50 p-3 text-xs text-zinc-900 dark:text-zinc-100 focus:border-emerald-500 focus:outline-hidden"
                    />
                    <button
                      type="button"
                      onClick={handleSaveResolution}
                      className="mt-2 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition cursor-pointer"
                    >
                      Guardar en Bitácora
                    </button>
                  </>
                ) : (
                  <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-700 dark:text-zinc-300">
                    {inspectReport.resolutionNotes || 'Sin anotaciones registradas en bitácora.'}
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 flex justify-end">
                <button
                  onClick={() => setInspectReport(null)}
                  className="px-4 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
