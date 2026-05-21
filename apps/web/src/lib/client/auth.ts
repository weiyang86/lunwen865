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

function normalizeToken(raw: string | null): string | null {
  if (!raw) return null;
  const stripped = raw.replace(/[\u0000-\u001F\u007F]/g, '').trim();
  if (!stripped) return null;
  const withoutBearer = stripped.toLowerCase().startsWith('bearer ')
    ? stripped.slice('bearer '.length).trim()
    : stripped;
  const jwtMatch = withoutBearer.match(/[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+/);
  if (jwtMatch?.[0]) return jwtMatch[0];
  const asciiOnly = withoutBearer.replace(/[^\x21-\x7E]/g, '');
  return asciiOnly || null;
}

export const clientAuth = {
  getToken() {
    if (typeof window === 'undefined') return null;
    return normalizeToken(localStorage.getItem(CLIENT_TOKEN_KEY));
  },
  setToken(token: string) {
    if (typeof window === 'undefined') return;
    const normalized = normalizeToken(token) ?? '';
    localStorage.setItem(CLIENT_TOKEN_KEY, normalized);
    document.cookie = `${CLIENT_TOKEN_KEY}=${encodeURIComponent(normalized)}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
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
