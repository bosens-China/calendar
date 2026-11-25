import { create } from 'zustand';
import type { Member, LoginRequest, LoginResponse } from '@calendar/shared';
import {
  getCurrentUserLocal, getMeApi, getToken, LOCAL_MODE, loginApi, setOnUnauthorizedCallback,
  setToken, TOKEN_KEY,
} from '../api';
import { queryClient } from '../queryClient';

interface AuthState {
  user: Member | null;
  isLoading: boolean;
  isInitialized: boolean;
  authError: string | null;
  login: (req: LoginRequest) => Promise<void>;
  logout: () => void;
  setSession: (session: LoginResponse) => void;
  initAuth: () => Promise<void>;
  updateCurrentUser: (user: Member) => void;
}

export const useAuthStore = create<AuthState>((set, get) => {
  let authRevision = 0;
  const clearSession = () => {
    authRevision++;
    queryClient.clear();
    set({ user: null, isLoading: false, isInitialized: true, authError: null });
  };

  if (!LOCAL_MODE) {
    setOnUnauthorizedCallback(clearSession);
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (event) => {
        if (event.key !== TOKEN_KEY && event.key !== null) return;
        clearSession();
        if (getToken()) void get().initAuth();
      });
    }
  }

  return {
    user: null,
    isLoading: false,
    isInitialized: false,
    authError: null,

    login: async (req) => {
      const revision = ++authRevision;
      set({ isLoading: true });
      try {
        const { user, token } = await loginApi(req);
        if (revision !== authRevision) return;
        get().setSession({ user, token });
      } catch (error) {
        if (revision === authRevision) set({ isLoading: false });
        throw error;
      }
    },

    setSession: ({ user, token }) => {
      authRevision++;
      queryClient.clear();
      setToken(token);
      set({ user, isLoading: false, isInitialized: true, authError: null });
    },

    logout: () => {
      setToken(null);
      clearSession();
    },

    initAuth: async () => {
      if (!LOCAL_MODE && !getToken()) {
        clearSession();
        return;
      }
      const revision = ++authRevision;
      set({ isLoading: true, isInitialized: false, authError: null });
      try {
        const user = await (LOCAL_MODE ? getCurrentUserLocal() : getMeApi());
        if (revision === authRevision) set({ user, isInitialized: true, isLoading: false });
      } catch {
        if (revision === authRevision) {
          set({
            authError: LOCAL_MODE ? '无法打开个人版排期数据' : '暂时无法连接 Calendar 服务',
            isInitialized: true, isLoading: false,
          });
        }
      }
    },

    updateCurrentUser: (user) => {
      if (get().user?.id === user.id) set({ user });
    },
  };
});
