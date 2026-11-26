import React, { useState, useEffect, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { IncidentReport, IncidentCategory, IncidentStatus } from '../types';
import { calculateCategoryStatusMetrics, calculateStatusDistribution, CategoryStatusMetric } from '../utils/chartData';
import { themeStore } from '../store/themeStore';
import { 
  BarChart3, 
  PieChart as PieIcon, 
  Layers, 
  Columns, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  Sparkles,
  TrendingUp,
  Percent,
  Info
} from 'lucide-react';

interface Props {
  reports: IncidentReport[];
  selectedCategory?: IncidentCategory | 'Todas';
  onSelectCategory?: (cat: IncidentCategory | 'Todas') => void;
  selectedStatus?: IncidentStatus | 'Todos';
  onSelectStatus?: (st: IncidentStatus | 'Todos') => void;
}

const STATUS_COLORS: Record<IncidentStatus, string> = {
  'Solucionado': '#10b981', // emerald-500
  'En revisión': '#3b82f6', // blue-500
  'Pendiente': '#f59e0b'    // amber-500
};

export const AdminCategoryStatusChart: React.FC<Props> = ({
  reports,
  selectedCategory = 'Todas',
  onSelectCategory,
  selectedStatus = 'Todos',
  onSelectStatus
}) => {
  const [theme, setTheme] = useState<'light' | 'dark'>(themeStore.getTheme());
  const [chartMode, setChartMode] = useState<'stacked' | 'grouped' | 'pie'>('stacked');
  const [highlightedCategory, setHighlightedCategory] = useState<string | null>(null);

  useEffect(() => {
    return themeStore.subscribe((t) => setTheme(t));
  }, []);

  const isDark = theme === 'dark';

  // Derived metrics
  const categoryMetrics = useMemo(() => calculateCategoryStatusMetrics(reports), [reports]);
  const statusDistribution = useMemo(() => calculateStatusDistribution(reports), [reports]);

  const totalReports = reports.length;
  const totalSolucionados = reports.filter(r => r.status === 'Solucionado').length;
  const totalPendientes = reports.filter(r => r.status === 'Pendiente').length;
  const totalEnRevision = reports.filter(r => r.status === 'En revisión').length;
  const tasaGlobal = totalReports > 0 ? Math.round((totalSolucionados / totalReports) * 100) : 0;

  // Category with highest pending count
  const mostPendingCategory = useMemo(() => {
    return [...categoryMetrics].sort((a, b) => b.Pendiente - a.Pendiente)[0];
  }, [categoryMetrics]);

  // Category with highest resolution rate
  const bestResolvedCategory = useMemo(() => {
    return [...categoryMetrics]
      .filter(c => c.total > 0)
      .sort((a, b) => b.resolutionRate - a.resolutionRate)[0];
  }, [categoryMetrics]);

  // Dynamic styling for chart elements based on theme
  const axisColor = isDark ? '#71717a' : '#a1a1aa'; // zinc-500 / zinc-400
  const tickColor = isDark ? '#d4d4d8' : '#3f3f46'; // zinc-300 / zinc-700
  const gridColor = isDark ? '#27272a' : '#e4e4e7'; // zinc-800 / zinc-200

  // Custom Tooltip for BarChart
  const CustomBarTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;

    const currentMetric = categoryMetrics.find(c => c.shortName === label || c.category === label);
    const catTotal = currentMetric ? currentMetric.total : 0;
    const catRate = currentMetric ? currentMetric.resolutionRate : 0;

    return (
      <div className="rounded-2xl bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md p-3.5 border border-zinc-200 dark:border-zinc-800 shadow-xl text-xs space-y-2 min-w-[210px]">
        <div className="flex items-center justify-between pb-1.5 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-1.5 font-bold text-zinc-900 dark:text-zinc-50">
            <span>{currentMetric?.icon || '📍'}</span>
            <span>{currentMetric?.category || label}</span>
          </div>
          <span className="font-mono font-bold text-[11px] text-zinc-400">
            {catTotal} total
          </span>
        </div>

        <div className="space-y-1.5">
          {payload.map((entry: any) => {
            const status = entry.dataKey as IncidentStatus;
            const count = entry.value;
            const pct = catTotal > 0 ? Math.round((count / catTotal) * 100) : 0;
            const color = STATUS_COLORS[status] || entry.color;

            return (
              <div key={status} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-zinc-700 dark:text-zinc-300 font-medium">
                    {status}
                  </span>
                </div>
                <div className="font-mono font-bold text-zinc-900 dark:text-zinc-100">
                  {count} <span className="text-[10px] text-zinc-400 font-normal">({pct}%)</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
          <span>Tasa de resolución:</span>
          <span>{catRate}%</span>
        </div>
      </div>
    );
  };

  // Custom Tooltip for PieChart
  const CustomPieTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const item = payload[0];
    return (
      <div className="rounded-2xl bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md p-3 border border-zinc-200 dark:border-zinc-800 shadow-xl text-xs space-y-1">
        <div className="flex items-center gap-2 font-bold text-zinc-900 dark:text-zinc-50">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.payload.color }} />
          <span>Estado: {item.name}</span>
        </div>
        <div className="font-mono font-bold text-zinc-700 dark:text-zinc-300">
          {item.value} incidencias ({item.payload.percentage}%)
        </div>
      </div>
    );
  };

  return (
    <div 
      data-testid="admin-recharts-panel" 
      className="rounded-3xl bg-white dark:bg-zinc-900 p-6 border border-zinc-200/80 dark:border-zinc-800 shadow-sm transition-colors space-y-5"
    >
      {/* Panel Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
              <BarChart3 className="w-4 h-4" />
            </span>
            <span className="text-xs font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Analítica Visual Recharts
            </span>
          </div>
          <h2 className="text-base sm:text-lg font-black text-zinc-900 dark:text-zinc-50 tracking-tight mt-0.5">
            Conteo de Reportes por Categoría y Estado de Reparación
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Comparativa multidimensional del avance operativo en las calles de Asunción
          </p>
        </div>

        {/* Chart View Switcher */}
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200/60 dark:border-zinc-700/60 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setChartMode('stacked')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              chartMode === 'stacked'
                ? 'bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
            title="Ver gráfico en barras apiladas"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Apilado</span>
          </button>

          <button
            type="button"
            onClick={() => setChartMode('grouped')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              chartMode === 'grouped'
                ? 'bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
            title="Ver gráfico en barras agrupadas por estado"
          >
            <Columns className="w-3.5 h-3.5" />
            <span>Agrupado</span>
          </button>

          <button
            type="button"
            onClick={() => setChartMode('pie')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              chartMode === 'pie'
                ? 'bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
            title="Ver distribución porcentual global"
          >
            <PieIcon className="w-3.5 h-3.5" />
            <span>Distribución</span>
          </button>
        </div>
      </div>

      {/* Quick Insight Micro-Badges */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs text-zinc-600 dark:text-zinc-400 font-medium">Tasa Global de Reparación:</span>
          </div>
          <span className="font-mono font-black text-xs text-emerald-600 dark:text-emerald-400">
            {tasaGlobal}% ({totalSolucionados}/{totalReports})
          </span>
        </div>

        <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-xs text-zinc-600 dark:text-zinc-400 font-medium">Mayor rezago pendiente:</span>
          </div>
          <span className="font-bold text-xs text-zinc-900 dark:text-zinc-100 flex items-center gap-1">
            <span>{mostPendingCategory?.icon}</span>
            <span>{mostPendingCategory?.shortName} ({mostPendingCategory?.Pendiente})</span>
          </span>
        </div>

        <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="text-xs text-zinc-600 dark:text-zinc-400 font-medium">Mayor efectividad:</span>
          </div>
          <span className="font-bold text-xs text-zinc-900 dark:text-zinc-100 flex items-center gap-1">
            <span>{bestResolvedCategory?.icon}</span>
            <span>{bestResolvedCategory?.shortName} ({bestResolvedCategory?.resolutionRate}%)</span>
          </span>
        </div>
      </div>

      {/* Main Recharts Visualization Canvas */}
      <div className="w-full h-80 sm:h-96 pt-2">
        {chartMode !== 'pie' ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={categoryMetrics}
              margin={{ top: 20, right: 20, left: -10, bottom: 25 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
              <XAxis
                dataKey="shortName"
                stroke={axisColor}
                tick={{ fill: tickColor, fontSize: 12, fontWeight: 600 }}
                tickLine={{ stroke: gridColor }}
                axisLine={{ stroke: gridColor }}
                tickFormatter={(value, index) => {
                  const meta = categoryMetrics[index];
                  return `${meta?.icon || ''} ${value}`;
                }}
              />
              <YAxis
                stroke={axisColor}
                tick={{ fill: tickColor, fontSize: 11 }}
                tickLine={{ stroke: gridColor }}
                axisLine={{ stroke: gridColor }}
                allowDecimals={false}
              />
              <Tooltip content={<CustomBarTooltip />} />
              <Legend
                verticalAlign="top"
                align="right"
                iconType="circle"
                wrapperStyle={{ paddingBottom: '12px', fontSize: '12px' }}
                formatter={(value: string) => {
                  const labelMap: Record<string, string> = {
                    'Pendiente': '🟡 Pendiente de intervención',
                    'En revisión': '🔵 En cuadrilla / En revisión',
                    'Solucionado': '🟢 Solucionado / Reparado'
                  };
                  return (
                    <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                      {labelMap[value] || value}
                    </span>
                  );
                }}
              />
              <Bar
                dataKey="Solucionado"
                name="Solucionado"
                stackId={chartMode === 'stacked' ? 'a' : undefined}
                fill={STATUS_COLORS['Solucionado']}
                radius={chartMode === 'stacked' ? [0, 0, 4, 4] : [6, 6, 0, 0]}
                animationDuration={600}
              />
              <Bar
                dataKey="En revisión"
                name="En revisión"
                stackId={chartMode === 'stacked' ? 'a' : undefined}
                fill={STATUS_COLORS['En revisión']}
                radius={chartMode === 'stacked' ? [0, 0, 0, 0] : [6, 6, 0, 0]}
                animationDuration={600}
              />
              <Bar
                dataKey="Pendiente"
                name="Pendiente"
                stackId={chartMode === 'stacked' ? 'a' : undefined}
                fill={STATUS_COLORS['Pendiente']}
                radius={chartMode === 'stacked' ? [6, 6, 0, 0] : [6, 6, 0, 0]}
                animationDuration={600}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-12 h-full items-center gap-4">
            {/* Donut Chart: Overall Status */}
            <div className="md:col-span-6 h-full flex flex-col items-center justify-center">
              <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400 mb-1">
                Estado General de Todos los Reportes
              </span>
              <div className="w-full h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusDistribution}
                      dataKey="count"
                      nameKey="status"
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={95}
                      paddingAngle={4}
                      animationDuration={600}
                    >
                      {statusDistribution.map((entry) => (
                        <Cell key={`cell-${entry.status}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomPieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center justify-center gap-4 text-xs font-semibold">
                {statusDistribution.map((entry) => (
                  <div key={entry.status} className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                    <span className="text-zinc-700 dark:text-zinc-300">
                      {entry.status}: <strong>{entry.count}</strong> ({entry.percentage}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Category Resolution Rate Bars */}
            <div className="md:col-span-6 space-y-3.5 p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-800">
              <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center justify-between">
                <span>Eficiencia de Reparación por Categoría</span>
                <span className="text-zinc-400">% Solucionados</span>
              </div>
              {categoryMetrics.map((cat) => (
                <div key={cat.category} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                      <span>{cat.icon}</span>
                      <span>{cat.displayName}</span>
                    </span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {cat.resolutionRate}% ({cat.Solucionado}/{cat.total})
                    </span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden flex">
                    <div
                      className="bg-emerald-500 h-full transition-all duration-500"
                      style={{ width: `${cat.resolutionRate}%` }}
                      title={`Solucionados: ${cat.Solucionado}`}
                    />
                    <div
                      className="bg-blue-500 h-full transition-all duration-500"
                      style={{ width: `${cat.total > 0 ? (cat['En revisión'] / cat.total) * 100 : 0}%` }}
                      title={`En revisión: ${cat['En revisión']}`}
                    />
                    <div
                      className="bg-amber-500 h-full transition-all duration-500"
                      style={{ width: `${cat.total > 0 ? (cat.Pendiente / cat.total) * 100 : 0}%` }}
                      title={`Pendiente: ${cat.Pendiente}`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Interactive Category Breakdown Cards (Drilldown / Filtering) */}
      <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-700 dark:text-zinc-300">
            <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
            <span>Ficha Detallada por Categoría (Haz clic para filtrar la tabla y mapa):</span>
          </div>
          {selectedCategory !== 'Todas' && onSelectCategory && (
            <button
              onClick={() => onSelectCategory('Todas')}
              className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              Restablecer categoría
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {categoryMetrics.map((cat) => {
            const isSelected = selectedCategory === cat.category;

            return (
              <div
                key={cat.category}
                onClick={() => {
                  if (onSelectCategory) {
                    onSelectCategory(isSelected ? 'Todas' : cat.category);
                  }
                }}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer text-left ${
                  isSelected
                    ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-500 ring-2 ring-emerald-500/20'
                    : 'bg-zinc-50/70 dark:bg-zinc-800/40 border-zinc-200/60 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-bold text-xs text-zinc-900 dark:text-zinc-100">
                    <span className="text-base">{cat.icon}</span>
                    <span className="truncate">{cat.shortName}</span>
                  </span>
                  <span className="px-2 py-0.5 rounded-lg bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-[11px] font-bold">
                    {cat.total}
                  </span>
                </div>

                {/* Status Chips */}
                <div className="mt-2.5 grid grid-cols-3 gap-1 text-center font-mono">
                  <div 
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onSelectStatus) onSelectStatus('Pendiente');
                      if (onSelectCategory) onSelectCategory(cat.category);
                    }}
                    className="p-1 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-bold hover:bg-amber-500/20"
                    title="Ver pendientes"
                  >
                    <span className="block text-[9px] uppercase font-sans">Pend.</span>
                    <span>{cat.Pendiente}</span>
                  </div>

                  <div 
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onSelectStatus) onSelectStatus('En revisión');
                      if (onSelectCategory) onSelectCategory(cat.category);
                    }}
                    className="p-1 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-bold hover:bg-blue-500/20"
                    title="Ver en revisión"
                  >
                    <span className="block text-[9px] uppercase font-sans">Cuad.</span>
                    <span>{cat['En revisión']}</span>
                  </div>

                  <div 
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onSelectStatus) onSelectStatus('Solucionado');
                      if (onSelectCategory) onSelectCategory(cat.category);
                    }}
                    className="p-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold hover:bg-emerald-500/20"
                    title="Ver solucionados"
                  >
                    <span className="block text-[9px] uppercase font-sans">Sol.</span>
                    <span>{cat.Solucionado}</span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-2.5">
                  <div className="flex justify-between text-[10px] text-zinc-500 dark:text-zinc-400 mb-1">
                    <span>Avance</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">{cat.resolutionRate}%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                      style={{ width: `${cat.resolutionRate}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
