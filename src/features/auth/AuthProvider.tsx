import { useQueryClient } from '@tanstack/react-query';
import { useEffect, type PropsWithChildren } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { safeInternalPath } from '../../routing/safe-internal-path';
import { bootstrapAuth } from './bootstrap';
import { setUnauthorizedHandler } from './session';

export function AuthProvider({ children }: PropsWithChildren) {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  useEffect(() => {
    const removeHandler = setUnauthorizedHandler(() => {
      queryClient.clear();
      const returnTo = safeInternalPath(
        `${location.pathname}${location.search}${location.hash}`,
        '/dashboard',
      );
      navigate('/login', { replace: true, state: { returnTo } });
    });
    void bootstrapAuth();
    return removeHandler;
  }, [location.hash, location.pathname, location.search, navigate, queryClient]);

  return children;
}
