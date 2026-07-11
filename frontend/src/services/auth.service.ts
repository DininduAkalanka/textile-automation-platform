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
};
