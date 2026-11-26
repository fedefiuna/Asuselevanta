import React, { useState, useEffect } from 'react';
import { themeStore, ThemeMode } from '../store/themeStore';
import { Sun, Moon } from 'lucide-react';

interface Props {
  showLabel?: boolean;
  className?: string;
}

export const ThemeToggle: React.FC<Props> = ({ showLabel = false, className = '' }) => {
  const [theme, setTheme] = useState<ThemeMode>(themeStore.getTheme());

  useEffect(() => {
    return themeStore.subscribe((t) => setTheme(t));
  }, []);

  return (
    <button
      type="button"
      onClick={() => themeStore.toggleTheme()}
      className={`relative inline-flex items-center gap-2 p-2 rounded-xl transition-all duration-300 cursor-pointer ${
        theme === 'dark'
          ? 'bg-zinc-800 text-amber-300 hover:bg-zinc-700 hover:text-amber-200 border border-zinc-700/60 shadow-inner'
          : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 hover:text-zinc-900 border border-zinc-200 shadow-xs'
      } ${className}`}
      title={theme === 'dark' ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
      aria-label="Alternar tema claro y oscuro"
    >
      <div className="relative w-5 h-5 flex items-center justify-center">
        {theme === 'dark' ? (
          <Moon className="w-4 h-4 transition-transform duration-300 rotate-0 scale-100" />
        ) : (
          <Sun className="w-4 h-4 transition-transform duration-300 rotate-0 scale-100 text-amber-500" />
        )}
      </div>
      {showLabel && (
        <span className="text-xs font-semibold">
          {theme === 'dark' ? 'Modo Oscuro' : 'Modo Claro'}
        </span>
      )}
    </button>
  );
};
