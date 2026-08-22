import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import App from './App';
import { renderWithProviders } from '../test/render';

describe('AppShell', () => {
  it('provides skip navigation and active primary navigation', async () => {
    renderWithProviders(<App />, { route: '/dashboard' });

    const skipLink = await screen.findByRole('link', { name: 'Skip to main content' });
    expect(skipLink).toHaveAttribute('href', '#main-content');
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content');
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');
  });

  it('opens an accessible mobile menu and closes after navigation', async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />, { route: '/dashboard' });
    await screen.findByRole('heading', { name: 'Dashboard' });

    await user.click(screen.getByRole('button', { name: 'Open navigation' }));
    const drawer = screen.getByRole('dialog', { name: 'SprintDesk' });
    await user.click(within(drawer).getByRole('link', { name: 'Board' }));

    expect(await screen.findByRole('heading', { name: 'Board' })).toBeVisible();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes the mobile drawer at the desktop breakpoint and removes its listener', async () => {
    const user = userEvent.setup();
    let changeListener: ((event: MediaQueryListEvent) => void) | undefined;
    let matchesDesktop = false;
    const addEventListener = vi.fn(
      (_event: string, listener: (event: MediaQueryListEvent) => void) => {
        changeListener = listener;
      },
    );
    const removeEventListener = vi.fn();
    const media = {
      get matches() {
        return matchesDesktop;
      },
      media: '(min-width: 1024px)',
      onchange: null,
      addEventListener,
      removeEventListener,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as MediaQueryList;
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn(() => media),
    });

    const view = renderWithProviders(<App />, { route: '/dashboard' });
    await screen.findByRole('heading', { name: 'Dashboard' });
    await user.click(screen.getByRole('button', { name: 'Open navigation' }));
    expect(screen.getByRole('dialog', { name: 'SprintDesk' })).toBeVisible();

    matchesDesktop = true;
    act(() =>
      changeListener?.({ matches: true } as MediaQueryListEvent),
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    view.unmount();
    expect(removeEventListener).toHaveBeenCalledTimes(
      addEventListener.mock.calls.length,
    );
  });
});
