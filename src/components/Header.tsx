import React, { useState, useEffect } from 'react';
import { userStore } from '../store/userStore';
import { reportStore } from '../store/reportStore';
import { calculateCitizenContribution } from '../utils/contributionUtils';
import { PWAInstallButton } from './PWAInstallButton';
import { ThemeToggle } from './ThemeToggle';
import { citizenIdentifier } from '../utils/citizenIdentity';
import { 
  PlusCircle, 
  Map as MapIcon, 
  BarChart3, 
  User, 
  Sparkles,
  ShieldCheck,
  Award,
  Trophy
} from 'lucide-react';

interface Props {
  activeView: 'report' | 'map' | 'ranking' | 'admin' | 'admin';
  setActiveView: (view: 'report' | 'map' | 'ranking' | 'admin' | 'admin') => void;
  onOpenIdentityModal: () => void;
  onOpenContributionModal?: () => void;
}

export const Header: React.FC<Props> = ({ 
  activeView, 
  setActiveView, 
  onOpenIdentityModal,
  onOpenContributionModal 
}) => {
  const [citizen, setCitizen] = useState(userStore.getCitizen());
  const [admin, setAdmin] = useState(userStore.getAdmin());
  const [reports, setReports] = useState(reportStore.getReports());

  useEffect(() => {
    const unsubUser = userStore.subscribe(() => {
      setCitizen(userStore.getCitizen());
      setAdmin(userStore.getAdmin());
    });
    const unsubReports = reportStore.subscribe((reps) => {
      setReports(reps);
    });
    return () => {
      unsubUser();
      unsubReports();
    };
  }, []);

  const contribution = citizen ? calculateCitizenContribution(citizenIdentifier(citizen), reports) : null;

  return (
    <>
      {/* Top Navbar with Glassmorphic styling */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-200/80 dark:border-zinc-800/80 transition-colors overflow-x-clip">
        <div className="max-w-[1400px] mx-auto px-2.5 sm:px-5 min-h-16 py-2 flex items-center justify-between gap-1.5 sm:gap-2.5">
          {/* Brand Logo & Title */}
          <div 
            onClick={() => setActiveView('report')}
            className="flex items-center gap-1.5 sm:gap-2.5 cursor-pointer group shrink-0"
          >
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-linear-to-tr from-emerald-600 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition shrink-0">
              <img src="/icon.svg" alt="Asunción" className="w-4 h-4 sm:w-6 sm:h-6 invert dark:invert-0" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 whitespace-nowrap">
                <span className="font-black text-zinc-900 dark:text-zinc-50 text-xs sm:text-base tracking-tight">
                  Asunción <span className="hidden sm:inline text-emerald-600 dark:text-emerald-400">Se Levanta</span>
                </span>
                <span className="hidden 2xl:inline-block px-1.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[10px] font-black uppercase">
                  PWA
                </span>
              </div>
              <p className="hidden 2xl:block text-[11px] text-zinc-500 dark:text-zinc-400 font-medium whitespace-nowrap">
                Voz Ciudadana y Gestión Vial
              </p>
            </div>
          </div>

          {/* Desktop Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-0.5 lg:gap-1 bg-zinc-100/80 dark:bg-zinc-900/80 p-1 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 shrink-0">
            <button
              onClick={() => setActiveView('report')}
              className={`flex items-center gap-1.5 px-2.5 lg:px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeView === 'report'
                  ? 'bg-white dark:bg-zinc-800 text-emerald-600 dark:text-emerald-400 shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              <PlusCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Reportar</span>
            </button>

            <button
              onClick={() => setActiveView('map')}
              className={`flex items-center gap-1.5 px-2.5 lg:px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeView === 'map'
                  ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              <MapIcon className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Mapa</span>
            </button>

            <button
              onClick={() => setActiveView('ranking')}
              className={`flex items-center gap-1.5 px-2.5 lg:px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeView === 'ranking'
                  ? 'bg-white dark:bg-zinc-800 text-amber-600 dark:text-amber-400 shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              <Trophy className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span>Ranking</span>
            </button>

            <button
              onClick={() => setActiveView('admin')}
              className={`flex items-center gap-1.5 px-2.5 lg:px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeView === 'admin'
                  ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Panel Admin {admin && '✓'}</span>
            </button>


          </nav>

          {/* Right Action Area */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {/* Dark/Light Mode Switcher */}
            <ThemeToggle />

            {/* PWA Button */}
            <PWAInstallButton />

            {/* Contribution Level & Badges Pill */}
            {citizen && contribution && (
              <button
                onClick={onOpenContributionModal}
                className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/90 dark:border-amber-800/70 hover:border-amber-400 hover:bg-amber-100/50 dark:hover:bg-amber-900/30 text-amber-900 dark:text-amber-200 text-xs font-bold transition shadow-xs group cursor-pointer whitespace-nowrap shrink-0"
                title="Ver tu Nivel de Contribución e Insignias Ciudadanas"
              >
                <span className="text-base leading-none group-hover:scale-115 transition transform">{contribution.levelBadgeIcon}</span>
                <span className="text-xs font-black text-amber-900 dark:text-amber-100">
                  Nivel {contribution.levelNumber}
                </span>
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-200/80 dark:bg-amber-900/80 text-[10px] font-black text-amber-950 dark:text-amber-200">
                  <Award className="w-3 h-3 text-amber-600 dark:text-amber-300" />
                  <span>{contribution.unlockedBadgesCount}</span>
                </span>
              </button>
            )}

            {/* Personalized Citizen Welcome Badge */}
            {citizen ? (
              <button
                onClick={onOpenIdentityModal}
                className="flex items-center gap-2 p-1 sm:px-2.5 sm:py-1.5 rounded-full sm:rounded-2xl bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200/80 dark:border-zinc-700/80 hover:border-emerald-500 transition text-left group whitespace-nowrap shrink-0 cursor-pointer"
                title="Haz clic para modificar tu C.I. o nombre"
              >
                <div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-950/80 flex items-center justify-center text-emerald-700 dark:text-emerald-300 text-xs font-black shrink-0">
                  {citizen.fullName.charAt(0).toUpperCase()}
                </div>
                <div className="hidden sm:block">
                  <span className="block text-xs font-bold text-zinc-800 dark:text-zinc-200 leading-tight group-hover:text-emerald-600 transition">
                    ¡Hola, {citizen.fullName.split(' ')[0]}!
                  </span>
                  <span className="text-[10px] text-zinc-400 font-mono">C.I. {citizen.id}</span>
                </div>
              </button>
            ) : (
              <button
                onClick={onOpenIdentityModal}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition active:scale-95 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <User className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">Identificarme</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation (Native App Style) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-xl border-t border-zinc-200/80 dark:border-zinc-800/80 px-3 py-2 flex items-center justify-around shadow-lg">
        <button
          onClick={() => setActiveView('report')}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl text-[10px] font-bold transition ${
            activeView === 'report' ? 'text-emerald-600 dark:text-emerald-400 font-black' : 'text-zinc-500 dark:text-zinc-400'
          }`}
        >
          <PlusCircle className="w-5 h-5" />
          <span>Reportar</span>
        </button>

        <button
          onClick={() => setActiveView('map')}
          className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl text-[10px] font-bold transition ${
            activeView === 'map' ? 'text-emerald-600 dark:text-emerald-400 font-black' : 'text-zinc-500 dark:text-zinc-400'
          }`}
        >
          <MapIcon className="w-5 h-5" />
          <span>Mapa</span>
        </button>

        <button
          onClick={() => setActiveView('ranking')}
          className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl text-[10px] font-bold transition ${
            activeView === 'ranking' ? 'text-amber-600 dark:text-amber-400 font-black' : 'text-zinc-500 dark:text-zinc-400'
          }`}
        >
          <Trophy className="w-5 h-5" />
          <span>Ranking</span>
        </button>

        <button
          onClick={() => setActiveView('admin')}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl text-[10px] font-bold transition ${
            activeView === 'admin' ? 'text-emerald-600 dark:text-emerald-400 font-black' : 'text-zinc-500 dark:text-zinc-400'
          }`}
        >
          <BarChart3 className="w-5 h-5" />
          <span>Admin</span>
        </button>

      </div>
    </>
  );
};
