import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { authService } from '../../services/api-client/auth-service';
import { useAuthStore } from './auth-store';
import { refreshTokenStorage } from './refresh-token-storage';
import { logout } from './session';

export function useLogin() {
  return useMutation({
    mutationFn: ({ username, password }: { username: string; password: string }) =>
      authService.login(username, password),
    onSuccess: ({ refreshToken, ...session }) => {
      refreshTokenStorage.set(refreshToken);
      useAuthStore.getState().setSession(session);
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return () => {
    logout(queryClient);
    navigate('/login', { replace: true });
  };
}
