import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';

/** Busca dados de uma rota da API com estados de carregamento/erro e recarga. */
export function useApi<T>(path: string | null, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!path);
  const ctrl = useRef<AbortController | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!path) return;
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    if (!silent) setLoading(true);
    try {
      const d = await api<T>(path, { signal: c.signal });
      setData(d);
      setError(null);
    } catch (e: any) {
      if (e.name !== 'AbortError') setError(e.message);
    } finally {
      if (!c.signal.aborted) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps]);

  useEffect(() => {
    load();
    return () => ctrl.current?.abort();
  }, [load]);

  return { data, setData, error, loading, reload: load };
}

export function useLocalStorage<T>(key: string, initial: T) {
  const [v, setV] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* ignora */ }
  }, [key, v]);
  return [v, setV] as const;
}

export function useDebounced<T>(value: T, ms = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function useMediaQuery(q: string) {
  const [m, setM] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const fn = () => setM(mq.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, [q]);
  return m;
}
