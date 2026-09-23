import { schema, normalizeMessage, type Context } from '../_shared/grounding.ts';
import { confirmationCode, liveReply, LIVE_SYSTEM_PROMPT } from '../_shared/messenger-domain.ts';
import { connections, equalSecret, respond, rpc, type ConnectionConfig } from '../_shared/messenger-runtime.ts';

type Work = { message: { id: string; body: string; processing_token: string }; probe: boolean;
  conversation: { order_id: string | null }; business: { id: string; version: number; opening_time: string; cutoff_time: string };
  products: Context['products']; knowledge: Context['knowledge']; allocations: Context['allocations']; history: { role: string; body: string }[] };
async function process(connection: ConnectionConfig, work: Work) {
  const finish = (values: Record<string, unknown>) => rpc(connection, 'finish', { message_id: work.message.id,
    processing_token: work.message.processing_token, business_version: work.business.version, ...values });
  try {
    if (work.probe || confirmationCode(work.message.body)) { await finish({ body: 'Checking your confirmation.', sources: [] }); return; }
    const key = Deno.env.get('GEMINI_API_KEY'); if (!key) throw new Error('configuration');
    const now = new Date(); const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
    const ctx: Context = { business_id: work.business.id, business_version: work.business.version, products: work.products, knowledge: work.knowledge,
      allocations: work.allocations, today, opening: work.business.opening_time, cutoff: work.business.cutoff_time, now: now.toISOString() };
    const history = work.history.map(m => ({ ...m, body: normalizeMessage(m.body) }));
    const model = Deno.env.get('GEMINI_MODEL') || 'gemini-2.5-flash';
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: LIVE_SYSTEM_PROMPT }] }, contents: [{ role: 'user', parts: [{ text: JSON.stringify({ context: ctx, history }) }] }],
        generationConfig: { responseMimeType: 'application/json', responseJsonSchema: schema, temperature: 0, maxOutputTokens: 2048 } }), signal: AbortSignal.timeout(25000),
    });
    if (!response.ok) throw new Error('provider');
    const generated = await response.json();
    const raw = generated.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || '').join('');
    const reply = liveReply(JSON.parse(raw), ctx);
    await finish({ body: reply.body, draft: reply.draft, sources: reply.sources, attention: reply.outcome === 'escalated' });
  } catch { await finish({ error: 'ai_unavailable' }); }
}
async function drain() {
  const started = Date.now();
  for (const connection of connections()) {
    try {
    for (let count = 0; count < 4 && Date.now() - started < 45000; count++) {
      const work = await rpc<Work | null>(connection, 'claim');
      if (work) await process(connection, work);
      const offer = await rpc<{ attempt_id: string } | null>(connection, 'offer');
      if (offer) {
        try {
          const response = await fetch(connection.hook_url, { method: 'POST', headers: { 'Content-Type': 'application/json' },
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
