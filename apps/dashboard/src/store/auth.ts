import { create } from 'zustand';
import { api } from '@/lib/api';

interface AuthUser {
  id: string;
  full_name: string;
  email: string;
  role: string;
  org_id: string;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  hydrate: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoading: false,

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const data = await api.auth.login(email, password);
      const { access_token, user: supaUser } = data;

      const authUser: AuthUser = {
        id: supaUser.id,
        email: supaUser.email,
        full_name: (supaUser as Record<string, unknown>).user_metadata
          ? ((supaUser as Record<string, unknown>).user_metadata as Record<string, unknown>).full_name as string ?? ''
          : '',
        role: supaUser.app_metadata?.role ?? 'agent',
        org_id: supaUser.app_metadata?.org_id ?? '',
      };

      localStorage.setItem('st_token', access_token);
      localStorage.setItem('st_user', JSON.stringify(authUser));
      set({ user: authUser, token: access_token });
    } finally {
      set({ isLoading: false });
    }
  },

  logout: () => {
    localStorage.removeItem('st_token');
    localStorage.removeItem('st_user');
    set({ user: null, token: null });
    window.location.href = '/login';
  },

  hydrate: () => {
    if (typeof window === 'undefined') return;

    const token = localStorage.getItem('st_token');
    if (!token) return;

    try {
      const payload = JSON.parse(atob(token.split('.')[1]!)) as { exp: number };
      if (payload.exp * 1000 < Date.now()) {
        localStorage.removeItem('st_token');
        localStorage.removeItem('st_user');
        return;
      }
    } catch {
      localStorage.removeItem('st_token');
      localStorage.removeItem('st_user');
      return;
    }

    const raw = localStorage.getItem('st_user');
    if (!raw) return;

    try {
      const user = JSON.parse(raw) as AuthUser;
      set({ user, token });
    } catch {
      /* corrupted — ignore */
    }
  },
}));
