import { create } from 'zustand';
import type { PublicUser, AuthSessionData, ApiResponse } from '../../shared/types';
import { useThemeStore } from './themeStore';

import { safeParseJson } from '../lib/api';

interface AuthState {
  user: PublicUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setupRequired: boolean;
  error: string | null;
  checkAuth: () => Promise<void>;
  setUser: (user: PublicUser | null) => void;
  setSetupRequired: (required: boolean) => void;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  setupRequired: false,
  error: null,

  checkAuth: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const { data: json } = await safeParseJson<ApiResponse<AuthSessionData>>(res);
        if (json && json.success) {
          set({
            user: json.data.user,
            isAuthenticated: true,
            isLoading: false,
            setupRequired: false,
          });
          useThemeStore.getState().setPreferences(json.data.preferences);
          return;
        }
      }

      // Not authenticated, check if first-time bootstrap setup is required
      const statusRes = await fetch('/api/auth/status');
      if (statusRes.ok) {
        const { data: statusJson } = await safeParseJson<ApiResponse<{ setupRequired: boolean }>>(statusRes);
        if (statusJson && statusJson.success) {
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            setupRequired: statusJson.data.setupRequired,
          });
          return;
        }
      }

      set({ user: null, isAuthenticated: false, isLoading: false, setupRequired: false });
    } catch (err) {
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Authentication check failed',
      });
    }
  },

  setUser: (user) => {
    set({
      user,
      isAuthenticated: Boolean(user),
      setupRequired: false,
    });
  },

  setSetupRequired: (setupRequired) => {
    set({ setupRequired });
  },

  logout: async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      set({ user: null, isAuthenticated: false });
    }
  },
}));
