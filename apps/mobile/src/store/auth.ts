import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
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
  logout: () => Promise<void>;
  hydrate: () => Promise<void>;
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
        full_name: supaUser.user_metadata?.full_name ?? supaUser.email,
        role: supaUser.app_metadata?.role ?? 'agent',
        org_id: supaUser.app_metadata?.org_id ?? '',
      };

      await SecureStore.setItemAsync('st_token', access_token);
      await SecureStore.setItemAsync('st_user', JSON.stringify(authUser));
      set({ user: authUser, token: access_token });
    } finally {
      set({ isLoading: false });
    }
  },

  logout: async () => {
    await SecureStore.deleteItemAsync('st_token').catch(() => undefined);
    await SecureStore.deleteItemAsync('st_user').catch(() => undefined);
    set({ user: null, token: null });
  },

  hydrate: async () => {
    const token = await SecureStore.getItemAsync('st_token');
    if (!token) return;

    try {
      const payload = JSON.parse(atob(token.split('.')[1]!)) as { exp: number };
      if (payload.exp * 1000 < Date.now()) {
        await SecureStore.deleteItemAsync('st_token').catch(() => undefined);
        await SecureStore.deleteItemAsync('st_user').catch(() => undefined);
        return;
      }
    } catch {
      await SecureStore.deleteItemAsync('st_token').catch(() => undefined);
      await SecureStore.deleteItemAsync('st_user').catch(() => undefined);
      return;
    }

    const raw = await SecureStore.getItemAsync('st_user');
    if (!raw) return;

    try {
      const user = JSON.parse(raw) as AuthUser;
      set({ user, token });
    } catch {
      /* corrupted — ignore */
    }
  },
}));
