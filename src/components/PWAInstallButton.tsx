import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Smartphone, X } from 'lucide-react';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [showAndroidGuide, setShowAndroidGuide] = useState(false);

  if (isInstalled) {
    return (
      <span className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-xl text-[11px] sm:text-xs font-bold bg-emerald-600 text-white shadow-sm shadow-emerald-600/20 whitespace-nowrap shrink-0">
        <Smartphone className="w-3.5 h-3.5 text-emerald-100 shrink-0" />
        <span>App Instalada</span>
      </span>
    );
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="inline-flex items-center gap-1 sm:gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-2 sm:px-3 py-1.5 text-[11px] sm:text-xs font-bold text-white shadow-sm shadow-emerald-600/20 transition active:scale-95 cursor-pointer whitespace-nowrap shrink-0"
      >
        <Download className="w-3.5 h-3.5 shrink-0" />
        <span>Instalar app en Android</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="inline-flex items-center gap-1 sm:gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-2 sm:px-3 py-1.5 text-[11px] sm:text-xs font-bold text-white shadow-sm shadow-emerald-600/20 transition active:scale-95 cursor-pointer whitespace-nowrap shrink-0"
        >
          <Smartphone className="w-3.5 h-3.5 text-white shrink-0" />
          <span>Instalar app en Android</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
            <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-zinc-900 p-6 shadow-2xl animate-in fade-in zoom-in-95 border border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-emerald-600" />
                  Instalar en tu Dispositivo
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="mt-4 space-y-3 text-sm text-zinc-600 dark:text-zinc-300">
                <div className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950 text-xs font-bold text-emerald-700 dark:text-emerald-300">1</span>
                  <p>Toca el botón <strong>Compartir</strong> en la barra inferior de Safari (o menú <strong>⋮</strong> en Chrome Android).</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950 text-xs font-bold text-emerald-700 dark:text-emerald-300">2</span>
                  <p>Selecciona <strong>«Agregar a Inicio»</strong> o <strong>«Instalar aplicación»</strong>.</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950 text-xs font-bold text-emerald-700 dark:text-emerald-300">3</span>
                  <p>¡Listo! La app quedará en tu pantalla de inicio.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-6 w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 py-2.5 text-sm font-bold text-white transition cursor-pointer"
              >
                Entendido
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowAndroidGuide(true)}
        className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-[11px] sm:text-xs font-bold text-white shadow-sm shadow-emerald-600/20 transition active:scale-95 cursor-pointer whitespace-nowrap shrink-0"
        title="Instalar aplicación en Android"
      >
        <Smartphone className="w-3.5 h-3.5 text-white shrink-0" />
        <span>Instalar app en Android</span>
      </button>

      {showAndroidGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-zinc-900 p-6 shadow-2xl animate-in fade-in zoom-in-95 border border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-emerald-600" />
                Instalar app en Android
              </h3>
              <button
                type="button"
                onClick={() => setShowAndroidGuide(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 cursor-pointer"
                aria-label="Cerrar guía de instalación"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="mt-4 space-y-3 text-sm text-zinc-600 dark:text-zinc-300">
              <div className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950 text-xs font-bold text-emerald-700 dark:text-emerald-300">1</span>
                <p>Abre esta página desde <strong>Google Chrome</strong> en tu teléfono Android.</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950 text-xs font-bold text-emerald-700 dark:text-emerald-300">2</span>
                <p>Toca el menú superior derecho <strong>(⋮)</strong> y selecciona <strong>«Instalar aplicación»</strong> o <strong>«Agregar a pantalla principal»</strong>.</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950 text-xs font-bold text-emerald-700 dark:text-emerald-300">3</span>
                <p>Confirma para acceder con un toque, GPS nativo y pantalla completa.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowAndroidGuide(false)}
              className="mt-6 w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 py-2.5 text-sm font-bold text-white transition cursor-pointer"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
};
