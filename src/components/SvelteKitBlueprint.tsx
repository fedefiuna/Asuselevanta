import React, { useState } from 'react';
import { 
  FolderTree, 
  Database, 
  UserCheck, 
  LayoutDashboard, 
  Copy, 
  Check, 
  Code2, 
  ShieldAlert, 
  Moon,
  Sun,
  Palette
} from 'lucide-react';

export const SvelteKitBlueprint: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'theme' | 'tree' | 'citizen' | 'bento'>('theme');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const THEME_CODE = `// 1. tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  darkMode: 'class', // Activación manual mediante clase .dark en <html>
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#ecfdf5',
          100: '#d1fae5',
          500: '#10b981',
          600: '#059669', // Verde esmeralda principal
          700: '#047857'
        }
      }
    }
  },
  plugins: []
};


// 2. src/lib/stores/themeStore.js
import { writable } from 'svelte/store';
import { browser } from '$app/environment';

const STORAGE_KEY = 'asuncion_theme_mode';

function createThemeStore() {
  const initial = browser ? localStorage.getItem(STORAGE_KEY) || 'light' : 'light';
  const { subscribe, set, update } = writable(initial);

  function apply(theme) {
    if (browser) {
      const root = document.documentElement;
      if (theme === 'dark') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
      localStorage.setItem(STORAGE_KEY, theme);
    }
  }

  // Inicializar en navegador
  if (browser) {
    apply(initial);
  }

  return {
    subscribe,
    toggle: () => {
      update(current => {
        const next = current === 'dark' ? 'light' : 'dark';
        apply(next);
        return next;
      });
    },
    setTheme: (theme) => {
      apply(theme);
      set(theme);
    }
  };
}

export const theme = createThemeStore();


// 3. src/routes/+layout.svelte (Script anti-parpadeo y Layout con Toggle)
<script>
  import '../app.css';
  import { theme } from '$lib/stores/themeStore.js';
  import ThemeToggle from '$lib/components/ThemeToggle.svelte';
</script>

<svelte:head>
  <!-- Previene el parpadeo blanco al cargar en modo oscuro -->
  <script>
    if (
      localStorage.getItem('asuncion_theme_mode') === 'dark' ||
      (!('asuncion_theme_mode' in localStorage) &&
        window.matchMedia('(prefers-color-scheme: dark)').matches)
    ) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  </script>
</svelte:head>

<div class="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 transition-colors duration-300">
  <header class="sticky top-0 z-40 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-200 dark:border-zinc-800">
    <div class="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
      <span class="font-black text-lg">Asunción <span class="text-emerald-600 dark:text-emerald-400">Se Levanta</span></span>
      <ThemeToggle />
    </div>
  </header>

  <main>
    <slot />
  </main>
</div>`;

  const CITIZEN_WIZARD_CODE = `<!-- src/lib/components/CitizenReportWizard.svelte -->
<script>
  import { citizenStore } from '$lib/stores/userStore.js';
  import { reportStore } from '$lib/stores/reportStore.js';

  let currentStep = 1;
  let category = 'Bache';
  let address = 'Av. Mariscal López c/ San Martín';
  let barrio = 'Villa Morra';
  let severity = 'Alta';
  let description = '';
  let photoUrl = 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?auto=format&fit=crop&w=600&q=80';

  const categories = [
    { id: 'Bache', icon: '🕳️', desc: 'Hundimientos o pozos asfálticos' },
    { id: 'Badén en mal estado', icon: '〰️', desc: 'Desfondado o canaleta rota' },
    { id: 'Alcantarilla sin tapa', icon: '⚠️', desc: 'Boca de tormenta abierta' },
    { id: 'Suciedad / Basura', icon: '🗑️', desc: 'Vertederos o podas acumuladas' }
  ];

  function handleSubmit() {
    reportStore.addReport({
      category,
      description,
      photoUrl,
      location: { lat: -25.2974, lng: -57.5882, address, barrio },
      citizenName: $citizenStore?.fullName || 'Vecino de Asunción',
      severity
    });
    alert('¡Reporte registrado con éxito!');
  }
</script>

<div class="rounded-3xl bg-white dark:bg-zinc-900 p-6 sm:p-8 shadow-xl border border-zinc-200/80 dark:border-zinc-800">
  <!-- Stepper de 3 Pasos -->
  <div class="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-5 mb-6">
    <div class="grid grid-cols-3 gap-2 w-full">
      {#each [1, 2, 3] as step}
        <button
          on:click={() => currentStep = step}
          class="py-2 px-3 rounded-xl text-xs font-bold transition border {
            currentStep === step 
              ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' 
              : 'border-zinc-200 dark:border-zinc-800 text-zinc-400'
          }"
        >
          Paso {step}
        </button>
      {/each}
    </div>
  </div>

  <!-- Paso 1: Tipo de irregularidad y Foto -->
  {#if currentStep === 1}
    <div class="space-y-4">
      <h3 class="text-sm font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
        1. Selecciona la irregularidad
      </h3>
      <div class="grid grid-cols-2 gap-3">
        {#each categories as c}
          <button
            type="button"
            on:click={() => category = c.id}
            class="p-4 rounded-2xl border-2 text-left transition {
              category === c.id 
                ? 'border-emerald-500 bg-emerald-500/10 dark:bg-emerald-500/15' 
                : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40'
            }"
          >
            <span class="text-2xl">{c.icon}</span>
            <div class="font-bold text-sm mt-2">{c.id}</div>
            <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-1">{c.desc}</p>
          </button>
        {/each}
      </div>

      <button
        on:click={() => currentStep = 2}
        class="w-full mt-4 py-3 rounded-2xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 transition"
      >
        Continuar a Ubicación →
      </button>
    </div>
  {/if}

  <!-- Paso 2: Ubicación en Asunción -->
  {#if currentStep === 2}
    <div class="space-y-4">
      <h3 class="text-sm font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
        2. Ubicación GPS en Asunción
      </h3>
      <!-- Mini-mapa Leaflet interactivo -->
      <div class="h-64 rounded-2xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-xs text-zinc-400">
        Mini-mapa Leaflet interactivo con arrastre de pin o botón GPS
      </div>

      <div class="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 text-xs text-emerald-600 dark:text-emerald-400 font-bold">
        📍 Coordenadas fijadas automáticamente por satélite GPS ({lat}, {lng})
      </div>

      <div class="flex gap-2">
        <button on:click={() => currentStep = 1} class="px-5 py-3 rounded-2xl border border-zinc-200 dark:border-zinc-700 text-sm font-bold">
          Atrás
        </button>
        <button on:click={() => currentStep = 3} class="flex-1 py-3 rounded-2xl bg-emerald-600 text-white font-bold text-sm">
          Siguiente: Confirmar →
        </button>
      </div>
    </div>
  {/if}

  <!-- Paso 3: Confirmación y Envío -->
  {#if currentStep === 3}
    <div class="space-y-4">
      <h3 class="text-sm font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
        3. Confirmar reporte
      </h3>
      <div class="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 text-xs space-y-2">
        <div><strong>Categoría:</strong> {category} ({severity})</div>
        <div><strong>Ubicación GPS:</strong> {lat}, {lng} (Asunción)</div>
        <div><strong>Ciudadano:</strong> {$citizenStore?.fullName || 'Vecino'}</div>
      </div>

      <button
        on:click={handleSubmit}
        class="w-full py-3.5 rounded-2xl bg-linear-to-r from-emerald-600 to-teal-600 text-white font-black text-sm shadow-xl shadow-emerald-600/30"
      >
        Enviar Reporte a la Ciudad
      </button>
    </div>
  {/if}
</div>`;

  const BENTO_ADMIN_CODE = `<!-- src/routes/admin/dashboard/+page.svelte (Bento Grid Layout) -->
<script>
  import { reportStore, reportMetrics } from '$lib/stores/reportStore.js';
  import * as XLSX from 'xlsx';

  function exportExcel() {
    reportStore.exportExcel($reportStore);
  }
</script>

<div class="p-6 max-w-7xl mx-auto space-y-6">
  <!-- Encabezado con Botones de Exportación -->
  <div class="flex items-center justify-between p-5 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-sm">
    <div>
      <h1 class="text-xl font-black text-zinc-900 dark:text-zinc-50">Centro de Operaciones y Métricas</h1>
      <p class="text-xs text-zinc-500 dark:text-zinc-400">Actualización reactiva en tiempo real</p>
    </div>
    <div class="flex gap-2">
      <button on:click={exportExcel} class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-2xl text-xs shadow-md shadow-emerald-600/20">
        Exportar Excel (.xlsx)
      </button>
      <button on:click={() => window.print()} class="bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-bold px-4 py-2 rounded-2xl text-xs border border-zinc-200 dark:border-zinc-700">
        Exportar PDF
      </button>
    </div>
  </div>

  <!-- BENTO GRID PRINCIPAL -->
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
    <!-- Bento 1: Tarjeta Hero (Eficiencia & Total) - Span 2 cols -->
    <div class="lg:col-span-2 rounded-3xl bg-linear-to-br from-emerald-600 via-emerald-700 to-teal-800 p-6 text-white shadow-xl flex flex-col justify-between">
      <div class="flex items-start justify-between">
        <div>
          <span class="text-xs font-bold uppercase tracking-wider bg-white/20 px-3 py-1 rounded-full">
            Eficiencia Vial
          </span>
          <div class="text-4xl font-black mt-3">{$reportMetrics.total} <span class="text-lg font-normal text-emerald-200">casos</span></div>
        </div>
        <div class="bg-white/15 p-3 rounded-2xl text-center">
          <span class="text-3xl font-black text-amber-300">{$reportMetrics.rate}%</span>
          <span class="block text-[10px] uppercase font-bold text-emerald-100">Resueltos</span>
        </div>
      </div>
      <div class="text-xs text-emerald-100 pt-3 border-t border-white/15 mt-4">
        {$reportMetrics.resolved} incidencias resueltas por las cuadrillas municipales.
      </div>
    </div>

    <!-- Bento 2: Pendientes Urgentes -->
    <div class="rounded-3xl bg-white dark:bg-zinc-900 p-5 border border-amber-200/80 dark:border-amber-900/40 bg-amber-50/10 shadow-xs flex flex-col justify-between">
      <span class="text-xs font-bold uppercase text-amber-600 dark:text-amber-400">Pendientes</span>
      <div class="text-3xl font-black text-zinc-900 dark:text-zinc-50">{$reportMetrics.pending}</div>
      <div class="text-xs text-zinc-500 dark:text-zinc-400">A la espera de fiscalización</div>
    </div>

    <!-- Bento 3: En Cuadrilla -->
    <div class="rounded-3xl bg-white dark:bg-zinc-900 p-5 border border-blue-200/80 dark:border-blue-900/40 bg-blue-50/10 shadow-xs flex flex-col justify-between">
      <span class="text-xs font-bold uppercase text-blue-600 dark:text-blue-400">En Cuadrilla</span>
      <div class="text-3xl font-black text-zinc-900 dark:text-zinc-50">{$reportMetrics.inReview}</div>
      <div class="text-xs text-zinc-500 dark:text-zinc-400">Trabajos en ejecución</div>
    </div>
  </div>
</div>`;

  return (
    <div className="rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-xl overflow-hidden transition-colors">
      {/* Header */}
      <div className="bg-zinc-950 p-6 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wider">
              Arquitectura UI/UX Rediseñada
            </span>
            <span className="text-zinc-400 text-xs font-mono">SvelteKit + Tailwind Dark Mode + Bento Grid</span>
          </div>
          <h2 className="text-xl font-black text-white tracking-tight">
            Código y Configuración del Rediseño
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Entregables con sistema de temas Claro/Oscuro, asistente por pasos y grid Bento.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex flex-wrap gap-1 bg-zinc-900 p-1 rounded-2xl self-start md:self-auto border border-zinc-800">
          <button
            onClick={() => setActiveTab('theme')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              activeTab === 'theme' ? 'bg-emerald-600 text-white shadow-xs' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Moon className="w-3.5 h-3.5" />
            <span>1. Modo Dark/Light</span>
          </button>
          <button
            onClick={() => setActiveTab('citizen')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              activeTab === 'citizen' ? 'bg-emerald-600 text-white shadow-xs' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>2. Formulario Asistente</span>
          </button>
          <button
            onClick={() => setActiveTab('bento')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              activeTab === 'bento' ? 'bg-emerald-600 text-white shadow-xs' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>3. Dashboard Bento Grid</span>
          </button>
        </div>
      </div>

      {/* Code Display Area */}
      <div className="p-6">
        {activeTab === 'theme' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  1. Configuración de Tailwind y Layout con Modo Claro / Oscuro
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Incluye `darkMode: 'class'`, script anti-parpadeo FOUC y store reactivo con `localStorage`.
                </p>
              </div>
              <button
                onClick={() => copyToClipboard(THEME_CODE, 'theme')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 text-xs font-bold transition"
              >
                {copiedKey === 'theme' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey === 'theme' ? '¡Copiado!' : 'Copiar Código'}</span>
              </button>
            </div>

            <pre className="p-4 rounded-2xl bg-zinc-950 text-emerald-400 font-mono text-xs overflow-x-auto shadow-inner leading-relaxed">
              {THEME_CODE}
            </pre>
          </div>
        )}

        {activeTab === 'citizen' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  2. Componente de Reporte Rediseñado (Asistente por Pasos Mobile-First)
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Tarjeta flotante tipo wizard: 1. Irregularidad &amp; Foto &rarr; 2. Ubicación GPS &rarr; 3. Confirmación.
                </p>
              </div>
              <button
                onClick={() => copyToClipboard(CITIZEN_WIZARD_CODE, 'citizen')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 text-xs font-bold transition"
              >
                {copiedKey === 'citizen' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey === 'citizen' ? '¡Copiado!' : 'Copiar Componente'}</span>
              </button>
            </div>

            <pre className="p-4 rounded-2xl bg-zinc-950 text-cyan-300 font-mono text-xs overflow-x-auto shadow-inner max-h-[500px] overflow-y-auto leading-relaxed">
              {CITIZEN_WIZARD_CODE}
            </pre>
          </div>
        )}

        {activeTab === 'bento' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  3. Dashboard de Estadísticas en Bento Grid Moderno
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Tarjetas de métricas glassmorphic con gauge de efectividad, exportación Excel/PDF y dark mode.
                </p>
              </div>
              <button
                onClick={() => copyToClipboard(BENTO_ADMIN_CODE, 'bento')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 text-xs font-bold transition"
              >
                {copiedKey === 'bento' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey === 'bento' ? '¡Copiado!' : 'Copiar Dashboard'}</span>
              </button>
            </div>

            <pre className="p-4 rounded-2xl bg-zinc-950 text-amber-200 font-mono text-xs overflow-x-auto shadow-inner max-h-[500px] overflow-y-auto leading-relaxed">
              {BENTO_ADMIN_CODE}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
