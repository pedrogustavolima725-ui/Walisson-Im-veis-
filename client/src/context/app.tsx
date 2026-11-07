import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, setCsrf, setUnauthorizedHandler } from '../lib/api';

export type Role = 'cliente' | 'corretor' | 'admin';
export interface User {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  avatar: string | null;
  creci: string | null;
  bio: string | null;
  totp_enabled: number;
  marketing_opt_in: number;
  created_at: number;
}

/* ============================ Auth ============================ */
interface AuthCtx {
  user: User | null;
  ready: boolean;
  isStaff: boolean;
  demo: boolean;
  setSession: (user: User | null, csrf: string | null) => void;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}
const AuthContext = createContext<AuthCtx>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [demo, setDemo] = useState(false);

  const setSession = useCallback((u: User | null, csrf: string | null) => {
    setUser(u);
    setCsrf(csrf);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const r = await api<{ user: User | null; csrfToken: string | null; demo?: boolean }>('/auth/me');
      setSession(r.user, r.csrfToken);
      setDemo(!!r.demo);
    } catch {
      setSession(null, null);
    } finally {
      setReady(true);
    }
  }, [setSession]);

  useEffect(() => {
    refresh();
    setUnauthorizedHandler(() => setUser(null));
  }, [refresh]);

  const logout = useCallback(async () => {
    try { await api('/auth/logout', { method: 'POST' }); } catch { /* ignora */ }
    setSession(null, null);
    refresh();
  }, [refresh, setSession]);

  const value = useMemo(
    () => ({ user, ready, isStaff: user?.role === 'corretor' || user?.role === 'admin', demo, setSession, refresh, logout }),
    [user, ready, demo, setSession, refresh, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);

/* ============================ Tema ============================ */
type Theme = 'dark' | 'light';
const ThemeContext = createContext<{ theme: Theme; toggle: () => void; set: (t: Theme) => void }>(null!);
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => (document.documentElement.dataset.theme as Theme) || (window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark'));
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0f0d0b' : '#efebe5');
    try { localStorage.setItem('wi-theme', theme); } catch { /* ignora */ }
  }, [theme]);
  const value = useMemo(() => ({ theme, set: setTheme, toggle: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')) }), [theme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
export const useTheme = () => useContext(ThemeContext);

/* ============================ Toasts ============================ */
type Toast = { id: number; message: string; tone: 'success' | 'error' | 'info' };
const ToastContext = createContext<(message: string, tone?: Toast['tone']) => void>(() => {});
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((message: string, tone: Toast['tone'] = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);
  useEffect(() => {
    const fn = (e: Event) => push((e as CustomEvent<string>).detail, 'info');
    window.addEventListener('wi-toast', fn);
    return () => window.removeEventListener('wi-toast', fn);
  }, [push]);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`glass animate-fade-up pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-medium shadow-soft ${
              t.tone === 'error' ? 'border-danger/40 text-danger' : t.tone === 'info' ? 'border-line-strong text-text' : 'border-success/40 text-success'
            }`}
          >
            <span className={`size-2 shrink-0 rounded-full ${t.tone === 'error' ? 'bg-danger' : t.tone === 'info' ? 'bg-accent' : 'bg-success'}`} />
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
export const useToast = () => useContext(ToastContext);

/* ===================== Contadores (notificações/mensagens) ===================== */
interface Counts { unread: number; unreadMessages: number; reload: () => void }
const CountsContext = createContext<Counts>({ unread: 0, unreadMessages: 0, reload: () => {} });
export function CountsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [c, setC] = useState({ unread: 0, unreadMessages: 0 });
  const reload = useCallback(async () => {
    if (!user) return setC({ unread: 0, unreadMessages: 0 });
    try {
      const r = await api<{ unread: number; unreadMessages: number }>('/me/notifications');
      setC({ unread: r.unread, unreadMessages: r.unreadMessages });
    } catch { /* ignora */ }
  }, [user]);
  useEffect(() => {
    reload();
    if (!user) return;
    const t = setInterval(() => { if (document.visibilityState === 'visible') reload(); }, 30_000);
    return () => clearInterval(t);
  }, [reload, user]);
  return <CountsContext.Provider value={{ ...c, reload }}>{children}</CountsContext.Provider>;
}
export const useCounts = () => useContext(CountsContext);

/* ============================ Comparador ============================ */
const CompareContext = createContext<{ ids: number[]; toggle: (id: number) => void; clear: () => void; has: (id: number) => boolean }>(null!);
export function CompareProvider({ children }: { children: ReactNode }) {
  const [ids, setIds] = useState<number[]>(() => {
    try { return JSON.parse(localStorage.getItem('wi-compare') ?? '[]'); } catch { return []; }
  });
  useEffect(() => { try { localStorage.setItem('wi-compare', JSON.stringify(ids)); } catch { /* ignora */ } }, [ids]);
  const toast = useToast();
  const toggle = useCallback((id: number) => {
    setIds((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id);
      if (cur.length >= 3) { toast('Compare até 3 imóveis por vez.', 'info'); return cur; }
      return [...cur, id];
    });
  }, [toast]);
  const value = useMemo(() => ({ ids, toggle, clear: () => setIds([]), has: (id: number) => ids.includes(id) }), [ids, toggle]);
  return <CompareContext.Provider value={value}>{children}</CompareContext.Provider>;
}
export const useCompare = () => useContext(CompareContext);
