import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { backend } from '@/lib/supabase';
import { pendingJournal, type PendingOperation } from '@/features/operations/pending';
import type { Command } from '@/features/operations/domain';

export type Connection = { id: string; page_name: string; page_id: string; enabled: boolean; verified_at: string | null;
  last_inbound_at: string | null; last_accepted_at: string | null; worker_seen_at: string | null; version: number };
export type Conversation = { id: string; sender_id: string; takeover: boolean; needs_attention: boolean; version: number;
  last_customer_at: string; updated_at: string; order_id: string | null };
export type Message = { id: string; seq: number; role: 'customer' | 'assistant' | 'owner'; body: string; state: string;
  kind: string; error_code: string | null; provider_id: string | null; created_at: string };
export async function readConnection(businessId: string) {
  const { data, error } = await backend().from('messenger_connections').select('*').eq('business_id', businessId).maybeSingle();
  if (error) throw error; return data as Connection | null;
}
export async function readConversations(businessId: string, limit = 30) {
  const { data, error } = await backend().from('messenger_conversations').select('*').eq('business_id', businessId)
    .order('updated_at', { ascending: false }).order('id').limit(limit);
  if (error) throw error; return data as Conversation[];
}
export async function readMessages(businessId: string, conversationId: string, before?: number) {
  let query = backend().from('messenger_messages').select('id,seq,role,body,state,kind,error_code,provider_id,created_at')
    .eq('business_id', businessId).eq('conversation_id', conversationId).order('seq', { ascending: false }).limit(50);
  if (before !== undefined) query = query.lt('seq', before);
  const { data, error } = await query; if (error) throw error;
  return data as Message[];
}
async function journal() {
  const { data } = await backend().auth.getSession();
  if (!data.session) throw new Error('Sign in before saving.');
  return pendingJournal(AsyncStorage, `messenger.${data.session.user.id}`);
}
export async function pendingMessenger(): Promise<PendingOperation | null> { return (await journal()).read(); }
let writing = false;
export async function messengerCommand(payload?: Command) {
  if (writing) throw new Error('A Messenger save is in progress.');
  writing = true;
  try {
    const store = await journal(); const saved = await store.read();
    if (saved && payload) throw new Error('Retry the pending Messenger save first.');
    if (!saved && !payload) throw new Error('No pending Messenger save.');
    const operation = saved ?? await store.prepare({ payload: payload!, requestId: Crypto.randomUUID() });
    const { data, error } = await backend().rpc('messenger_command', { payload: { ...operation.payload, request_id: operation.requestId } });
    if (error) { if (/^([0-9A-Z]{5}|PGRST\d+)$/.test(error.code ?? '')) await store.clear(); throw error; }
    if (typeof data?.id !== 'string') throw new Error('Uncertain save. Retry the pending Messenger save.');
    await store.clear(); return data.id as string;
  } finally { writing = false; }
}
