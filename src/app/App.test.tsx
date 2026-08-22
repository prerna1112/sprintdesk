import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';
import { renderWithProviders } from '../test/render';

describe('App routes', () => {
  it.each([
    ['/login', 'Welcome back'],
    ['/dashboard', 'Dashboard'],
    ['/board', 'Board'],
    ['/analytics', 'Analytics'],
  ])('renders the %s route', async (route, heading) => {
    renderWithProviders(<App />, { route });

    expect(
      await screen.findByRole('heading', { name: heading }),
    ).toBeInTheDocument();
  });
});
