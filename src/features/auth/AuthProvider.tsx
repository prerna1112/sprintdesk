import { useQueryClient } from '@tanstack/react-query';
import { useEffect, type PropsWithChildren } from 'react';
import { useNavigate } from 'react-router-dom';
import { bootstrapAuth } from './bootstrap';
import { setUnauthorizedHandler } from './session';

export function AuthProvider({ children }: PropsWithChildren) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    const removeHandler = setUnauthorizedHandler(() => {
      queryClient.clear();
      navigate('/login', { replace: true });
    });
    void bootstrapAuth();
    return removeHandler;
  }, [navigate, queryClient]);

  return children;
}
