import { groundedReply, SYSTEM_PROMPT, PROMPT_VERSION, type Context } from './grounding.ts';

export const LIVE_PROMPT_VERSION = PROMPT_VERSION;
export const LIVE_SYSTEM_PROMPT = SYSTEM_PROMPT;

export function liveReply(raw: unknown, context: Context) {
  return groundedReply(raw, context);
}

export type InboundEvent = { page_id: string; sender_id: string; event_id: string; timestamp: string; text: string; is_echo: boolean; unsupported: boolean };
export function parseInbound(value: unknown): InboundEvent {
  if (!value || typeof value !== 'object') throw new Error('invalid_event');
  const p = value as Record<string, unknown>;
  for (const name of ['page_id', 'sender_id']) if (typeof p[name] !== 'string' || !/^\d{1,100}$/.test(p[name])) throw new Error('invalid_identifier');
  if (typeof p.event_id !== 'string' || !p.event_id.trim() || p.event_id.length > 256) throw new Error('invalid_event_id');
  const time = typeof p.timestamp === 'number' ? new Date(p.timestamp) : new Date(String(p.timestamp));
  if (!Number.isFinite(time.getTime()) || time.getTime() > Date.now() + 300_000) throw new Error('invalid_timestamp');
  if (p.is_echo !== undefined && typeof p.is_echo !== 'boolean') throw new Error('invalid_echo');
  if (p.unsupported !== undefined && typeof p.unsupported !== 'boolean') throw new Error('invalid_unsupported');
  return { page_id: p.page_id as string, sender_id: p.sender_id as string, event_id: p.event_id,
    timestamp: time.toISOString(), text: typeof p.text === 'string' ? p.text.normalize('NFC').trim() : '',
    is_echo: p.is_echo === true, unsupported: p.unsupported === true || typeof p.text !== 'string' };
}
export async function manychatInbound(p: Record<string, unknown>) {
  const attachment = typeof p.last_input_text === 'string' && /^https?:\/\/\S+$/.test(p.last_input_text.trim());
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify([p.id, p.last_interaction, p.last_input_text])));
  return { page_id: p.page_id, sender_id: p.id, event_id: 'manychat:' + Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join(''),
    timestamp: new Date().toISOString(), text: attachment ? undefined : p.last_input_text, unsupported: attachment };
}
export function manychatBody(subscriber_id: string, text: string) {
  if (!/^\d{1,100}$/.test(subscriber_id)) throw new Error('invalid_identifier');
  return `{"subscriber_id":${subscriber_id},"data":${JSON.stringify({ version: 'v2', content: { messages: [{ type: 'text', text }] } })}}`;
}
export function confirmationCode(text: string) {
  return /^CONFIRM ([A-Z0-9]{8})$/i.exec(text.trim())?.[1].toUpperCase() ?? null;
}
export function validHookUrl(value: string) {
  try { const url = new URL(value); return url.protocol === 'https:' && url.hostname === 'hooks.zapier.com' && url.pathname.startsWith('/hooks/catch/') && !url.username && !url.password && !url.port; }
  catch { return false; }
}
