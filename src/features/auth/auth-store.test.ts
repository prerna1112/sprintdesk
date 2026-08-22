import { describe, expect, it } from 'vitest';
import { useAuthStore } from './auth-store';

const user = {
  id: '1', username: 'emilys', email: 'emily@example.com', firstName: 'Emily', lastName: 'Johnson', image: 'avatar.png',
};

describe('auth store', () => {
  it('keeps session state in memory and clears all sensitive fields', () => {
    expect(useAuthStore.getState().sessionGeneration).toBe(0);
    useAuthStore.getState().beginValidation();
    expect(useAuthStore.getState().status).toBe('validating');

    useAuthStore.getState().setSession({
      accessToken: 'secret-access', accessTokenExpiresAt: 123, user,
    });
    expect(useAuthStore.getState()).toMatchObject({
      status: 'authenticated', sessionGeneration: 1, accessToken: 'secret-access', accessTokenExpiresAt: 123, user,
    });
    expect(JSON.stringify(localStorage)).not.toContain('secret-access');
    expect(JSON.stringify(localStorage)).not.toContain('emily@example.com');

    useAuthStore.getState().clearSession();
    expect(useAuthStore.getState()).toMatchObject({
      status: 'unauthenticated', sessionGeneration: 2, accessToken: null, accessTokenExpiresAt: null, user: null,
    });
  });
});
