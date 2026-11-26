import React, { useState, useEffect } from 'react';
import { userStore } from '../store/userStore';
import { CitizenUser } from '../types';
import { validateCitizenRegistration } from '../utils/userValidation';
import { UserCheck, Sparkles, Phone, ShieldCheck, ArrowRight, X, CreditCard } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentCitizen?: CitizenUser | null;
  onSaved?: (citizen: CitizenUser) => void;
}

export const CitizenIdentificationModal: React.FC<Props> = ({
  isOpen,
  onClose,
  currentCitizen,
  onSaved
}) => {
  const [cedula, setCedula] = useState(currentCitizen?.ci || currentCitizen?.id || '');
  const [fullName, setFullName] = useState(currentCitizen?.fullName || '');
  const [phone, setPhone] = useState(currentCitizen?.phone || '');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setCedula(currentCitizen?.ci || currentCitizen?.id || '');
      setFullName(currentCitizen?.fullName || '');
      setPhone(currentCitizen?.phone || '');
      setError('');
    }
  }, [isOpen, currentCitizen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateCitizenRegistration({ cedula, fullName, phone });
    if (!validation.valid || !validation.data) {
      setError(validation.error || 'Verifica los datos ingresados.');
      return;
    }
    setIsSaving(true);
    setError('');
    try {
      const saved = await userStore.setCitizen(
        validation.data.ci,
        validation.data.fullName,
        validation.data.phone
      );
      if (onSaved) onSaved(saved);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar en la base de datos.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/70 dark:bg-black/80 p-4 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-3xl bg-white dark:bg-zinc-900 shadow-2xl border border-zinc-200/80 dark:border-zinc-800/80 overflow-hidden transform transition-all">
        {/* Header Banner */}
        <div className="bg-linear-to-br from-emerald-600 via-emerald-700 to-teal-800 p-6 text-white text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          
          {currentCitizen && (
            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 right-4 text-white/70 hover:text-white p-1 rounded-full bg-white/10 hover:bg-white/20 transition cursor-pointer"
              aria-label="Cerrar ventana"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          <div className="mx-auto w-14 h-14 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center mb-3 shadow-inner border border-white/20">
            <UserCheck className="w-7 h-7 text-white" />
          </div>
          
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-xs font-semibold tracking-wide uppercase mb-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            Voz Ciudadana de Asunción
          </div>
          <h2 className="text-xl font-black text-white tracking-tight">
            {currentCitizen ? 'Actualizar Mi Identidad' : '¡Bienvenido a Asunción Se Levanta!'}
          </h2>
          <p className="mt-1 text-xs text-emerald-100 max-w-xs mx-auto">
            Regístrate con tu número de cédula (C.I.) para vincular tus reportes viales.
          </p>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-600 dark:text-rose-300 font-semibold">
              {error}
            </div>
          )}

          <div>
            <label
              htmlFor="citizen-ci-input"
              className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5"
            >
              Número de Cédula (C.I.) <span className="text-emerald-500">*</span>
            </label>
            <div className="relative flex items-center">
              <div className="absolute left-3.5 pointer-events-none text-zinc-400">
                <CreditCard className="w-4 h-4" />
              </div>
              <input
                id="citizen-ci-input"
                type="text"
                inputMode="numeric"
                value={cedula}
                onChange={(e) => {
                  setCedula(e.target.value);
                  if (error) setError('');
                }}
                placeholder="Ej. 4567890"
                autoFocus
                className="w-full rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-800/60 pl-10 pr-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:border-emerald-500 focus:bg-white dark:focus:bg-zinc-900 focus:outline-hidden focus:ring-3 focus:ring-emerald-500/20 transition font-mono"
              />
            </div>
            <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
              Tu número de C.I. será tu ID único de ciudadano en la plataforma.
            </p>
          </div>

          <div>
            <label
              htmlFor="citizen-name-input"
              className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5"
            >
              Nombre y Apellido <span className="text-emerald-500">*</span>
            </label>
            <input
              id="citizen-name-input"
              type="text"
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                if (error) setError('');
              }}
              placeholder="Ej. Juan Pérez González"
              className="w-full rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-800/60 px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:border-emerald-500 focus:bg-white dark:focus:bg-zinc-900 focus:outline-hidden focus:ring-3 focus:ring-emerald-500/20 transition"
            />
          </div>

          <div>
            <label
              htmlFor="citizen-phone-input"
              className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5"
            >
              Teléfono / WhatsApp <span className="text-zinc-400 font-normal">(Opcional)</span>
            </label>
            <div className="relative flex items-center">
              <div className="absolute left-3.5 pointer-events-none text-zinc-400">
                <Phone className="w-4 h-4" />
              </div>
              <input
                id="citizen-phone-input"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Ej. 0981 123 456"
                className="w-full rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-800/60 pl-10 pr-4 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:border-emerald-500 focus:bg-white dark:focus:bg-zinc-900 focus:outline-hidden focus:ring-3 focus:ring-emerald-500/20 transition"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 text-[11px] pt-1">
            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>Tus datos son locales y tu C.I. identifica tus reportes sin contraseñas.</span>
          </div>

          <div className="pt-2 flex gap-3">
            {currentCitizen && (
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-2xl border border-zinc-200 dark:border-zinc-700 py-3 text-sm font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition cursor-pointer"
              >
                Cancelar
              </button>
            )}
            <button
              type="submit"
              className="flex-1 rounded-2xl bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 py-3 text-sm font-black text-white shadow-lg shadow-emerald-600/25 active:scale-98 transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>{currentCitizen ? 'Guardar Cambios' : 'Ingresar como Ciudadano'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
