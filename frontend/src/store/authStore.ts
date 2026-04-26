import { create } from 'zustand';
import type { User } from '../types';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
}

const loadFromStorage = (): { user: User | null; token: string | null } => {
  try {
    const token = localStorage.getItem('tl_tracker_token');
    const userStr = localStorage.getItem('tl_tracker_user');
    const user = userStr ? (JSON.parse(userStr) as User) : null;
    return { token, user };
  } catch {
    return { token: null, user: null };
  }
};

const { user: storedUser, token: storedToken } = loadFromStorage();

export const useAuthStore = create<AuthState>((set) => ({
  user: storedUser,
  token: storedToken,
  isAuthenticated: !!(storedUser && storedToken),
  setAuth: (user, token) => {
    localStorage.setItem('tl_tracker_token', token);
    localStorage.setItem('tl_tracker_user', JSON.stringify(user));
    set({ user, token, isAuthenticated: true });
  },
  logout: () => {
    localStorage.removeItem('tl_tracker_token');
    localStorage.removeItem('tl_tracker_user');
    set({ user: null, token: null, isAuthenticated: false });
  },
}));
