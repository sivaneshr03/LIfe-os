import { create } from 'zustand';
import type { UserPreferencesData, ThemeMode, AccentColor, FontSize, Density, BorderRadius, ReducedMotion } from '../../shared/types';

interface ThemeState extends UserPreferencesData {
  setThemeMode: (mode: ThemeMode) => void;
  setAccentColor: (color: AccentColor) => void;
  setFontSize: (size: FontSize) => void;
  setDensity: (density: Density) => void;
  setBorderRadius: (radius: BorderRadius) => void;
  setReducedMotion: (motion: ReducedMotion) => void;
  toggleSidebar: () => void;
  setPreferences: (prefs: Partial<UserPreferencesData>) => void;
  applyToDom: () => void;
}

const PREFS_STORAGE_KEY = 'lifeos_ui_prefs';

function loadStoredPreferences(): Partial<UserPreferencesData> {
  if (typeof globalThis.localStorage === 'undefined') return {};
  try {
    const raw = globalThis.localStorage.getItem(PREFS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Partial<UserPreferencesData>) : {};
  } catch {
    return {};
  }
}

function saveStoredPreferences(prefs: UserPreferencesData) {
  if (typeof globalThis.localStorage === 'undefined') return;
  try {
    const { themeMode, accentColor, fontSize, density, borderRadius, reducedMotion, sidebarCollapsed } = prefs;
    globalThis.localStorage.setItem(
      PREFS_STORAGE_KEY,
      JSON.stringify({ themeMode, accentColor, fontSize, density, borderRadius, reducedMotion, sidebarCollapsed })
    );
  } catch {
    // Silently ignore storage errors (e.g. incognito/disabled)
  }
}

const defaultPrefs: UserPreferencesData = {
  themeMode: 'system',
  accentColor: 'emerald',
  fontSize: 'normal',
  density: 'comfortable',
  borderRadius: 'medium',
  reducedMotion: 'system',
  sidebarCollapsed: false,
};

export const useThemeStore = create<ThemeState>((set, get) => ({
  ...defaultPrefs,
  ...loadStoredPreferences(),

  applyToDom: () => {
    if (typeof document === 'undefined') return;
    const { themeMode, accentColor, fontSize, density, borderRadius, reducedMotion } = get();
    const root = document.documentElement;

    // Theme Mode
    const isDark =
      themeMode === 'dark' ||
      (themeMode === 'system' &&
        typeof window !== 'undefined' &&
        window.matchMedia &&
        window.matchMedia('(prefers-color-scheme: dark)').matches);
    root.classList.toggle('dark', Boolean(isDark));

    // Data Attributes
    root.setAttribute('data-accent', accentColor);
    root.setAttribute('data-font-size', fontSize);
    root.setAttribute('data-density', density);
    root.setAttribute('data-radius', borderRadius);
    root.setAttribute('data-reduced-motion', reducedMotion);
  },

  setThemeMode: (mode) => {
    set({ themeMode: mode });
    get().applyToDom();
    saveStoredPreferences(get());
  },

  setAccentColor: (color) => {
    set({ accentColor: color });
    get().applyToDom();
    saveStoredPreferences(get());
  },

  setFontSize: (size) => {
    set({ fontSize: size });
    get().applyToDom();
    saveStoredPreferences(get());
  },

  setDensity: (density) => {
    set({ density });
    get().applyToDom();
    saveStoredPreferences(get());
  },

  setBorderRadius: (radius) => {
    set({ borderRadius: radius });
    get().applyToDom();
    saveStoredPreferences(get());
  },

  setReducedMotion: (motion) => {
    set({ reducedMotion: motion });
    get().applyToDom();
    saveStoredPreferences(get());
  },

  toggleSidebar: () => {
    set((state) => {
      const next = !state.sidebarCollapsed;
      return { sidebarCollapsed: next };
    });
    saveStoredPreferences(get());
  },

  setPreferences: (prefs) => {
    set((state) => ({ ...state, ...prefs }));
    get().applyToDom();
    saveStoredPreferences(get());
  },
}));

// Setup listener for system theme changes when in 'system' mode
if (typeof window !== 'undefined' && window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (useThemeStore.getState().themeMode === 'system') {
      useThemeStore.getState().applyToDom();
    }
  });
}
