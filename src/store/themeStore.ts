export type ThemeMode = 'light' | 'dark';

const THEME_STORAGE_KEY = 'asuncion_theme_mode';

type ThemeListener = (theme: ThemeMode) => void;
const listeners = new Set<ThemeListener>();

function getInitialTheme(): ThemeMode {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') {
      return saved;
    }
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
  } catch {
    // fallback
  }
  return 'light';
}

let currentTheme: ThemeMode = getInitialTheme();

function applyThemeToDOM(theme: ThemeMode) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }

  // Update meta theme-color for PWA header / status bar
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    metaTheme.setAttribute('content', theme === 'dark' ? '#09090b' : '#059669');
  }
}

// Initial apply
if (typeof window !== 'undefined') {
  applyThemeToDOM(currentTheme);
}

export const themeStore = {
  getTheme(): ThemeMode {
    return currentTheme;
  },

  setTheme(theme: ThemeMode) {
    currentTheme = theme;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (e) {
      console.error(e);
    }
    applyThemeToDOM(theme);
    listeners.forEach((fn) => fn(currentTheme));
  },

  toggleTheme() {
    const next = currentTheme === 'dark' ? 'light' : 'dark';
    this.setTheme(next);
  },

  subscribe(listener: ThemeListener) {
    listeners.add(listener);
    listener(currentTheme);
    return () => {
      listeners.delete(listener);
    };
  }
};
