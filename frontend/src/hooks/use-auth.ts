'use client';

import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { authService } from '@/services/auth.service';
import { LoginInput, RegisterInput } from '@/lib/schemas';
import { useAuthStore } from '@/store/useAuthStore';
import { AuthResponse } from '@/types';

/** Where each role lands after authenticating (plan Session 1.2). */
function landingFor(role: string | undefined): string {
  switch (role) {
    case 'ADMIN':
      return '/admin';
    case 'WORKER':
      return '/worker/tasks';
    default:
      return '/';
  }
}

export function useLogin(returnTo?: string) {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);

  return useMutation({
    mutationFn: (input: LoginInput) => authService.login(input),
    onSuccess: (response: AuthResponse) => {
      setAuth(response.user, response.accessToken);
      toast.success(`Welcome back, ${response.user.firstName}`);
      router.push(returnTo || landingFor(response.user.role));
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Could not sign in');
    },
  });
}

export function useRegister() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);

  return useMutation({
    mutationFn: (input: RegisterInput) => authService.register(input),
    onSuccess: (response: AuthResponse) => {
      setAuth(response.user, response.accessToken);
      toast.success('Account created');
      router.push(landingFor(response.user.role));
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Could not create the account');
    },
  });
}
