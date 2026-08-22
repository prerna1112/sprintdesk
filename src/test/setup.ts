import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { resetAuthStore } from '../features/auth/auth-store';
import { resetAuthBootstrapForTests } from '../features/auth/bootstrap';

afterEach(() => {
  cleanup();
  localStorage.clear();
  resetAuthStore();
  resetAuthBootstrapForTests();
  vi.restoreAllMocks();
});
