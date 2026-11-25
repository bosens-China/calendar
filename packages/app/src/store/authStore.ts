import { create } from 'zustand';
import type { Member, LoginRequest } from '@calendar/shared';
import { getMeApi, getToken, loginApi, setOnUnauthorizedCallback, setToken } from '../api';
import { queryClient } from '../queryClient';

interface AuthState {
  user: Member | null;
  token: string | null;
  isLoading: boolean;
  isInitialized: boolean;
  login: (req: LoginRequest) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
  initAuth: () => Promise<void>;
  updateCurrentUser: (user: Partial<Member>) => void;
}

export const useAuthStore = create<AuthState>((set, get) => {
  // Setup 401 callback to auto logout and purge cached session data
  setOnUnauthorizedCallback(() => {
    queryClient.clear();
    set({ user: null, token: null, isLoading: false, isInitialized: true });
  });

  // Sync session across browser tabs to prevent cross-account cache bleed
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
      if (e.key !== 'calendar_auth_token') return;
      queryClient.clear();
      const nextToken = getToken();
      if (!nextToken) {
        set({ user: null, token: null, isLoading: false, isInitialized: true });
      } else {
        void get().checkAuth();
      }
    });
  }

  return {
    user: null,
    token: getToken(),
    isLoading: false,
    isInitialized: false,

    login: async (req: LoginRequest) => {
      set({ isLoading: true });
      try {
        queryClient.clear();
        const res = await loginApi(req);
        set({ user: res.user, token: res.token, isLoading: false, isInitialized: true });
      } catch (err) {
        set({ isLoading: false });
        throw err;
      }
    },

    logout: () => {
      setToken(null);
      queryClient.clear();
      set({ user: null, token: null, isLoading: false, isInitialized: true });
    },

    checkAuth: async () => {
      const token = getToken();
      if (!token) {
        queryClient.clear();
        set({ user: null, token: null, isInitialized: true, isLoading: false });
        return;
      }
      set({ isLoading: true });
      try {
        const user = await getMeApi();
        set({ user, token, isInitialized: true, isLoading: false });
      } catch {
        setToken(null);
        queryClient.clear();
        set({ user: null, token: null, isInitialized: true, isLoading: false });
      }
    },

    initAuth: async () => {
      await get().checkAuth();
    },

    updateCurrentUser: (userData: Partial<Member>) => {
      const currentUser = get().user;
      if (currentUser) {
        set({ user: { ...currentUser, ...userData } });
      }
    },
  };
});
