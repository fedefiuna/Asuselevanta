import React, { useState, useEffect } from 'react';
import { userStore } from './store/userStore';
import { reportStore } from './store/reportStore';
import { themeStore } from './store/themeStore';
import { CitizenUser, IncidentReport } from './types';
import { calculateCitizenContribution } from './utils/contributionUtils';
import { Header } from './components/Header';
import { CitizenIdentificationModal } from './components/CitizenIdentificationModal';
import { CitizenContributionModal } from './components/CitizenContributionModal';
import { CitizenRankingView } from './components/CitizenRankingView';
import { CitizenReportForm } from './components/CitizenReportForm';
import { CitizenMapAndList } from './components/CitizenMapAndList';
import { AdminLogin } from './components/AdminLogin';
import { AdminDashboard } from './components/AdminDashboard';
import { citizenIdentifier } from './utils/citizenIdentity';
import { 
  AlertTriangle, 
  MapPin, 
  Shield, 
  Smartphone, 
  CheckCircle2, 
  Compass, 
  Building2,
  Sparkles,
  ArrowRight,
  Award,
  Trophy
} from 'lucide-react';

export default function App() {
  const [citizen, setCitizen] = useState<CitizenUser | null>(userStore.getCitizen());
  const [reports, setReports] = useState<IncidentReport[]>(reportStore.getReports());
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState<boolean>(!!userStore.getAdmin());
  const [isIdentityModalOpen, setIsIdentityModalOpen] = useState<boolean>(false);
  const [isContributionModalOpen, setIsContributionModalOpen] = useState<boolean>(false);
  const [activeView, setActiveView] = useState<'report' | 'map' | 'ranking' | 'admin' | 'admin'>(() => {
    const hash = typeof window !== 'undefined' ? window.location.hash.replace('#', '') : '';
    if (hash === 'map' || hash === 'ranking' || hash === 'admin' || hash === 'report') {
      return hash;
    }
    return 'report';
  });
  const [isHydrated, setIsHydrated] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash !== `#${activeView}`) {
      window.history.replaceState(null, '', `#${activeView}`);
    }
  }, [activeView]);

  useEffect(() => {
    const unsubUser = userStore.subscribe(() => {
      setCitizen(userStore.getCitizen());
      setIsAdminLoggedIn(!!userStore.getAdmin());
    });
    const unsubReports = reportStore.subscribe((reps) => {
      setReports(reps);
    });
    Promise.all([userStore.init(), reportStore.init()]).finally(() => {
      setIsHydrated(true);
    });
    return () => {
      unsubUser();
      unsubReports();
    };
  }, []);

  const contribution = citizen ? calculateCitizenContribution(citizenIdentifier(citizen), reports) : null;

  // La lista de reportes depende del rol (el admin ve datos completos, el público datos abreviados):
  // al entrar o salir un administrador se vuelve a pedir, para no dejar datos del rol anterior en pantalla.
  const prevAdminRef = React.useRef<boolean | null>(null);
  useEffect(() => {
    if (!isHydrated) return;
    if (prevAdminRef.current !== null && prevAdminRef.current !== isAdminLoggedIn) {
      reportStore.refresh();
    }
    prevAdminRef.current = isAdminLoggedIn;
  }, [isHydrated, isAdminLoggedIn]);

  useEffect(() => {
    if (isHydrated && !citizen && activeView === 'report') {
      const timer = setTimeout(() => {
        setIsIdentityModalOpen(true);
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [isHydrated, citizen, activeView]);

  const handleCitizenSaved = (newCitizen: CitizenUser) => {
    setCitizen(newCitizen);
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col font-sans transition-colors duration-300 pb-16 md:pb-0">
      {/* Main Header with Theme Switcher */}
      <Header
        activeView={activeView}
        setActiveView={setActiveView}
        onOpenIdentityModal={() => setIsIdentityModalOpen(true)}
        onOpenContributionModal={() => setIsContributionModalOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {/* Personalized Welcome Card (Floating Hero) */}
        {activeView === 'report' && citizen && (
          <div className="mb-6 rounded-3xl bg-linear-to-r from-emerald-600 via-emerald-700 to-teal-800 p-6 sm:p-7 text-white shadow-xl shadow-emerald-600/15 relative overflow-hidden">
            <div className="absolute right-0 top-0 w-80 h-80 bg-white/10 rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-white text-xs font-bold backdrop-blur-md">
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    Identidad Verificada • ID (C.I.): {citizen.id}
                  </div>
                  {contribution && (
                    <button
                      onClick={() => setIsContributionModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/25 hover:bg-amber-400/35 text-amber-200 border border-amber-300/30 text-xs font-bold backdrop-blur-md transition cursor-pointer"
                    >
                      <span>{contribution.levelBadgeIcon}</span>
                      <span>Nivel {contribution.levelNumber}: {contribution.levelTitle}</span>
                      <span className="bg-amber-300/30 px-1.5 py-0.5 rounded-full text-[10px] font-black text-amber-100">
                        {contribution.unlockedBadgesCount} / {contribution.badges.length} 🏅
                      </span>
                    </button>
                  )}
                </div>

                <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
                  ¡Hola, {citizen.fullName}! 👋
                </h1>
                <p className="text-xs sm:text-sm text-emerald-100 max-w-xl mt-1 leading-relaxed">
                  Tus reportes se vincularán automáticamente a tu nombre. Con cada reporte validado por el municipio acumulas experiencia y desbloqueas insignias cívicas.
                </p>

                {/* Progress bar to next level */}
                {contribution && (
                  <div className="mt-4 pt-3 border-t border-white/15 max-w-xl">
                    <div className="flex items-center justify-between text-xs text-emerald-100 mb-1.5 font-semibold">
                      <span className="flex items-center gap-1.5">
                        <span>{contribution.levelBadgeIcon} Progreso de Nivel:</span>
                        <strong className="text-white">{contribution.currentValidatedCount} validados</strong>
                        <span className="text-[11px] text-emerald-200/90 font-normal">
                          ({contribution.totalSubmittedCount} reportes en total)
                        </span>
                      </span>
                      <span className="text-[11px] text-emerald-200">
                        {contribution.reportsNeededForNextLevel > 0 
                          ? `Faltan ${contribution.reportsNeededForNextLevel} para ${contribution.nextLevelTitle}` 
                          : '¡Nivel Máximo de Contribución!'}
                      </span>
                    </div>
                    <div className="w-full bg-black/25 rounded-full h-2.5 overflow-hidden backdrop-blur-xs p-0.5 border border-white/10">
                      <div 
                        className="bg-linear-to-r from-amber-300 via-emerald-300 to-teal-200 h-full rounded-full transition-all duration-500 shadow-sm"
                        style={{ width: `${contribution.levelProgressPercent}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap lg:flex-col gap-2.5 shrink-0 self-start lg:self-center">
                {contribution && (
                  <button
                    onClick={() => setIsContributionModalOpen(true)}
                    className="px-4 py-2.5 rounded-2xl bg-amber-400/20 hover:bg-amber-400/30 border border-amber-300/40 text-amber-100 text-xs font-bold transition flex items-center gap-2 backdrop-blur-md cursor-pointer shadow-sm hover:shadow"
                  >
                    <Award className="w-4 h-4 text-amber-300" />
                    <span>Mis Insignias ({contribution.unlockedBadgesCount})</span>
                  </button>
                )}
                <button
                  onClick={() => setActiveView('ranking')}
                  className="px-4 py-2.5 rounded-2xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-300/30 text-amber-100 text-xs font-bold transition flex items-center gap-1.5 backdrop-blur-md cursor-pointer"
                >
                  <Trophy className="w-3.5 h-3.5 text-amber-300" />
                  <span>Ver Top Ciudadano</span>
                </button>
                <button
                  onClick={() => setActiveView('map')}
                  className="px-4 py-2.5 rounded-2xl bg-white/15 hover:bg-white/25 border border-white/20 text-white text-xs font-bold transition flex items-center gap-1.5 backdrop-blur-md cursor-pointer"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Ver Mapa Público</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* View Routing */}
        {activeView === 'report' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-8">
              <CitizenReportForm
                onReportCreated={() => {
                  setActiveView('map');
                }}
                onOpenIdentityModal={() => setIsIdentityModalOpen(true)}
              />
            </div>

            <div className="lg:col-span-4 space-y-4">
              {/* Modern Quick Guide Card */}
              <div className="rounded-3xl bg-white dark:bg-zinc-900 p-6 border border-zinc-200/80 dark:border-zinc-800 shadow-sm transition-colors">
                <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100 font-bold text-sm mb-4">
                  <Compass className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>¿Cómo funciona el reporte?</span>
                </div>
                <ol className="text-xs text-zinc-600 dark:text-zinc-400 space-y-3.5">
                  <li className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 font-bold flex items-center justify-center shrink-0 text-xs">1</span>
                    <span>Elige la categoría y toma o adjunta la foto del asfalto o vereda.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 font-bold flex items-center justify-center shrink-0 text-xs">2</span>
                    <span>Fija el punto en el mapa interactivo o activa tu GPS directo sin escribir datos.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 font-bold flex items-center justify-center shrink-0 text-xs">3</span>
                    <span>Revisa la gravedad y envía. El reporte se vincula a tu nombre sin contraseñas.</span>
                  </li>
                </ol>
              </div>

              {/* PWA Android Banner */}
              <div className="rounded-3xl bg-linear-to-br from-zinc-900 to-zinc-950 text-white p-6 shadow-md border border-zinc-800 relative overflow-hidden">
                <div className="flex items-center gap-2 mb-2">
                  <Smartphone className="w-5 h-5 text-emerald-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                    Instálalo en tu Android
                  </span>
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed mb-3">
                  Esta aplicación está optimizada como Progressive Web App (PWA). Agrégala a tu pantalla de inicio para reportar directo desde la calle con GPS nativo y soporte offline.
                </p>
                <div className="flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span className="text-[11px] text-zinc-400 font-mono">Service Worker Activo</span>
                </div>
              </div>

              {/* Admin Portal Switch */}
              <div className="rounded-3xl bg-white dark:bg-zinc-900 p-5 border border-zinc-200/80 dark:border-zinc-800 shadow-sm transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">¿Eres Analista Municipal?</span>
                  </div>
                  <button
                    onClick={() => setActiveView('admin')}
                    className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                  >
                    <span>Ingresar</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeView === 'map' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight">
                  Mapa Público de Incidencias Viales
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Visualiza el estado de las calles de Asunción en tiempo real con reportes comunitarios.
                </p>
              </div>
              <button
                onClick={() => setActiveView('report')}
                className="px-4 py-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition self-start sm:self-auto active:scale-95"
              >
                + Nuevo Reporte
              </button>
            </div>

            <CitizenMapAndList />
          </div>
        )}

        {activeView === 'ranking' && (
          <CitizenRankingView
            reports={reports}
            currentCitizen={citizen}
            onOpenReportForm={() => setActiveView('report')}
            onOpenIdentityModal={() => setIsIdentityModalOpen(true)}
            onOpenContributionModal={() => setIsContributionModalOpen(true)}
          />
        )}

        {activeView === 'admin' && (
          <div>
            {isAdminLoggedIn ? (
              <AdminDashboard
                onLogout={() => {
                  userStore.logoutAdmin();
                  setIsAdminLoggedIn(false);
                }}
              />
            ) : (
              <AdminLogin
                onLoginSuccess={() => {
                  setIsAdminLoggedIn(true);
                }}
                onCancel={() => setActiveView('report')}
              />
            )}
          </div>
        )}

      </main>

      {/* Citizen Identification Modal */}
      <CitizenIdentificationModal
        isOpen={isIdentityModalOpen}
        onClose={() => setIsIdentityModalOpen(false)}
        currentCitizen={citizen}
        onSaved={handleCitizenSaved}
      />

      {/* Citizen Contribution Level & Badges Modal */}
      <CitizenContributionModal
        isOpen={isContributionModalOpen}
        onClose={() => setIsContributionModalOpen(false)}
        citizen={citizen}
        reports={reports}
        onOpenReportForm={() => {
          setIsContributionModalOpen(false);
          setActiveView('report');
        }}
        onOpenRanking={() => {
          setIsContributionModalOpen(false);
          setActiveView('ranking');
        }}
      />
    </div>
  );
}
