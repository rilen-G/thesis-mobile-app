import { schema, normalizeMessage, type Context } from '../_shared/grounding.ts';
import { confirmationCode, confirmChips, liveReply, manychatBody, summaryReply, LIVE_SYSTEM_PROMPT } from '../_shared/messenger-domain.ts';
import { connections, equalSecret, respond, rpc, type ConnectionConfig } from '../_shared/messenger-runtime.ts';

type Work = { message: { id: string; body: string; processing_token: string; error_code: string | null }; probe: boolean; summary: { code: string } | null;
  conversation: { order_id: string | null; reply_language?: 'en' | 'taglish' | null }; business: { id: string; version: number; opening_time: string; cutoff_time: string };
  products: Context['products']; knowledge: Context['knowledge']; allocations: Context['allocations']; history: { role: string; body: string }[] };
async function process(connection: ConnectionConfig, work: Work) {
  const finish = (values: Record<string, unknown>) => rpc(connection, 'finish', { message_id: work.message.id,
    processing_token: work.message.processing_token, business_version: work.business.version, ...values });
  try {
    if (work.probe || confirmationCode(work.message.body)) { await finish({ body: 'Checking your confirmation.', sources: [] }); return; }
    const direct = summaryReply(work.message.body, work.message.error_code === 'unsupported_message', work.summary?.code, work.conversation.reply_language === 'taglish');
    if (direct) { await finish(direct); return; }
    const key = Deno.env.get('GEMINI_API_KEY'); if (!key) throw new Error('configuration');
    const now = new Date(); const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
    const ctx: Context = { business_id: work.business.id, business_version: work.business.version, products: work.products, knowledge: work.knowledge,
      allocations: work.allocations, today, opening: work.business.opening_time, cutoff: work.business.cutoff_time, now: now.toISOString(), language: work.conversation.reply_language };
    const history = work.history.map(m => ({ ...m, body: normalizeMessage(m.body) }));
    const model = Deno.env.get('GEMINI_MODEL') || 'gemini-2.5-flash';
    const body = JSON.stringify({ systemInstruction: { parts: [{ text: LIVE_SYSTEM_PROMPT }] }, contents: [{ role: 'user', parts: [{ text: JSON.stringify({ context: ctx, history }) }] }],
      generationConfig: { responseMimeType: 'application/json', responseJsonSchema: schema, temperature: 0, maxOutputTokens: 8192 } });
    const generate = async () => {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body, signal: AbortSignal.timeout(20000) });
      if (!response.ok) console.error('gemini_failed', response.status);
      return response;
    };
    let response = await generate();
    if (response.status === 429 || response.status === 503) { await new Promise(resolve => setTimeout(resolve, 2000)); response = await generate(); }
    if (!response.ok) throw new Error('provider');
    const generated = await response.json();
    const candidate = generated.candidates?.[0];
    const raw = candidate?.content?.parts?.map((part: { text?: string }) => part.text || '').join('');
    let extraction;
    try { extraction = JSON.parse(raw); } catch { console.error('gemini_unusable', candidate?.finishReason, generated.usageMetadata?.thoughtsTokenCount); throw new Error('provider'); }
    const reply = liveReply(extraction, ctx);
    if (reply.reason) console.error('reply_escalated', reply.reason);
    await finish({ body: reply.body, draft: reply.draft, sources: reply.sources, attention: reply.outcome === 'escalated', language: reply.language, followup: reply.followup });
  } catch (error) {
    const name = error instanceof Error ? error.name : 'unknown';
    console.error('worker_process_failed', name, error instanceof Error && /^[a-z_]+$/.test(error.message) ? error.message : '');
    await finish({ error: 'ai_unavailable' });
  }
}
async function sendManychat(connection: ConnectionConfig, attempt_id: string) {
  const auth = await rpc<{ allowed: boolean; text: string; recipient_id: string; page_id: string; code: string | null; language: string | null }>(connection, 'authorize', { attempt_id });
  if (!auth.allowed) return;
  const chips = auth.code ? confirmChips(`${Deno.env.get('SUPABASE_URL')}/functions/v1/messenger-ingest`, connection, { ...auth, code: auth.code }) : [];
  const response = await fetch('https://api.manychat.com/fb/sending/sendContent', { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${connection.api_key}` },
    body: manychatBody(auth.recipient_id, auth.text, chips), signal: AbortSignal.timeout(8000), redirect: 'error' }).catch(() => null);
  const raw = response ? await response.text().catch(() => '') : '';
  const result = await Promise.resolve().then(() => JSON.parse(raw)).catch(() => null);
  console.log('manychat_send', response?.status ?? 'network_error', result?.status ?? null, result?.code ?? null, auth.text.length, chips.length > 0, raw === '{"status":"success"}' ? '' : raw.slice(0, 2000));
  const accepted = response?.ok && result?.status === 'success';
  await rpc(connection, 'result', { attempt_id, outcome: accepted ? 'accepted' : 'unknown' });
}
async function drain() {
  const started = Date.now();
  for (const connection of connections()) {
    try {
    await rpc(connection, 'followups').catch(() => console.error('messenger_followups_failed'));
    for (let count = 0; count < 4 && Date.now() - started < 45000; count++) {
      const work = await rpc<Work | null>(connection, 'claim');
      if (work) await process(connection, work);
      const offer = await rpc<{ attempt_id: string } | null>(connection, 'offer');
      if (offer && connection.transport === 'manychat') await sendManychat(connection, offer.attempt_id);
      else if (offer) {
        try {
          const response = await fetch(connection.hook_url!, { method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(offer), signal: AbortSignal.timeout(8000), redirect: 'error' });
          if (!response.ok) throw new Error('hook');
        } catch { await rpc(connection, 'offer_failed', { attempt_id: offer.attempt_id }); }
      }
      if (!work && !offer) break;
    }
    } catch { console.error('messenger_connection_worker_failed'); }
  }
}
Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return respond({ error: 'Method not allowed' }, 405);
  if (!await equalSecret(req.headers.get('x-messenger-worker'), Deno.env.get('MESSENGER_WORKER_SECRET') || '')) return respond({ error: 'Unauthorized' }, 401);
  EdgeRuntime.waitUntil(drain().catch(() => console.error('messenger_worker_failed')));
  return respond({ queued: true }, 202);
});
