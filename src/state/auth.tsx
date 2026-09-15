import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import * as Linking from 'expo-linking';
import { backend, supabase } from '@/lib/supabase';
import { errorText } from '@/features/operations/api';

type Auth = { session: Session | null; loading: boolean; error: string | null; recovering: boolean; clearRecovery: () => void; retry: () => void };
const Context = createContext<Auth | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [error, setError] = useState<string | null>(null);
  const [recovering, setRecovering] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    let active = true;
    let changed = false;
    const { data } = client.auth.onAuthStateChange((event, value) => {
      changed = true;
      if (active) { setSession(value); setLoading(false); if (event === 'PASSWORD_RECOVERY') setRecovering(true); if (event === 'SIGNED_OUT') setRecovering(false); }
    });
    void client.auth.getSession().then(({ data: value, error: failure }) => {
      if (!active) return;
      if (failure) setError(errorText(failure));
      if (!changed) setSession(value.session);
      setLoading(false);
    }).catch((failure) => { if (active) { setError(errorText(failure)); setLoading(false); } });
    const seen = new Set<string>();
    async function handleUrl(url: string) {
      if (seen.has(url)) return;
      const parsed = new URL(url);
      if (!(parsed.protocol === 'qfacio:' || parsed.protocol === 'exp:' || parsed.protocol === 'http:' || parsed.protocol === 'https:')) return;
      const code = parsed.searchParams.get('code');
      if (!code) return;
      seen.add(url);
      const { error: failure } = await client.auth.exchangeCodeForSession(code);
      if (active && failure) setError('This account link has expired or belongs to another device. Request a new link on this device.');
    }
    void Linking.getInitialURL().then((url) => { if (url) return handleUrl(url); }).catch((failure) => { if (active) setError(errorText(failure)); });
    const listener = Linking.addEventListener('url', ({ url }) => { void handleUrl(url).catch((failure) => { if (active) setError(errorText(failure)); }); });
    return () => { active = false; data.subscription.unsubscribe(); listener.remove(); };
  }, [attempt]);
  return <Context.Provider value={{ session, loading, error, recovering, clearRecovery: () => setRecovering(false), retry: () => { setLoading(Boolean(supabase)); setError(null); setAttempt((n) => n + 1); } }}>{children}</Context.Provider>;
}
export function useAuth() { const value = useContext(Context); if (!value) throw new Error('AuthProvider is required'); return value; }
export async function signOut() { const { error } = await backend().auth.signOut(); if (error) throw error; }
