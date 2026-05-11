'use client';

export type ClientUser = {
  id: string;
  email?: string | null;
  phone?: string | null;
  nickname?: string | null;
  role?: string;
};

const CLIENT_TOKEN_KEY = 'client_token';
const CLIENT_USER_KEY = 'client_user';

export const clientAuth = {
  getToken() {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(CLIENT_TOKEN_KEY);
  },
  setToken(token: string) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(CLIENT_TOKEN_KEY, token);
    document.cookie = `${CLIENT_TOKEN_KEY}=${token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
  },
  clearToken() {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(CLIENT_TOKEN_KEY);
    localStorage.removeItem(CLIENT_USER_KEY);
    document.cookie = `${CLIENT_TOKEN_KEY}=; path=/; max-age=0; SameSite=Lax`;
  },
  getUser(): ClientUser | null {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(CLIENT_USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as ClientUser;
    } catch {
      return null;
    }
  },
  setUser(user: ClientUser) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(CLIENT_USER_KEY, JSON.stringify(user));
  },
};