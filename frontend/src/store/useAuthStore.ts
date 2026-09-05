import { create } from 'zustand';
import { User } from '@/types';
import { api } from '@/lib/api';
import { getToken, setToken, clearToken } from '@/lib/token-store';

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

function getInitialUser(): User | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthState>((set) => {
  const initialToken = typeof window !== 'undefined' ? getToken() : null;
  const initialUser = getInitialUser();

  return {
    user: initialUser,
    token: initialToken,
    isLoading: false,
    isAuthenticated: Boolean(initialToken && initialUser),

    setAuth: (user: User, token: string) => {
      setToken(token);
      setRoleCookie(user.role);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('user', JSON.stringify(user));
      }
      set({ user, token, isAuthenticated: true, isLoading: false });
    },

    clearSession: () => {
      clearToken();
      clearRoleCookie();
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('user');
      }
      set({ user: null, token: null, isAuthenticated: false, isLoading: false });
    },

    login: async (email: string, password: string) => {
      set({ isLoading: true });
      try {
        const response = await api.login(email, password);
        setToken(response.accessToken);
        setRoleCookie(response.user.role);
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('user', JSON.stringify(response.user));
        }
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
        setToken(response.accessToken);
        setRoleCookie(response.user.role);
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('user', JSON.stringify(response.user));
        }
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
      api.logout().catch(() => {});
      clearToken();
      clearRoleCookie();
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('user');
      }
      set({ user: null, token: null, isAuthenticated: false });
    },

    loadUser: async () => {
      const existingToken = getToken();
      if (!existingToken) {
        try {
          const refreshed = await api.refresh();
          if (refreshed?.accessToken) {
            setToken(refreshed.accessToken);
            if (refreshed.user) {
              setRoleCookie(refreshed.user.role);
              if (typeof window !== 'undefined') {
                window.localStorage.setItem('user', JSON.stringify(refreshed.user));
              }
            }
            set({
              user: refreshed.user ?? null,
              token: refreshed.accessToken,
              isAuthenticated: true,
              isLoading: false,
            });
            return;
          }
        } catch {
          set({ isAuthenticated: false, isLoading: false });
          return;
        }
      }

      const token = getToken();
      if (!token) {
        set({ isAuthenticated: false, isLoading: false });
        return;
      }

      set({ isLoading: true });
      try {
        const user = (await api.getProfile()) as User;
        setRoleCookie(user.role);
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('user', JSON.stringify(user));
        }
        set({ user, token, isAuthenticated: true, isLoading: false });
      } catch (error: any) {
        const isAuthError =
          error?.status === 401 ||
          error?.status === 403 ||
          error?.response?.status === 401 ||
          error?.response?.status === 403 ||
          error?.message?.includes('401') ||
          error?.message?.includes('Unauthorized');

        if (isAuthError) {
          clearToken();
          clearRoleCookie();
          if (typeof window !== 'undefined') {
            window.localStorage.removeItem('user');
          }
          set({ user: null, token: null, isAuthenticated: false, isLoading: false });
        } else {
          const cachedUser = getInitialUser();
          set({
            user: cachedUser,
            isAuthenticated: Boolean(token && cachedUser),
            isLoading: false,
          });
        }
      }
    },
  };
});
