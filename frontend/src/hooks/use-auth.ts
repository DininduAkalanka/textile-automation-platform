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
      // The first code was already auto-sent server-side during registration;
      // land on /verify in code-entry mode for whichever channel it went to,
      // so the user types the code instead of re-sending into the cooldown.
      toast.success('Account created! Enter the code we sent to verify.');
      router.push(`/verify?sent=${response.user.email ? 'EMAIL' : 'SMS'}`);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Could not create the account');
    },
  });
}

/** Send an OTP to the logged-in user's email or phone. */
export function useSendCode() {
  return useMutation({
    mutationFn: (channel: 'EMAIL' | 'SMS') => authService.sendCode(channel),
    onSuccess: () => toast.success('Verification code sent.'),
    onError: (error: Error) => {
      toast.error(error.message || 'Could not send the code');
    },
  });
}

/** Verify an OTP, then refresh the profile so verified flags update in-store. */
export function useVerifyCode() {
  const loadUser = useAuthStore((s) => s.loadUser);

  return useMutation({
    mutationFn: (input: { channel: 'EMAIL' | 'SMS'; code: string }) =>
      authService.verifyCode(input.channel, input.code),
    onSuccess: async () => {
      await loadUser();
      toast.success('Verified — you’re all set.');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Could not verify that code');
    },
  });
}
