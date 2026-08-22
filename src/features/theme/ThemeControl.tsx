import { Icon } from '../../components/ui/Icon';
import { useThemeStore, type ThemePreference } from './theme-store';

export function ThemeControl() {
  const preference = useThemeStore((state) => state.preference);
  const resolvedTheme = useThemeStore((state) => state.resolvedTheme);
  const setPreference = useThemeStore((state) => state.setPreference);

  return (
    <div className="relative flex items-center">
      <Icon
        className="pointer-events-none absolute left-3"
        name={resolvedTheme === 'dark' ? 'moon' : 'sun'}
      />
      <label className="sr-only" htmlFor="theme-preference">
        Theme
      </label>
      <select
        className="h-10 rounded-lg border bg-surface py-0 pl-10 pr-8 text-sm font-medium text-foreground"
        id="theme-preference"
        onChange={(event) =>
          setPreference(event.target.value as ThemePreference)
        }
        value={preference}
      >
        <option value="system">System theme</option>
        <option value="light">Light theme</option>
        <option value="dark">Dark theme</option>
      </select>
    </div>
  );
}
