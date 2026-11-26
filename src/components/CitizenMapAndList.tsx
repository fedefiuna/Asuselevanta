import React, { useState, useEffect, useRef } from 'react';
import { IncidentReport, IncidentCategory, IncidentStatus } from '../types';
import { reportStore } from '../store/reportStore';
import { userStore } from '../store/userStore';
import { ASUNCION_BARRIOS } from '../data/mockReports';
import { downloadCSV } from '../utils/exportUtils';
import { filterPublicReports, DatePreset } from '../utils/filterUtils';
import { isLocationInAsuncion } from '../utils/geoUtils';
import { CitizenTransparencyReportModal } from './CitizenTransparencyReportModal';
import L from 'leaflet';
import { citizenIdentifier } from '../utils/citizenIdentity';
import { 
  MapPin, 
  List, 
  Map as MapIcon, 
  Filter, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Eye, 
  EyeOff,
  X,
  UserCheck,
  FileSpreadsheet,
  FileText,
  Download,
  ShieldCheck,
  Calendar,
  SlidersHorizontal,
  RotateCcw,
  Check,
  Building2,
  AlertTriangle
} from 'lucide-react';

const ALL_CATEGORIES: IncidentCategory[] = [
  'Bache',
  'Suciedad / Basura',
  'Badén en mal estado',
  'Alcantarilla sin tapa'
];

const CATEGORY_META: Record<IncidentCategory, { label: string; icon: string; short: string; color: string }> = {
  'Bache': { label: 'Baches', icon: '🕳️', short: 'Baches', color: 'amber' },
  'Suciedad / Basura': { label: 'Basura / Residuos', icon: '🗑️', short: 'Basura', color: 'emerald' },
  'Badén en mal estado': { label: 'Badenes Rotos', icon: '〰️', short: 'Badenes', color: 'orange' },
  'Alcantarilla sin tapa': { label: 'Alcantarillas', icon: '⚠️', short: 'Alcantarillas', color: 'rose' }
};

export const CitizenMapAndList: React.FC = () => {
  const [reports, setReports] = useState<IncidentReport[]>(reportStore.getReports());
  const citizen = userStore.getCitizen();

  const [activeTab, setActiveTab] = useState<'map' | 'list'>('map');
  const [filterOwner, setFilterOwner] = useState<'all' | 'mine'>('all');
  
  // Interactive Type & Date filter state
  const [selectedCategories, setSelectedCategories] = useState<Set<IncidentCategory>>(
    new Set<IncidentCategory>(ALL_CATEGORIES)
  );
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<IncidentStatus | 'Todos'>('Todos');
  const [filterBarrio, setFilterBarrio] = useState<string | 'Todos'>('Todos');
  
  const [selectedReport, setSelectedReport] = useState<IncidentReport | null>(null);
  const [isTransparencyModalOpen, setIsTransparencyModalOpen] = useState<boolean>(false);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    return reportStore.subscribe((newReports) => {
      setReports(newReports);
    });
  }, []);

  // Filter reports: strictly restricted to Asunción for the public map & portal
  const filteredReports = filterPublicReports(reports, {
    selectedCategories,
    datePreset,
    customStartDate,
    customEndDate,
    barrio: filterBarrio,
    status: filterStatus,
    owner: filterOwner,
    citizenFullName: citizenIdentifier(citizen),
    onlyInAsuncion: true // ENFORCE ASUNCIÓN BOUNDARY
  });

  // Calculate Asunción vs outside counts
  const outsideReportsCount = reports.filter(r => !isLocationInAsuncion(r.location.lat, r.location.lng)).length;
  const asuncionReportsCount = reports.filter(r => isLocationInAsuncion(r.location.lat, r.location.lng)).length;

  // Category toggle handler
  const handleToggleCategory = (cat: IncidentCategory) => {
    setSelectedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) {
        next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });
  };

  const handleSelectAllCategories = () => {
    setSelectedCategories(new Set(ALL_CATEGORIES));
  };

  const handleClearCategories = () => {
    setSelectedCategories(new Set());
  };

  const isFiltersModified = 
    selectedCategories.size < ALL_CATEGORIES.length ||
    datePreset !== 'all' ||
    customStartDate !== '' ||
    customEndDate !== '' ||
    filterBarrio !== 'Todos' ||
    filterStatus !== 'Todos' ||
    filterOwner !== 'all';

  const handleResetFilters = () => {
    setSelectedCategories(new Set(ALL_CATEGORIES));
    setDatePreset('all');
    setCustomStartDate('');
    setCustomEndDate('');
    setFilterBarrio('Todos');
    setFilterStatus('Todos');
    setFilterOwner('all');
  };

  const handleExportCSV = () => {
    downloadCSV(filteredReports);
  };

  // Map initialization
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

      const markersGroup = L.layerGroup().addTo(map);
      markersLayerRef.current = markersGroup;
      mapInstanceRef.current = map;
    }

    if (markersLayerRef.current) {
      markersLayerRef.current.clearLayers();

      filteredReports.forEach((rep) => {
        let pinColor = '#f59e0b'; // amber
        if (rep.status === 'En revisión') pinColor = '#3b82f6'; // blue
        if (rep.status === 'Solucionado') pinColor = '#059669'; // emerald

        const categoryIcons: Record<IncidentCategory, string> = {
          'Bache': '🕳️',
          'Badén en mal estado': '〰️',
          'Alcantarilla sin tapa': '⚠️',
          'Suciedad / Basura': '🗑️'
        };

        const iconHtml = `
          <div style="background-color: ${pinColor}; width: 34px; height: 34px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); border: 2.5px solid white; box-shadow: 0 4px 14px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; cursor: pointer;">
            <span style="transform: rotate(45deg); font-size: 14px;">${categoryIcons[rep.category] || '📍'}</span>
          </div>
        `;

        const customIcon = L.divIcon({
          className: 'citizen-marker',
          html: iconHtml,
          iconSize: [34, 34],
          iconAnchor: [17, 34],
          popupAnchor: [0, -32]
        });

        const marker = L.marker([rep.location.lat, rep.location.lng], { icon: customIcon });

        marker.bindPopup(`
          <div style="font-family: sans-serif; min-width: 190px;">
            <div style="font-size: 11px; font-weight: 800; color: ${pinColor}; text-transform: uppercase;">● ${rep.status}</div>
            <div style="font-size: 13px; font-weight: bold; margin-top: 2px;">${rep.category}</div>
            <div style="font-size: 12px; color: #52525b; margin: 4px 0;">${rep.location.address} (${rep.location.barrio})</div>
            <div style="font-size: 11px; color: #a1a1aa;">Por: <strong>${rep.citizenName}</strong></div>
          </div>
        `);

        marker.on('click', () => {
          setSelectedReport(rep);
        });

        markersLayerRef.current?.addLayer(marker);
      });
    }
  }, [filteredReports, activeTab]);

  return (
    <div className="space-y-4">
      {/* Controls & Filter Bar Container */}
      <div className="rounded-3xl bg-white dark:bg-zinc-900 p-4 sm:p-5 shadow-sm border border-zinc-200/80 dark:border-zinc-800 transition-colors space-y-4">
        
        {/* Top Bar: View Mode Switcher + Identity/Owner Filter */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* View Toggle */}
          <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-2xl">
            <button
              onClick={() => setActiveTab('map')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                activeTab === 'map'
                  ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400'
              }`}
            >
              <MapIcon className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Mapa Interactivo</span>
            </button>
            <button
              onClick={() => setActiveTab('list')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                activeTab === 'list'
                  ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400'
              }`}
            >
              <List className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Lista de Reportes ({filteredReports.length})</span>
            </button>
          </div>

          {/* Territorial Jurisdiction Notice & Owner Filter */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
              <Building2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Exclusivo Asunción ({asuncionReportsCount})</span>
            </div>

            {outsideReportsCount > 0 && (
              <div 
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-[10px] font-semibold text-amber-700 dark:text-amber-400"
                title={`${outsideReportsCount} reporte(s) cargados fuera de Asunción están archivados pero no figuran en este mapa`}
              >
                <AlertTriangle className="w-3 h-3 text-amber-600" />
                <span>{outsideReportsCount} fuera de Asunción omitido(s)</span>
              </div>
            )}

            {citizen && (
              <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 p-1 rounded-2xl">
                <button
                  onClick={() => setFilterOwner('all')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-xl transition ${
                    filterOwner === 'all'
                      ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-xs'
                      : 'text-zinc-600 dark:text-zinc-400'
                  }`}
                >
                  Todos
                </button>
                <button
                  onClick={() => setFilterOwner('mine')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-xl transition flex items-center gap-1 ${
                    filterOwner === 'mine'
                      ? 'bg-white dark:bg-zinc-700 text-emerald-600 dark:text-emerald-400 font-bold shadow-xs'
                      : 'text-zinc-600 dark:text-zinc-400'
                  }`}
                >
                  <UserCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  <span>Míos</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* --- DEDICATED PUBLIC MAP FILTER BAR --- */}
        <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 space-y-3">
          
          {/* Filter Bar Header */}
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 font-bold text-zinc-800 dark:text-zinc-200">
              <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Filtros Rápidos del Mapa</span>
              <span className="text-[11px] text-zinc-400 font-normal">
                (Oculta o muestra según tu interés)
              </span>
            </div>

            {isFiltersModified && (
              <button
                onClick={handleResetFilters}
                className="flex items-center gap-1 text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Restablecer filtros</span>
              </button>
            )}
          </div>

          {/* 1. Incident Type Multi-Toggle Bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Tipo de Incidencia:
              </span>
              <div className="flex items-center gap-2 text-[10px]">
                <button
                  onClick={handleSelectAllCategories}
                  className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline cursor-pointer"
                >
                  Mostrar todos
                </button>
                <span className="text-zinc-300 dark:text-zinc-700">•</span>
                <button
                  onClick={handleClearCategories}
                  className="text-zinc-500 dark:text-zinc-400 hover:underline cursor-pointer"
                >
                  Ocultar todos
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {ALL_CATEGORIES.map((cat) => {
                const isSelected = selectedCategories.has(cat);
                const meta = CATEGORY_META[cat];
                // Count of this category inside Asunción
                const count = reports.filter(r => r.category === cat && isLocationInAsuncion(r.location.lat, r.location.lng)).length;

                return (
                  <button
                    key={cat}
                    onClick={() => handleToggleCategory(cat)}
                    className={`flex items-center justify-between px-3 py-2 rounded-2xl border text-xs transition cursor-pointer active:scale-98 ${
                      isSelected
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500/50 text-zinc-900 dark:text-zinc-100 shadow-2xs'
                        : 'bg-zinc-50 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-800 text-zinc-400 dark:text-zinc-500 opacity-60 hover:opacity-80'
                    }`}
                    title={isSelected ? `Ocultar ${meta.label} del mapa` : `Mostrar ${meta.label} en el mapa`}
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="text-sm">{meta.icon}</span>
                      <span className={`font-bold truncate ${isSelected ? 'text-zinc-900 dark:text-zinc-100' : 'line-through text-zinc-400'}`}>
                        {meta.short}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 ml-1">
                      <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-black ${
                        isSelected 
                          ? 'bg-emerald-600 text-white' 
                          : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-500'
                      }`}>
                        {count}
                      </span>
                      {isSelected ? (
                        <Eye className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <EyeOff className="w-3.5 h-3.5 text-zinc-400" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Date Filter Range Bar */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                <Calendar className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                <span>Fecha del Reporte:</span>
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              {[
                { id: 'all', label: 'Histórico (Todas)' },
                { id: 'today', label: 'Hoy' },
                { id: '7days', label: 'Últimos 7 días' },
                { id: '30days', label: 'Últimos 30 días' },
                { id: 'this_month', label: 'Este mes' },
                { id: 'custom', label: 'Personalizado...' }
              ].map((preset) => {
                const isActive = datePreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    onClick={() => setDatePreset(preset.id as DatePreset)}
                    className={`px-3 py-1 rounded-xl border text-xs transition cursor-pointer ${
                      isActive
                        ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-bold border-zinc-900 dark:border-zinc-100 shadow-2xs'
                        : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>

            {/* Custom Date Pickers (Shown if 'custom' is selected) */}
            {datePreset === 'custom' && (
              <div className="flex flex-wrap items-center gap-3 p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 text-xs animate-in fade-in duration-150">
                <div className="flex items-center gap-2">
                  <span className="text-zinc-500 font-semibold">Desde:</span>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1 text-xs text-zinc-800 dark:text-zinc-200 font-medium focus:border-emerald-500 focus:outline-hidden cursor-pointer"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-zinc-500 font-semibold">Hasta:</span>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1 text-xs text-zinc-800 dark:text-zinc-200 font-medium focus:border-emerald-500 focus:outline-hidden cursor-pointer"
                  />
                </div>
                {(customStartDate || customEndDate) && (
                  <button
                    onClick={() => {
                      setCustomStartDate('');
                      setCustomEndDate('');
                    }}
                    className="text-[11px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 underline cursor-pointer"
                  >
                    Limpiar fechas
                  </button>
                )}
              </div>
            )}
          </div>

          {/* 3. Barrio and Status Dropdowns */}
          <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80 flex flex-wrap items-center justify-between gap-2.5 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-zinc-400 font-semibold">Ubicación y Estado:</span>
              <select
                value={filterBarrio}
                onChange={(e) => setFilterBarrio(e.target.value)}
                className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-xs text-zinc-800 dark:text-zinc-200 font-medium focus:border-emerald-500 cursor-pointer"
              >
                <option value="Todos">Todos los Barrios de Asunción</option>
                {ASUNCION_BARRIOS.map((b) => (
                  <option key={b} value={b}>
                    Barrio {b}
                  </option>
                ))}
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-xs text-zinc-800 dark:text-zinc-200 font-medium focus:border-emerald-500 cursor-pointer"
              >
                <option value="Todos">Todos los Estados</option>
                <option value="Pendiente">🟡 Pendientes</option>
                <option value="En revisión">🔵 En revisión</option>
                <option value="Solucionado">🟢 Solucionados</option>
              </select>
            </div>

            <div className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
              Mostrando <strong className="text-zinc-900 dark:text-zinc-100">{filteredReports.length}</strong> de {asuncionReportsCount} reportes en Asunción
            </div>
          </div>
        </div>

        {/* Public Transparency & Open Data Export Bar */}
        <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <div className="flex flex-wrap items-center gap-1.5 font-medium">
              <span className="font-bold text-zinc-800 dark:text-zinc-200">Portal de Transparencia Vial:</span>
              <span>
                {filteredReports.length} {filteredReports.length === 1 ? 'incidencia visible' : 'incidencias visibles'}
              </span>
              {isFiltersModified && (
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                  Filtros activos
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-bold transition active:scale-95 border border-zinc-200/80 dark:border-zinc-700 shadow-2xs cursor-pointer"
              title="Descargar listado actual en formato CSV para análisis en Excel o LibreOffice"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Exportar CSV</span>
            </button>

            <button
              onClick={() => setIsTransparencyModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition active:scale-95 shadow-sm shadow-emerald-600/20 cursor-pointer"
              title="Generar y visualizar el reporte oficial consolidado de auditoría para guardar o imprimir en PDF"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Reporte Consolidado PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Map or Card List */}
      {activeTab === 'map' ? (
        <div className="relative rounded-3xl overflow-hidden border border-zinc-200/80 dark:border-zinc-800 shadow-md">
          <div ref={mapContainerRef} className="w-full h-[520px] bg-zinc-100 dark:bg-zinc-950 z-0" />
          
          {/* Legend */}
          <div className="absolute top-3 right-3 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md p-3 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-lg text-xs space-y-1.5 z-10">
            <div className="font-bold text-zinc-800 dark:text-zinc-200 text-[11px] uppercase tracking-wider mb-1">
              Estado de Reparación
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
              <span className="text-zinc-700 dark:text-zinc-300">Pendiente</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
              <span className="text-zinc-700 dark:text-zinc-300">En revisión</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <span className="text-zinc-700 dark:text-zinc-300">Solucionado</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredReports.map((report) => (
            <div
              key={report.id}
              onClick={() => setSelectedReport(report)}
              className="cursor-pointer rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-sm hover:shadow-xl hover:border-emerald-500/50 dark:hover:border-emerald-500/50 transition-all overflow-hidden flex flex-col group"
            >
              <div className="relative h-44 bg-zinc-950 overflow-hidden">
                <img
                  src={report.photoUrl}
                  alt={report.category}
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                />
                <div className="absolute top-3 left-3 flex items-center gap-1.5">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold text-white shadow-xs ${
                    report.status === 'Solucionado' ? 'bg-emerald-600' :
                    report.status === 'En revisión' ? 'bg-blue-600' : 'bg-amber-600'
                  }`}>
                    {report.status}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-black/60 backdrop-blur-xs text-white text-[10px] font-semibold">
                    {report.severity}
                  </span>
                </div>
                <div className="absolute bottom-2.5 left-3 right-3 text-white text-xs truncate drop-shadow-md">
                  <span className="font-bold block truncate">{report.location.address}</span>
                  <span className="text-[11px] text-white/80">{report.location.barrio}</span>
                </div>
              </div>

              <div className="p-4 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
                    <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">{report.id}</span>
                    <span>{new Date(report.createdAt).toLocaleDateString('es-PY')}</span>
                  </div>
                  <h4 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm group-hover:text-emerald-600 transition">
                    {report.category}
                  </h4>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 line-clamp-2">
                    {report.description}
                  </p>
                </div>

                <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
                  <span className="truncate">Por: <strong>{report.citizenName}</strong></span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-0.5 group-hover:translate-x-0.5 transition">
                    Detalles →
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail Inspection Modal */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-zinc-900 shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="relative h-60 bg-zinc-950 shrink-0">
              <img
                src={selectedReport.photoUrl}
                alt={selectedReport.category}
                className="w-full h-full object-cover"
              />
              <button
                onClick={() => setSelectedReport(null)}
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/90 transition"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="absolute bottom-3 left-3 flex gap-2">
                <span className={`px-3 py-1 rounded-full text-xs font-bold text-white shadow-md ${
                  selectedReport.status === 'Solucionado' ? 'bg-emerald-600' :
                  selectedReport.status === 'En revisión' ? 'bg-blue-600' : 'bg-amber-600'
                }`}>
                  {selectedReport.status}
                </span>
                <span className="px-2.5 py-1 rounded-full bg-zinc-900/80 backdrop-blur-xs text-white text-xs font-semibold">
                  Gravedad: {selectedReport.severity}
                </span>
              </div>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">{selectedReport.id}</span>
                  <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{selectedReport.category}</h3>
                </div>
                <span className="text-xs text-zinc-400">
                  {new Date(selectedReport.createdAt).toLocaleString('es-PY')}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 space-y-2 text-xs">
                <div className="flex items-start gap-2 text-zinc-700 dark:text-zinc-300">
                  <MapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">{selectedReport.location.address}</span>
                    <span className="text-zinc-500">Barrio {selectedReport.location.barrio}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300 pt-1 border-t border-zinc-200 dark:border-zinc-700">
                  <span className="text-zinc-400">Ciudadano:</span>
                  <span className="font-bold text-zinc-900 dark:text-zinc-100">{selectedReport.citizenName}</span>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">
                  Descripción
                </h4>
                <p className="text-sm text-zinc-700 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-800/40 p-3 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                  {selectedReport.description}
                </p>
              </div>

              {selectedReport.resolutionNotes && (
                <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-3.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5 mb-1">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    Bitácora Municipal
                  </h4>
                  <p className="text-xs text-emerald-900 dark:text-emerald-200">
                    {selectedReport.resolutionNotes}
                  </p>
                </div>
              )}

              <button
                onClick={() => setSelectedReport(null)}
                className="w-full rounded-2xl bg-zinc-900 dark:bg-zinc-100 py-3 text-sm font-bold text-white dark:text-zinc-900 transition"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Public Consolidated Transparency Report Modal (PDF & CSV) */}
      <CitizenTransparencyReportModal
        isOpen={isTransparencyModalOpen}
        onClose={() => setIsTransparencyModalOpen(false)}
        reports={filteredReports}
        filterSummary={{
          category: selectedCategories.size === ALL_CATEGORIES.length 
            ? 'Todas' 
            : Array.from(selectedCategories).map(c => CATEGORY_META[c]?.label || c).join(', ') || 'Ninguna seleccionada',
          barrio: filterBarrio,
          status: filterStatus,
          owner: filterOwner,
          date: datePreset === 'all' 
            ? 'Histórico completo' 
            : datePreset === 'today' 
            ? 'Hoy' 
            : datePreset === '7days' 
            ? 'Últimos 7 días' 
            : datePreset === '30days' 
            ? 'Últimos 30 días' 
            : datePreset === 'this_month' 
            ? 'Este mes' 
            : `${customStartDate || 'Inicio'} a ${customEndDate || 'Hoy'}`
        }}
      />
    </div>
  );
};
