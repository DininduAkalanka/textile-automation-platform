import { create } from 'zustand';
import { User } from '@/types';
import { api } from '@/lib/api';

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
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: typeof window !== 'undefined' ? localStorage.getItem('token') : null,
  isLoading: false,
  isAuthenticated: false,

  setAuth: (user: User, token: string) => {
    localStorage.setItem('token', token);
    set({ user, token, isAuthenticated: true });
  },

  login: async (email: string, password: string) => {
    set({ isLoading: true });
    try {
      const response = await api.login(email, password);
      localStorage.setItem('token', response.accessToken);
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
      set({ user, token, isAuthenticated: true, isLoading: false });
    } catch {
      localStorage.removeItem('token');
      set({ user: null, token: null, isAuthenticated: false, isLoading: false });
    }
  },
}));
