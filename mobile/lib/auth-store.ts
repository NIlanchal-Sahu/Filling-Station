import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

interface User {
  id: string;
  email: string;
  role: 'STUDENT' | 'EMPLOYER' | 'ADMIN';
}

interface AuthState {
  accessToken: string | null;
  user: User | null;
  setAuth: (accessToken: string, refreshToken: string, user: User) => Promise<void>;
  loadAuth: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  setAuth: async (accessToken, refreshToken, user) => {
    await SecureStore.setItemAsync('accessToken', accessToken);
    await SecureStore.setItemAsync('refreshToken', refreshToken);
    await SecureStore.setItemAsync('user', JSON.stringify(user));
    set({ accessToken, user });
  },
  loadAuth: async () => {
    const accessToken = await SecureStore.getItemAsync('accessToken');
    const userStr = await SecureStore.getItemAsync('user');
    if (accessToken && userStr) {
      set({ accessToken, user: JSON.parse(userStr) });
    }
  },
  logout: async () => {
    await SecureStore.deleteItemAsync('accessToken');
    await SecureStore.deleteItemAsync('refreshToken');
    await SecureStore.deleteItemAsync('user');
    set({ accessToken: null, user: null });
  },
}));
