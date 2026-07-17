import { AuthResponse, User } from '@/types';
import { LoginInput, RegisterInput } from '@/lib/schemas';
import { http, unwrap } from './http';

export const authService = {
  login: (input: LoginInput) =>
    unwrap<AuthResponse>(http.post('/auth/login', input)),

  register: (input: RegisterInput) =>
    unwrap<AuthResponse>(http.post('/auth/register', input)),

  me: () => unwrap<User>(http.get('/auth/me')),

  logout: () => unwrap<void>(http.post('/auth/logout')),

  /** Send a fresh OTP to the logged-in user's email or phone. */
  sendCode: (channel: 'EMAIL' | 'SMS') =>
    unwrap<{ channel: string; expiresAt: string }>(
      http.post('/auth/send-code', { channel }),
    ),

  /** Verify an OTP; returns the updated verified flags. */
  verifyCode: (channel: 'EMAIL' | 'SMS', code: string) =>
    unwrap<{ emailVerified: boolean; phoneVerified: boolean }>(
      http.post('/auth/verify-code', { channel, code }),
    ),
};
