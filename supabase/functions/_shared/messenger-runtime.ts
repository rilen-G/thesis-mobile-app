import { createClient } from 'npm:@supabase/supabase-js@2.116.0';
import { validHookUrl } from './messenger-domain.ts';

declare global { const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void }; }

export type ConnectionConfig = { id: string; secret: string; hook_url: string };
export function connections(): ConnectionConfig[] {
  const values: unknown = JSON.parse(Deno.env.get('MESSENGER_CONNECTIONS') || '[]');
  if (!Array.isArray(values)) throw new Error('configuration');
  const seen = new Set<string>();
  for (const value of values) {
    if (!value || typeof value.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(value.id) || seen.has(value.id) ||
      typeof value.secret !== 'string' || value.secret.length < 32 || !validHookUrl(value.hook_url)) throw new Error('configuration');
    seen.add(value.id);
  }
  return values;
}
export async function equalSecret(actual: string | null, expected: string) {
  if (!actual || expected.length < 32) return false;
  const digest = (text: string) => crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  const [a, b] = await Promise.all([digest(actual), digest(expected)]);
  const left = new Uint8Array(a), right = new Uint8Array(b);
  let diff = 0; for (let i = 0; i < left.length; i++) diff |= left[i] ^ right[i];
  return diff === 0;
}
export async function authenticate(req: Request) {
  const config = connections().find(c => c.id === req.headers.get('x-messenger-connection'));
  if (!config || !await equalSecret(req.headers.get('x-messenger-secret'), config.secret)) return null;
  return config;
}
export async function readBody(req: Request): Promise<Record<string, unknown>> {
  if (Number(req.headers.get('content-length') || 0) > 16000) throw new Error('payload_too_large');
  const reader = req.body?.getReader(); if (!reader) throw new Error('invalid_body');
  let size = 0; const chunks: Uint8Array[] = [];
  while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length;
    if (size > 16000) { await reader.cancel(); throw new Error('payload_too_large'); } chunks.push(value); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  const body: unknown = JSON.parse(new TextDecoder().decode(bytes));
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('invalid_body');
  return body as Record<string, unknown>;
}
export const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
export async function rpc<T>(connection: ConnectionConfig, op: string, payload: Record<string, unknown> = {}): Promise<T> {
  const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const { data, error } = await client.rpc('messenger_service', { payload: { ...payload, op, connection_id: connection.id } });
  if (error) throw new Error('database_operation_failed');
  return data as T;
}
export async function wakeWorker() {
  const secret = Deno.env.get('MESSENGER_WORKER_SECRET');
  if (!secret) return;
  try { await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/messenger-worker`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-messenger-worker': secret }, body: '{}', signal: AbortSignal.timeout(2000),
  }); } catch { /* The durable recovery schedule owns retries. */ }
}
