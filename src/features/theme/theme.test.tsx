import { act, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from './ThemeProvider';
import {
  THEME_STORAGE_KEY,
  resolveThemePreference,
  useThemeStore,
} from './theme-store';

describe('theme', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
    useThemeStore.setState({ preference: 'system', resolvedTheme: 'light' });
  });

  it('resolves explicit and system preferences', () => {
    expect(resolveThemePreference('light', true)).toBe('light');
    expect(resolveThemePreference('dark', false)).toBe('dark');
    expect(resolveThemePreference('system', true)).toBe('dark');
  });

  it('persists the selected preference using the versioned key', () => {
    act(() => useThemeStore.getState().setPreference('dark'));
    const stored = JSON.parse(localStorage.getItem(THEME_STORAGE_KEY) ?? '{}');
    expect(stored.state.preference).toBe('dark');
  });

  it('applies system theme and reacts to system changes', () => {
    let listener: (() => void) | undefined;
    const media = {
      matches: true,
      media: '(prefers-color-scheme: dark)',
      onchange: null,
      addEventListener: vi.fn((_event: string, callback: () => void) => { listener = callback; }),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    };
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn(() => media),
    });

    render(<ThemeProvider><div>App</div></ThemeProvider>);
    expect(document.documentElement).toHaveClass('dark');

    media.matches = false;
    act(() => listener?.());
    expect(document.documentElement).not.toHaveClass('dark');
  });
});
