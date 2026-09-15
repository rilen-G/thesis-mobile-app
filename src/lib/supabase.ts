import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, processLock } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
export const backendConfigured = Boolean(url && key && !url.includes('YOUR_PROJECT') && !key.includes('YOUR_'));

// Expo Router renders the web bundle once in Node before hydrating it in the
// browser. AsyncStorage's web adapter reads `window.localStorage`, which is
// unavailable during that server render. Returning an empty storage there
// lets Supabase initialize without attempting to restore a browser session;
// the browser render then uses the normal persistent AsyncStorage adapter.
const isSSR = typeof window === 'undefined';
const authStorage = {
  getItem: (storageKey: string) => isSSR ? null : AsyncStorage.getItem(storageKey),
  setItem: (storageKey: string, value: string) => { if (!isSSR) return AsyncStorage.setItem(storageKey, value); },
  removeItem: (storageKey: string) => { if (!isSSR) return AsyncStorage.removeItem(storageKey); },
};
export const supabase = backendConfigured ? createClient(url!, key!, {
  auth: { storage: authStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, lock: processLock, flowType: 'pkce' },
}) : null;
if (supabase && Platform.OS !== 'web') {
  const client = supabase;
  AppState.addEventListener('change', (state) => {
    if (state === 'active') client.auth.startAutoRefresh();
    else client.auth.stopAutoRefresh();
  });
}
export function backend() {
  if (!supabase) throw new Error('Backend setup is required. Configure the Supabase URL and publishable key, then restart the app.');
  return supabase;
}
