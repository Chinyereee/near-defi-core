import { useCallback, useEffect, useRef, useState } from 'react';
import type { RoutesResponse, StateResponse } from './types';

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal });
  const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body as T;
}

export const fetchState = (signal?: AbortSignal) => getJson<StateResponse>('/api/state', signal);

export const fetchRoutes = (p: { from: string; symbol: string; amount: string }, signal?: AbortSignal) =>
  getJson<RoutesResponse>(`/api/routes?${new URLSearchParams(p)}`, signal);

export type Feed<T> = {
  data: T | null;
  error: string;
  loading: boolean;
  refresh: () => void;
};

/**
 * Poll `load` every `intervalMs`, re-run immediately when `key` changes
 * (after `debounceMs`). Keeps the last good data on error, so a failed
 * refresh never blanks the screen; the error is shown alongside it instead.
 */
export function usePolling<T>(
  load: (signal: AbortSignal) => Promise<T>,
  { key = '', intervalMs, debounceMs = 0, enabled = true }: { key?: string; intervalMs: number; debounceMs?: number; enabled?: boolean }
): Feed<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    if (!enabled) return;
    const ctrl = new AbortController();
    const start = window.setTimeout(async () => {
      setLoading(true);
      try {
        const next = await loadRef.current(ctrl.signal);
        if (!ctrl.signal.aborted) {
          setData(next);
          setError('');
        }
      } catch (e) {
        if (!ctrl.signal.aborted) setError(e instanceof Error ? e.message : 'Request failed');
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, debounceMs);
    const again = window.setTimeout(() => setTick((t) => t + 1), debounceMs + intervalMs);
    return () => {
      ctrl.abort();
      window.clearTimeout(start);
      window.clearTimeout(again);
    };
  }, [key, tick, intervalMs, debounceMs, enabled]);

  // Key changes drop data that belongs to the previous request.
  const lastKey = useRef(key);
  useEffect(() => {
    if (lastKey.current !== key) {
      lastKey.current = key;
      setData(null);
    }
  }, [key]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, loading, refresh };
}

export function useNow(everyMs = 5000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), everyMs);
    return () => window.clearInterval(t);
  }, [everyMs]);
  return now;
}
