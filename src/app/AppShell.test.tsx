import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
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
});
