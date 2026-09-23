import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { backend } from '@/lib/supabase';
import { pendingJournal, type PendingOperation } from '@/features/operations/pending';
import type { Command } from '@/features/operations/domain';

export type Knowledge = { id: string; title: string; body: string; approved: boolean; version: number };
export async function readKnowledge(businessId: string) {
 const { data, error } = await backend().from('business_knowledge').select('id,title,body,approved,version').eq('business_id', businessId).order('title').order('id').limit(1000);
 if (error) throw error; return data as Knowledge[];
}
async function journal() {
  const { data } = await backend().auth.getSession();
  if (!data.session) throw new Error('Sign in before saving.');
  return pendingJournal(AsyncStorage, `knowledge.${data.session.user.id}`);
}
export async function pendingKnowledge(): Promise<PendingOperation | null> { return (await journal()).read(); }
let writing = false;
export async function knowledgeCommand(payload?: Command) {
  if (writing) throw new Error('A Knowledge save is in progress.');
  writing = true;
  try {
    const store = await journal(); const saved = await store.read();
    if (saved && payload) throw new Error('Retry the pending Knowledge save first.');
    if (!saved && !payload) throw new Error('No pending Knowledge save.');
    const operation = saved ?? await store.prepare({ payload: payload!, requestId: Crypto.randomUUID() });
    const { data, error } = await backend().rpc('knowledge_command', { payload: { ...operation.payload, request_id: operation.requestId } });
    if (error) { if (/^([0-9A-Z]{5}|PGRST\d+)$/.test(error.code ?? '')) await store.clear(); throw error; }
    if (typeof data?.id !== 'string') throw new Error('Uncertain save. Retry the pending Knowledge save.');
    await store.clear(); return data.id as string;
  } finally { writing = false; }
}
