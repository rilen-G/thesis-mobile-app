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
async function sha256(value: unknown) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value)));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}
export async function manychatInbound(p: Record<string, unknown>) {
  const attachment = typeof p.last_input_text === 'string' && /^https?:\/\/\S+$/.test(p.last_input_text.trim());
  return { page_id: p.page_id, sender_id: p.id, event_id: 'manychat:' + await sha256([p.id, p.last_interaction, p.last_input_text]),
    timestamp: new Date().toISOString(), text: attachment ? undefined : p.last_input_text };
}
export async function manychatTap(p: Record<string, unknown>, connection_id: string) {
  if (p.connection_id !== connection_id || !['confirm', 'change'].includes(String(p.action)) || typeof p.code !== 'string' || !/^[A-Z0-9]{8}$/.test(p.code)) throw new Error('invalid_tap');
  return { page_id: p.page_id, sender_id: p.sender_id, event_id: 'manychat:tap:' + await sha256([p.code, p.action]),
    timestamp: new Date().toISOString(), text: p.action === 'confirm' ? `CONFIRM ${p.code}` : 'CHANGE ORDER' };
}
export function manychatBody(subscriber_id: string, text: string, quick_replies: unknown[] = []) {
  if (!/^\d{1,100}$/.test(subscriber_id)) throw new Error('invalid_identifier');
  return `{"subscriber_id":${subscriber_id},"data":${JSON.stringify({ version: 'v2', content: { messages: [{ type: 'text', text }], quick_replies } })}}`;
}
export function confirmChips(url: string, connection: { id: string; secret: string }, send: { page_id: string; recipient_id: string; code: string; language?: string | null }) {
  const taglish = send.language === 'taglish';
  return (['confirm', 'change'] as const).map(action => ({ type: 'dynamic_block_callback', caption: action === 'confirm' ? (taglish ? 'I-confirm' : 'Confirm') : (taglish ? 'Baguhin' : 'Change order'),
    url, method: 'post', headers: { 'x-messenger-connection': connection.id, 'x-messenger-secret': connection.secret },
    payload: { connection_id: connection.id, page_id: send.page_id, sender_id: send.recipient_id, code: send.code, action } }));
}
const YES = ['oo', 'oo po', 'opo', 'yes', 'yes po', 'sige', 'sige po', 'confirm', 'confirm po', 'ok po', 'okay po'];
export function replyKind(text: string, unsupported = false) {
  if (unsupported) return 'unclear';
  const words = text.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim();
  if (YES.includes(words)) return 'yes';
  return !words || /^(ok|okay|k|h+m+|uh+m*|ah+|eh+)$/.test(words) ? 'unclear' : null;
}
export function summaryReply(text: string, unsupported: boolean, code: string | null | undefined, taglish: boolean) {
  const kind = replyKind(text, unsupported);
  if (code && kind === 'yes') return { body: 'Checking your confirmation.', sources: [], confirm_code: code };
  if (code && kind === 'unclear') return { body: taglish ? 'I-confirm na po ba ang order?' : 'Would you like to confirm this order?', sources: [] };
  if (/^change order$/i.test(text.trim())) return { body: taglish ? 'Ano pong gusto niyong baguhin sa order?' : 'What would you like to change in your order?', sources: [] };
  return null;
}
export function confirmationCode(text: string) {
  return /^CONFIRM ([A-Z0-9]{8})$/i.exec(text.trim())?.[1].toUpperCase() ?? null;
}
export function validHookUrl(value: string) {
  try { const url = new URL(value); return url.protocol === 'https:' && url.hostname === 'hooks.zapier.com' && url.pathname.startsWith('/hooks/catch/') && !url.username && !url.password && !url.port; }
  catch { return false; }
}
