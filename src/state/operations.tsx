import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { snapshot, errorText, readPending } from '@/features/operations/api';
import type { PendingOperation } from '@/features/operations/pending';
import type { Snapshot } from '@/features/operations/domain';
import { useAuth } from './auth';

type Data = { data: Snapshot | null; loading: boolean; error: string | null; refresh: () => Promise<void>; pending: PendingOperation | null; refreshPending: () => Promise<void>; notice: string | null; setNotice: (value: string | null) => void };
const Context = createContext<Data | null>(null);
export function OperationsProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [data, setData] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingOperation | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const refreshPending = useCallback(async () => {
    if (userId) try { setPending(await readPending(userId)); } catch (failure) { setError(errorText(failure)); }
  }, [userId]);
  const sequence = useRef(0);
  const invalidate = useCallback(() => { sequence.current++; }, []);
  const refresh = useCallback(async () => {
    const request = ++sequence.current;
    setLoading(true);
    await refreshPending();
    try { const next = await snapshot(); if (sequence.current === request) { setData(next); setError(null); } }
    catch (failure) { if (sequence.current === request) setError(errorText(failure)); }
    finally { if (sequence.current === request) setLoading(false); }
  }, [refreshPending]);
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => { if (active && userId) return refresh(); });
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active' && userId) void refresh(); });
    return () => { active = false; invalidate(); subscription.remove(); };
  }, [refresh, invalidate, userId]);
  return <Context.Provider value={{ data, loading, error, refresh, pending, refreshPending, notice, setNotice }}>{children}</Context.Provider>;
}
export function useOperations() { const value = useContext(Context); if (!value) throw new Error('OperationsProvider is required'); return value; }
