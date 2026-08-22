import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import App from './App';
import { renderWithProviders } from '../test/render';
import { useAuthStore } from '../features/auth';

const testUser = {
  id: '1', username: 'emilys', email: 'emily@example.com', firstName: 'Emily', lastName: 'Johnson', image: '',
};

describe('App routes', () => {
  beforeEach(() => {
    useAuthStore.getState().setSession({
      accessToken: 'access', accessTokenExpiresAt: Date.now() + 60_000, user: testUser,
    });
  });

  it.each([
    ['/login', 'Dashboard'],
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
