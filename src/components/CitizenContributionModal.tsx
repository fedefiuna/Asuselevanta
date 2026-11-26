import React from 'react';
import { CitizenUser, IncidentReport } from '../types';
import { calculateCitizenContribution } from '../utils/contributionUtils';
import { citizenIdentifier } from '../utils/citizenIdentity';
import { 
  Award, 
  Trophy, 
  Medal, 
  Sparkles, 
  CheckCircle2, 
  Clock, 
  MapPin, 
  X, 
  ChevronRight, 
  ShieldCheck, 
  Lock, 
  TrendingUp,
  Star,
  PlusCircle,
  HelpCircle
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  citizen: CitizenUser | null;
  reports: IncidentReport[];
  onOpenReportForm?: () => void;
  onOpenRanking?: () => void;
}

export const CitizenContributionModal: React.FC<Props> = ({
  isOpen,
  onClose,
  citizen,
  reports,
  onOpenReportForm,
  onOpenRanking
}) => {
  if (!isOpen || !citizen) return null;

  const contribution = calculateCitizenContribution(citizenIdentifier(citizen), reports);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-5 backdrop-blur-md overflow-y-auto animate-in fade-in">
      <div className="w-full max-w-2xl rounded-3xl bg-white dark:bg-zinc-900 shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden my-auto max-h-[92vh] flex flex-col text-zinc-900 dark:text-zinc-100">
        
        {/* Header Hero with Level Gradient */}
        <div className={`p-6 sm:p-7 bg-linear-to-r ${contribution.levelColor} text-white relative overflow-hidden`}>
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none" />
          
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-black/20 hover:bg-black/35 text-white transition cursor-pointer"
            aria-label="Cerrar modal"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-3xl shadow-lg shrink-0">
                {contribution.levelBadgeIcon}
              </div>
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-white/20 backdrop-blur-md text-[11px] font-black uppercase tracking-wider mb-1">
                  <Sparkles className="w-3 h-3 text-amber-300" />
                  {contribution.levelTag}
                </div>
                <h2 className="text-xl sm:text-2xl font-black tracking-tight">
                  {citizen.fullName}
                </h2>
                <p className="text-xs text-white/80">
                  {contribution.levelTitle} • Contribuyente Cívico de Asunción
                </p>
              </div>
            </div>

            {/* Badges counter chip */}
            <div className="bg-black/25 backdrop-blur-md border border-white/20 rounded-2xl p-3 sm:text-right shrink-0">
              <div className="text-[10px] uppercase font-bold text-white/70">
                Insignias Obtenidas
              </div>
              <div className="text-xl sm:text-2xl font-black text-amber-300 flex items-center sm:justify-end gap-1">
                <Trophy className="w-5 h-5" />
                <span>{contribution.unlockedBadgesCount} / {contribution.badges.length}</span>
              </div>
            </div>
          </div>

          {/* Level Progress Bar to Next Tier */}
          <div className="mt-5 pt-4 border-t border-white/20 space-y-1.5">
            <div className="flex justify-between text-xs font-semibold text-white/90">
              <span>
                {contribution.nextLevelTitle 
                  ? `Progreso hacia ${contribution.nextLevelTitle}` 
                  : '¡Nivel Máximo de Contribución Alcanzado!'}
              </span>
              <span>
                {contribution.nextLevelTitle 
                  ? `${contribution.currentValidatedCount} validados (${contribution.reportsNeededForNextLevel} más para subir)`
                  : '10+ reportes validados'}
              </span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-black/30 overflow-hidden p-0.5">
              <div 
                className="h-full bg-linear-to-r from-amber-300 to-amber-400 rounded-full transition-all duration-500 shadow-sm"
                style={{ width: `${Math.max(6, contribution.levelProgressPercent)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 sm:p-7 overflow-y-auto space-y-6">
          
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
                Total Reportes
              </span>
              <span className="text-xl font-black text-zinc-900 dark:text-zinc-100 mt-1 block">
                {contribution.totalSubmittedCount}
              </span>
              <span className="text-[10px] text-zinc-400">cargados por ti</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60">
              <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider block">
                Validados
              </span>
              <span className="text-xl font-black text-blue-600 dark:text-blue-400 mt-1 block">
                {contribution.currentValidatedCount}
              </span>
              <span className="text-[10px] text-blue-600/80 dark:text-blue-400/80 font-medium">suman para tu nivel</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60">
              <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider block">
                Solucionados
              </span>
              <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1 block">
                {contribution.solvedCount}
              </span>
              <span className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 font-medium">asfalto reparado</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60">
              <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider block">
                En Espera
              </span>
              <span className="text-xl font-black text-amber-600 dark:text-amber-400 mt-1 block">
                {contribution.pendingCount}
              </span>
              <span className="text-[10px] text-amber-600/80 dark:text-amber-400/80 font-medium">pendientes de revisión</span>
            </div>
          </div>

          {/* Badges Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Tus Insignias Ciudadanas</span>
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Reconocimientos otorgados por tu fiscalización activa en Asunción
                </p>
              </div>

              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-xl border border-emerald-200 dark:border-emerald-800">
                {contribution.unlockedBadgesCount} Desbloqueadas
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {contribution.badges.map((badge) => {
                const isUnlocked = badge.isUnlocked;

                return (
                  <div
                    key={badge.id}
                    className={`p-3.5 rounded-2xl border transition relative overflow-hidden flex items-start gap-3 ${
                      isUnlocked
                        ? 'bg-white dark:bg-zinc-800/80 border-emerald-500/40 shadow-sm'
                        : 'bg-zinc-50 dark:bg-zinc-800/30 border-zinc-200 dark:border-zinc-800 opacity-70'
                    }`}
                  >
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0 shadow-inner ${
                      isUnlocked
                        ? 'bg-linear-to-tr from-emerald-100 to-teal-50 dark:from-emerald-950 dark:to-teal-900/60 border border-emerald-300 dark:border-emerald-700'
                        : 'bg-zinc-200 dark:bg-zinc-800 grayscale border border-zinc-300 dark:border-zinc-700'
                    }`}>
                      {badge.icon}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1.5 mb-1">
                        <h4 className={`text-xs font-black leading-snug ${isUnlocked ? 'text-zinc-900 dark:text-zinc-50' : 'text-zinc-600 dark:text-zinc-400'}`}>
                          {badge.name}
                        </h4>
                        {isUnlocked ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/80 px-2 py-0.5 rounded-full shrink-0">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            Ganada
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-zinc-400 bg-zinc-200 dark:bg-zinc-800 px-2 py-0.5 rounded-full shrink-0">
                            <Lock className="w-2.5 h-2.5" />
                            Bloqueada
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] text-zinc-600 dark:text-zinc-300 line-clamp-2 leading-relaxed">
                        {badge.description}
                      </p>

                      <div className="mt-2 text-[10px] font-medium text-zinc-500 dark:text-zinc-400 flex flex-wrap items-center justify-between gap-1">
                        <span>{badge.requirementDesc}</span>
                        <span className={`font-bold ${isUnlocked ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-400'}`}>
                          {badge.progressText}
                        </span>
                      </div>

                      {!isUnlocked && (
                        <div className="mt-1 w-full h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
                          <div 
                            className="h-full bg-emerald-500 rounded-full"
                            style={{ width: `${badge.progress}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Tier Escalation System Information */}
          <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 p-4 border border-zinc-200 dark:border-zinc-800 space-y-2.5 text-xs">
            <h4 className="font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
              <HelpCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>¿Cómo funciona el Nivel de Contribución?</span>
            </h4>
            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed text-[11px]">
              Cada irregularidad que reportes (bache, basura, badén, alcantarilla) suma para tu perfil local. Cuando el equipo técnico o la cuadrilla municipal clasifica tu reporte en <strong>«En revisión»</strong> o <strong>«Solucionado»</strong>, cuenta automáticamente como <strong>reporte validado</strong> para subir de nivel y desbloquear insignias cívicas.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
              <div className="p-2 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                <span className="font-bold block text-zinc-800 dark:text-zinc-200">🥉 Nivel 1</span>
                <span className="text-zinc-500 text-[10px]">0 - 1 validados</span>
              </div>
              <div className="p-2 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                <span className="font-bold block text-zinc-800 dark:text-zinc-200">🥈 Nivel 2</span>
                <span className="text-zinc-500 text-[10px]">2 - 4 validados</span>
              </div>
              <div className="p-2 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                <span className="font-bold block text-zinc-800 dark:text-zinc-200">🥇 Nivel 3</span>
                <span className="text-zinc-500 text-[10px]">5 - 9 validados</span>
              </div>
              <div className="p-2 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                <span className="font-bold block text-zinc-800 dark:text-zinc-200">💎 Nivel 4</span>
                <span className="text-zinc-500 text-[10px]">10+ validados</span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:px-6 bg-zinc-50 dark:bg-zinc-800/50 border-t border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            Fomentando la participación ciudadana en Asunción
          </span>

          <div className="flex flex-wrap items-center gap-2">
            {onOpenRanking && (
              <button
                onClick={() => {
                  onClose();
                  onOpenRanking();
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-800 dark:text-amber-200 text-xs font-bold transition active:scale-95 cursor-pointer"
              >
                <Trophy className="w-3.5 h-3.5 text-amber-500" />
                <span>Ver Top Ciudadano</span>
              </button>
            )}

            {onOpenReportForm && (
              <button
                onClick={() => {
                  onClose();
                  onOpenReportForm();
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition active:scale-95 cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Nuevo Reporte</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 text-zinc-800 dark:text-zinc-200 text-xs font-bold transition cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
