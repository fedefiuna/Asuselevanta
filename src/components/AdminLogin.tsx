import React, { useState } from 'react';
import { userStore } from '../store/userStore';
import { ThemeToggle } from './ThemeToggle';
import { Shield, Lock, Mail, AlertCircle, ArrowRight } from 'lucide-react';

interface Props {
  onLoginSuccess: () => void;
  onCancel?: () => void;
}

export const AdminLogin: React.FC<Props> = ({ onLoginSuccess, onCancel }) => {
  const [email, setEmail] = useState('admin@asuncion.gov.py');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const result = await userStore.loginAdmin(email, password);
    setIsLoading(false);
    if (result.success) {
      onLoginSuccess();
    } else {
      setError(result.error || 'Credenciales no válidas.');
    }
  };

  return (
    <div className="max-w-md mx-auto my-8 rounded-3xl bg-white dark:bg-zinc-900 shadow-2xl border border-zinc-200/80 dark:border-zinc-800 overflow-hidden transition-colors">
      {/* Header */}
      <div className="bg-linear-to-br from-zinc-900 via-zinc-950 to-black p-7 text-white text-center relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
        
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>

        <div className="mx-auto w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center mb-3 border border-white/20 text-emerald-400 shadow-inner">
          <Shield className="w-7 h-7" />
        </div>
        
        <div className="inline-block px-3 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-black tracking-wider uppercase mb-1">
          Ruta Protegida /admin/*
        </div>
        <h2 className="text-xl font-black text-white tracking-tight">
          Centro de Análisis Municipal
        </h2>
        <p className="text-xs text-zinc-400 mt-1">
          Acceso exclusivo para autoridades y fiscalizadores viales
        </p>
      </div>

      <form onSubmit={handleSubmit} className="p-6 sm:p-7 space-y-4">
        {error && (
          <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div>
          <label
            htmlFor="admin-identifier-input"
            className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5"
          >
            Número de C.I. o Correo Institucional
          </label>
          <div className="relative flex items-center">
            <div className="absolute left-3.5 pointer-events-none text-zinc-400">
              <Mail className="w-4 h-4" />
            </div>
            <input
              id="admin-identifier-input"
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-800/60 pl-10 pr-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:border-emerald-500 focus:bg-white dark:focus:bg-zinc-900 focus:outline-hidden focus:ring-3 focus:ring-emerald-500/20 transition"
              placeholder="Ej. 3216549 o admin@asuncion.gov.py"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
            Contraseña
          </label>
          <div className="relative flex items-center">
            <div className="absolute left-3.5 pointer-events-none text-zinc-400">
              <Lock className="w-4 h-4" />
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-800/60 pl-10 pr-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:border-emerald-500 focus:bg-white dark:focus:bg-zinc-900 focus:outline-hidden focus:ring-3 focus:ring-emerald-500/20 transition"
              placeholder="••••••••"
            />
          </div>
        </div>


        <div className="pt-2 flex gap-3">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 rounded-2xl border border-zinc-200 dark:border-zinc-700 py-3 text-sm font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
            >
              Volver
            </button>
          )}
          <button
            type="submit"
            disabled={isLoading}
            className="flex-1 rounded-2xl bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 py-3 text-sm font-black text-white shadow-lg shadow-emerald-600/25 active:scale-98 transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>{isLoading ? 'Autenticando...' : 'Iniciar Sesión'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
};
