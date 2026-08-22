import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

interface ThemeState {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
  setResolvedTheme: (theme: ResolvedTheme) => void;
}

export const THEME_STORAGE_KEY = 'sprintdesk.theme.v1';
const THEME_STORAGE_VERSION = 1;

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

function persistedPreference(value: unknown): ThemePreference {
  if (!value || typeof value !== 'object') return 'system';
  const record = value as Record<string, unknown>;
  const candidate = record.preference ?? record.theme;
  return isThemePreference(candidate) ? candidate : 'system';
}

const themeStorage = createJSONStorage<{ preference: ThemePreference }>(() => ({
  getItem: (name) => {
    try {
      return localStorage.getItem(name);
    } catch {
      return JSON.stringify({
        state: { preference: 'system' },
        version: THEME_STORAGE_VERSION,
      });
    }
  },
  removeItem: (name) => {
    try {
      localStorage.removeItem(name);
    } catch {
      // Theme persistence is an enhancement; the in-memory preference still works.
    }
  },
  setItem: (name, value) => {
    try {
      localStorage.setItem(name, value);
    } catch {
      // Theme persistence is an enhancement; the in-memory preference still works.
    }
  },
}));

export function resolveThemePreference(
  preference: ThemePreference,
  systemPrefersDark: boolean,
): ResolvedTheme {
  return preference === 'system'
    ? systemPrefersDark
      ? 'dark'
      : 'light'
    : preference;
}

export function applyResolvedTheme(theme: ResolvedTheme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.dataset.theme = theme;
  const themeColor = document.querySelector<HTMLMetaElement>(
    'meta[name="theme-color"]',
  );
  themeColor?.setAttribute('content', theme === 'dark' ? '#0b1120' : '#f8fafc');
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      preference: 'system',
      resolvedTheme: 'light',
      setPreference: (preference) => set({ preference }),
      setResolvedTheme: (resolvedTheme) => set({ resolvedTheme }),
    }),
    {
      name: THEME_STORAGE_KEY,
      storage: themeStorage,
      version: THEME_STORAGE_VERSION,
      migrate: (persistedState) => ({
        preference: persistedPreference(persistedState),
      }),
      merge: (persistedState, currentState) => ({
        ...currentState,
        preference: persistedPreference(persistedState),
      }),
      partialize: (state) => ({ preference: state.preference }),
      onRehydrateStorage: (state) => (hydratedState, error) => {
        if (error) state.setPreference('system');
        else if (hydratedState) {
          hydratedState.setPreference(hydratedState.preference);
        }
      },
    },
  ),
);
