import { useEffect, type PropsWithChildren } from 'react';
import {
  applyResolvedTheme,
  resolveThemePreference,
  useThemeStore,
} from './theme-store';

const systemDarkQuery = '(prefers-color-scheme: dark)';

export function ThemeProvider({ children }: PropsWithChildren) {
  const preference = useThemeStore((state) => state.preference);
  const setResolvedTheme = useThemeStore((state) => state.setResolvedTheme);

  useEffect(() => {
    const media = window.matchMedia(systemDarkQuery);

    function syncTheme() {
      const resolved = resolveThemePreference(preference, media.matches);
      applyResolvedTheme(resolved);
      setResolvedTheme(resolved);
    }

    syncTheme();
    if (preference === 'system') media.addEventListener('change', syncTheme);
    return () => media.removeEventListener('change', syncTheme);
  }, [preference, setResolvedTheme]);

  return children;
}
