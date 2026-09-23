import { parseInbound } from '../_shared/messenger-domain.ts';
import { authenticate, readBody, respond, rpc, wakeWorker } from '../_shared/messenger-runtime.ts';

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return respond({ error: 'Method not allowed' }, 405);
  try {
    const connection = await authenticate(req);
    if (!connection) return respond({ error: 'Unauthorized' }, 401);
    let event;
    try { event = parseInbound(await readBody(req)); } catch { return respond({ error: 'Invalid event. Check Zap field mappings.' }, 400); }
    const result = await rpc(connection, 'ingest', event);
    EdgeRuntime.waitUntil(wakeWorker());
    return respond(result);
  } catch { return respond({ error: 'Intake unavailable. Retry the same event ID.' }, 503); }
});
