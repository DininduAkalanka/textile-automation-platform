import { create } from 'zustand';
import { User } from '@/types';
import { api } from '@/lib/api';

/**
 * The `role` cookie is a HINT for proxy.ts so it can redirect without a round
 * trip. It is intentionally readable by JS and by the user — forging it grants
 * nothing, because every page fetches from the API, which enforces the real
 * check (JwtAuthGuard + RolesGuard) and answers a forged role with 401/403.
 * See the header of src/proxy.ts.
 */
const ROLE_COOKIE = 'role';

function setRoleCookie(role: string) {
  if (typeof document === 'undefined') return;
  // SameSite=Lax: sent on top-level navigations, which is exactly when the proxy
  // needs to read it, and not on cross-site subrequests.
  document.cookie = `${ROLE_COOKIE}=${role}; path=/; max-age=604800; SameSite=Lax`;
}

function clearRoleCookie() {
  if (typeof document === 'undefined') return;
  document.cookie = `${ROLE_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
  }) => Promise<void>;
  logout: () => void;
  loadUser: () => Promise<void>;
  setAuth: (user: User, token: string) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: typeof window !== 'undefined' ? localStorage.getItem('token') : null,
  isLoading: false,
  isAuthenticated: false,

  setAuth: (user: User, token: string) => {
    localStorage.setItem('token', token);
    setRoleCookie(user.role);
    set({ user, token, isAuthenticated: true, isLoading: false });
  },

  /** Called by the axios interceptor when a refresh finally fails. */
  clearSession: () => {
    localStorage.removeItem('token');
    clearRoleCookie();
    set({ user: null, token: null, isAuthenticated: false, isLoading: false });
  },

  login: async (email: string, password: string) => {
    set({ isLoading: true });
    try {
      const response = await api.login(email, password);
      localStorage.setItem('token', response.accessToken);
      setRoleCookie(response.user.role);
      set({
        user: response.user,
        token: response.accessToken,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  register: async (data) => {
    set({ isLoading: true });
    try {
      const response = await api.register(data);
      localStorage.setItem('token', response.accessToken);
      setRoleCookie(response.user.role);
      set({
        user: response.user,
        token: response.accessToken,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  logout: () => {
    api.logout().catch(() => {}); // revoke refresh token server-side (best-effort)
    localStorage.removeItem('token');
    clearRoleCookie();
    set({ user: null, token: null, isAuthenticated: false });
  },

  loadUser: async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      set({ isAuthenticated: false, isLoading: false });
      return;
    }

    set({ isLoading: true });
    try {
      const user = (await api.getProfile()) as User;
      setRoleCookie(user.role);
      set({ user, token, isAuthenticated: true, isLoading: false });
    } catch {
      localStorage.removeItem('token');
      clearRoleCookie();
      set({ user: null, token: null, isAuthenticated: false, isLoading: false });
    }
  },
}));
