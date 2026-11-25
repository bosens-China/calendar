import { create } from 'zustand';

export type ThemePreference = 'auto' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'calendar_theme_pref';

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolvePreference(pref: ThemePreference): ResolvedTheme {
  return pref === 'auto' ? getSystemTheme() : pref;
}

function readInitialPreference(): ThemePreference {
  if (typeof window === 'undefined') return 'auto';
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved === 'auto' || saved === 'light' || saved === 'dark') return saved;
  return 'auto';
}

function applyThemeToDom(resolved: ResolvedTheme) {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', resolved === 'dark');
  document.documentElement.style.colorScheme = resolved;
}

interface ThemeState {
  theme: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: ThemePreference) => void;
  cycleTheme: () => void;
}

const initialPref = readInitialPreference();
const initialResolved = resolvePreference(initialPref);
applyThemeToDom(initialResolved);

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: initialPref,
  resolvedTheme: initialResolved,
  setTheme: (theme) => {
    window.localStorage.setItem(STORAGE_KEY, theme);
    const resolved = resolvePreference(theme);
    applyThemeToDom(resolved);
    set({ theme, resolvedTheme: resolved });
  },
  cycleTheme: () => {
    const order: ThemePreference[] = ['auto', 'light', 'dark'];
    const idx = order.indexOf(get().theme);
    get().setTheme(order[(idx + 1) % order.length]);
  },
}));

if (typeof window !== 'undefined' && window.matchMedia) {
  const mql = window.matchMedia('(prefers-color-scheme: dark)');
  mql.addEventListener('change', () => {
    const state = useThemeStore.getState();
    if (state.theme === 'auto') {
      const resolved = getSystemTheme();
      applyThemeToDom(resolved);
      useThemeStore.setState({ resolvedTheme: resolved });
    }
  });
}
