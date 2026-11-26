import React, { useState } from 'react';
import { IncidentReport, CitizenUser } from '../types';
import { getLeaderboard, CitizenLeaderboardEntry } from '../utils/contributionUtils';
import { citizenIdentifier } from '../utils/citizenIdentity';
import { 
  Trophy, 
  Award, 
  Medal, 
  Search, 
  Sparkles, 
  CheckCircle2, 
  Clock, 
  MapPin, 
  PlusCircle, 
  User, 
  TrendingUp,
  Filter,
  Flame,
  Crown
} from 'lucide-react';

interface Props {
  reports: IncidentReport[];
  currentCitizen: CitizenUser | null;
  onOpenReportForm: () => void;
  onOpenIdentityModal: () => void;
  onOpenContributionModal: () => void;
}

export const CitizenRankingView: React.FC<Props> = ({
  reports,
  currentCitizen,
  onOpenReportForm,
  onOpenIdentityModal,
  onOpenContributionModal
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLevel, setFilterLevel] = useState<number | 'all'>('all');

  const leaderboard = getLeaderboard(reports);

  // Filtered leaderboard
  const filteredLeaderboard = leaderboard.filter((entry) => {
    if (filterLevel !== 'all' && entry.levelNumber !== filterLevel) {
      return false;
    }
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase().trim();
      const matchName = entry.displayName.toLowerCase().includes(q);
      const matchBarrio = entry.recentBarrios.some(b => b.toLowerCase().includes(q));
      if (!matchName && !matchBarrio) return false;
    }
    return true;
  });

  // Find current citizen in leaderboard
  const currentIdentifier = citizenIdentifier(currentCitizen);
  const isCurrentEntry = (e: CitizenLeaderboardEntry) =>
    Boolean(currentIdentifier) &&
    (e.citizenKey
      ? e.citizenKey === currentIdentifier
      : e.citizenName.toLowerCase().trim() === currentIdentifier!.toLowerCase().trim());
  const currentCitizenEntry = currentIdentifier ? leaderboard.find(isCurrentEntry) : null;

  const topThree = leaderboard.slice(0, 3);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="rounded-3xl bg-linear-to-r from-amber-600 via-amber-700 to-orange-800 p-6 sm:p-8 text-white shadow-xl shadow-amber-600/15 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-80 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-white text-xs font-bold backdrop-blur-md mb-2">
              <Flame className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
              <span>Transparencia y Participación Ciudadana</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Top de Contribuciones Ciudadanas
            </h1>
            <p className="text-xs sm:text-sm text-amber-100 mt-1.5 leading-relaxed">
              Ranking público en tiempo real de los vecinos que fiscalizan y reportan irregularidades viales en Asunción. Cada reporte validado por cuadrilla técnica suma puntos para subir de nivel.
            </p>
          </div>

          <div className="flex flex-wrap sm:flex-col gap-2 shrink-0">
            <button
              onClick={onOpenReportForm}
              className="px-4 py-2.5 rounded-2xl bg-white text-amber-900 font-black text-xs shadow-lg hover:bg-amber-50 transition active:scale-95 flex items-center gap-1.5 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4 text-emerald-600" />
              <span>Sumar un Reporte</span>
            </button>

            {currentCitizen ? (
              <button
                onClick={onOpenContributionModal}
                className="px-4 py-2.5 rounded-2xl bg-white/15 hover:bg-white/25 border border-white/20 text-white font-bold text-xs backdrop-blur-md transition flex items-center gap-1.5 cursor-pointer"
              >
                <Award className="w-4 h-4 text-amber-300" />
                <span>Mis Insignias</span>
              </button>
            ) : (
              <button
                onClick={onOpenIdentityModal}
                className="px-4 py-2.5 rounded-2xl bg-white/15 hover:bg-white/25 border border-white/20 text-white font-bold text-xs backdrop-blur-md transition flex items-center gap-1.5 cursor-pointer"
              >
                <User className="w-4 h-4" />
                <span>Identificarme</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Current User Highlight Card (If logged in) */}
      {currentCitizen && (
        <div className="rounded-3xl bg-linear-to-r from-emerald-600 to-teal-700 p-5 text-white shadow-lg shadow-emerald-600/10 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md border border-white/20 flex items-center justify-center text-xl font-black shrink-0">
              {currentCitizenEntry ? `#${currentCitizenEntry.rank}` : '⭐'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-emerald-200 uppercase tracking-wider">
                  Tu Estado en el Ranking
                </span>
                <span className="inline-block px-2 py-0.5 rounded-full bg-white/25 text-[10px] font-black">
                  {currentCitizenEntry ? `Puesto #${currentCitizenEntry.rank}` : 'Sin reportes aún'}
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-black tracking-tight mt-0.5">
                {currentCitizen.fullName}
              </h3>
              <p className="text-xs text-emerald-100">
                {currentCitizenEntry
                  ? `${currentCitizenEntry.levelBadgeIcon} ${currentCitizenEntry.levelTitle} • ${currentCitizenEntry.validatedCount} reportes validados • ${currentCitizenEntry.solvedCount} solucionados`
                  : 'Carga tu primer reporte vial en Asunción para ingresar al podio.'}
              </p>
            </div>
          </div>

          <button
            onClick={onOpenContributionModal}
            className="px-4 py-2 rounded-2xl bg-white/15 hover:bg-white/25 border border-white/20 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 backdrop-blur-md shrink-0 cursor-pointer"
          >
            <Trophy className="w-3.5 h-3.5 text-amber-300" />
            <span>Ver mi Progreso</span>
          </button>
        </div>
      )}

      {/* Top 3 Podium Cards */}
      {topThree.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-black uppercase tracking-wider text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Crown className="w-4 h-4 text-amber-500" />
              <span>Podio de Honor Asunceno</span>
            </h3>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              Actualizado en tiempo real
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 1st Place (Center on desktop or first) */}
            {topThree[0] && (
              <div className="rounded-3xl bg-linear-to-b from-amber-500/15 via-white dark:via-zinc-900 to-white dark:to-zinc-900 p-6 border-2 border-amber-400 dark:border-amber-500/50 shadow-md relative overflow-hidden order-1 md:order-2 md:-translate-y-2">
                <div className="absolute top-0 right-0 w-24 h-24 bg-amber-400/10 rounded-full blur-xl pointer-events-none" />
                <div className="flex items-center justify-between mb-3">
                  <span className="px-3 py-1 rounded-full bg-amber-400/25 border border-amber-400/40 text-amber-800 dark:text-amber-300 text-xs font-black flex items-center gap-1">
                    <Crown className="w-3.5 h-3.5 text-amber-500" />
                    <span>1° Puesto • Campeón</span>
                  </span>
                  <span className="text-2xl font-black text-amber-500">🥇</span>
                </div>

                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-linear-to-tr from-amber-500 to-amber-300 text-white font-black text-lg flex items-center justify-center shadow-md">
                    {topThree[0].citizenName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-base font-black text-zinc-900 dark:text-zinc-50 truncate" title={topThree[0].displayName}>
                      {topThree[0].displayName}
                    </h4>
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 dark:text-amber-300">
                      <span>{topThree[0].levelBadgeIcon}</span>
                      <span>{topThree[0].levelTitle}</span>
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/30 text-center text-xs">
                  <div>
                    <span className="text-zinc-500 dark:text-zinc-400 text-[10px] uppercase font-bold block">Validados</span>
                    <strong className="text-sm font-black text-amber-700 dark:text-amber-400">{topThree[0].validatedCount}</strong>
                  </div>
                  <div>
                    <span className="text-zinc-500 dark:text-zinc-400 text-[10px] uppercase font-bold block">Resueltos</span>
                    <strong className="text-sm font-black text-emerald-600 dark:text-emerald-400">{topThree[0].solvedCount}</strong>
                  </div>
                  <div>
                    <span className="text-zinc-500 dark:text-zinc-400 text-[10px] uppercase font-bold block">Insignias</span>
                    <strong className="text-sm font-black text-zinc-800 dark:text-zinc-200">{topThree[0].unlockedBadgesCount}</strong>
                  </div>
                </div>

                {topThree[0].recentBarrios.length > 0 && (
                  <div className="mt-3 text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5 truncate">
                    <MapPin className="w-3 h-3 text-amber-500 shrink-0" />
                    <span className="truncate">Barrios: {topThree[0].recentBarrios.join(', ')}</span>
                  </div>
                )}
              </div>
            )}

            {/* 2nd Place */}
            {topThree[1] && (
              <div className="rounded-3xl bg-white dark:bg-zinc-900 p-6 border border-zinc-200/80 dark:border-zinc-800 shadow-sm relative overflow-hidden order-2 md:order-1">
                <div className="flex items-center justify-between mb-3">
                  <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 text-xs font-black flex items-center gap-1">
                    <span>2° Puesto</span>
                  </span>
                  <span className="text-2xl font-black">🥈</span>
                </div>

                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-black text-lg flex items-center justify-center">
                    {topThree[1].citizenName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-base font-black text-zinc-900 dark:text-zinc-50 truncate" title={topThree[1].displayName}>
                      {topThree[1].displayName}
                    </h4>
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-zinc-600 dark:text-zinc-400">
                      <span>{topThree[1].levelBadgeIcon}</span>
                      <span>{topThree[1].levelTitle}</span>
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-800 text-center text-xs">
                  <div>
                    <span className="text-zinc-500 dark:text-zinc-400 text-[10px] uppercase font-bold block">Validados</span>
                    <strong className="text-sm font-black text-zinc-800 dark:text-zinc-200">{topThree[1].validatedCount}</strong>
                  </div>
                  <div>
                    <span className="text-zinc-500 dark:text-zinc-400 text-[10px] uppercase font-bold block">Resueltos</span>
                    <strong className="text-sm font-black text-emerald-600 dark:text-emerald-400">{topThree[1].solvedCount}</strong>
                  </div>
                  <div>
                    <span className="text-zinc-500 dark:text-zinc-400 text-[10px] uppercase font-bold block">Insignias</span>
                    <strong className="text-sm font-black text-zinc-800 dark:text-zinc-200">{topThree[1].unlockedBadgesCount}</strong>
                  </div>
                </div>

                {topThree[1].recentBarrios.length > 0 && (
                  <div className="mt-3 text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5 truncate">
                    <MapPin className="w-3 h-3 text-zinc-400 shrink-0" />
                    <span className="truncate">Barrios: {topThree[1].recentBarrios.join(', ')}</span>
                  </div>
                )}
              </div>
            )}

            {/* 3rd Place */}
            {topThree[2] && (
              <div className="rounded-3xl bg-white dark:bg-zinc-900 p-6 border border-zinc-200/80 dark:border-zinc-800 shadow-sm relative overflow-hidden order-3">
                <div className="flex items-center justify-between mb-3">
                  <span className="px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 text-xs font-black flex items-center gap-1">
                    <span>3° Puesto</span>
                  </span>
                  <span className="text-2xl font-black">🥉</span>
                </div>

                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-black text-lg flex items-center justify-center">
                    {topThree[2].citizenName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-base font-black text-zinc-900 dark:text-zinc-50 truncate" title={topThree[2].displayName}>
                      {topThree[2].displayName}
                    </h4>
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 dark:text-amber-400">
                      <span>{topThree[2].levelBadgeIcon}</span>
                      <span>{topThree[2].levelTitle}</span>
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-800 text-center text-xs">
                  <div>
                    <span className="text-zinc-500 dark:text-zinc-400 text-[10px] uppercase font-bold block">Validados</span>
                    <strong className="text-sm font-black text-zinc-800 dark:text-zinc-200">{topThree[2].validatedCount}</strong>
                  </div>
                  <div>
                    <span className="text-zinc-500 dark:text-zinc-400 text-[10px] uppercase font-bold block">Resueltos</span>
                    <strong className="text-sm font-black text-emerald-600 dark:text-emerald-400">{topThree[2].solvedCount}</strong>
                  </div>
                  <div>
                    <span className="text-zinc-500 dark:text-zinc-400 text-[10px] uppercase font-bold block">Insignias</span>
                    <strong className="text-sm font-black text-zinc-800 dark:text-zinc-200">{topThree[2].unlockedBadgesCount}</strong>
                  </div>
                </div>

                {topThree[2].recentBarrios.length > 0 && (
                  <div className="mt-3 text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5 truncate">
                    <MapPin className="w-3 h-3 text-amber-500 shrink-0" />
                    <span className="truncate">Barrios: {topThree[2].recentBarrios.join(', ')}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Leaderboard Table Card */}
      <div className="rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-sm overflow-hidden">
        {/* Table Filters */}
        <div className="p-5 border-b border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nombre o barrio..."
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-hidden focus:border-amber-500 transition"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">Nivel:</span>
            <div className="flex items-center gap-1">
              {(['all', 1, 2, 3, 4] as const).map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => setFilterLevel(lvl)}
                  className={`px-2.5 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                    filterLevel === lvl
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                  }`}
                >
                  {lvl === 'all' ? 'Todos' : `Nivel ${lvl}`}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* List of Contributors */}
        <div className="divide-y divide-zinc-200/60 dark:divide-zinc-800/60">
          {filteredLeaderboard.length === 0 ? (
            <div className="p-12 text-center text-zinc-500 dark:text-zinc-400">
              <Trophy className="w-8 h-8 text-zinc-300 dark:text-zinc-700 mx-auto mb-2" />
              <p className="text-sm font-semibold">No se encontraron ciudadanos con los filtros actuales.</p>
            </div>
          ) : (
            filteredLeaderboard.map((entry) => {
              const isCurrentUser = isCurrentEntry(entry);

              return (
                <div
                  key={entry.citizenKey || entry.displayName}
                  className={`p-4 sm:px-6 flex items-center justify-between gap-4 transition ${
                    isCurrentUser
                      ? 'bg-amber-50/60 dark:bg-amber-950/20'
                      : 'hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40'
                  }`}
                >
                  {/* Rank and Avatar */}
                  <div className="flex items-center gap-3.5 min-w-0">
                    <span className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                      entry.rank === 1
                        ? 'bg-amber-400 text-amber-950 shadow-sm'
                        : entry.rank === 2
                        ? 'bg-slate-300 text-slate-800'
                        : entry.rank === 3
                        ? 'bg-amber-200 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                    }`}>
                      {entry.rank}
                    </span>

                    <div className="w-10 h-10 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-300 font-black text-sm shrink-0 border border-zinc-200 dark:border-zinc-700">
                      {entry.citizenName.charAt(0).toUpperCase()}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-zinc-900 dark:text-zinc-100 truncate">
                          {entry.displayName}
                        </span>
                        {isCurrentUser && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 text-[10px] font-black uppercase tracking-wider shrink-0">
                            ¡Tú!
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                        <span className="font-bold text-amber-600 dark:text-amber-400">
                          {entry.levelBadgeIcon} {entry.levelTitle}
                        </span>
                        <span>•</span>
                        <span>{entry.unlockedBadgesCount} insignias</span>
                        {entry.recentBarrios.length > 0 && (
                          <>
                            <span className="hidden sm:inline">•</span>
                            <span className="hidden sm:inline truncate max-w-[200px]" title={entry.recentBarrios.join(', ')}>
                              {entry.recentBarrios.join(', ')}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Stats Counter */}
                  <div className="flex items-center gap-4 sm:gap-6 shrink-0">
                    <div className="text-right">
                      <span className="text-base sm:text-lg font-black text-zinc-900 dark:text-zinc-50 block leading-tight">
                        {entry.validatedCount}
                      </span>
                      <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">
                        Validados
                      </span>
                    </div>

                    <div className="text-right hidden sm:block">
                      <span className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400 block leading-tight">
                        {entry.solvedCount}
                      </span>
                      <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">
                        Resueltos
                      </span>
                    </div>

                    <div className="text-right hidden md:block">
                      <span className="text-base sm:text-lg font-black text-zinc-700 dark:text-zinc-300 block leading-tight">
                        {entry.totalReports}
                      </span>
                      <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">
                        Enviados
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
