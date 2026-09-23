import { authenticate, readBody, respond, rpc } from '../_shared/messenger-runtime.ts';

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return respond({ error: 'Method not allowed' }, 405);
  try {
    const connection = await authenticate(req);
    if (!connection) return respond({ error: 'Unauthorized' }, 401);
    const body = await readBody(req);
    if (!['authorize', 'result'].includes(String(body.op)) || typeof body.attempt_id !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.attempt_id)) return respond({ error: 'Invalid attempt' }, 400);
    if (body.op === 'result' && !['accepted', 'unknown'].includes(String(body.outcome))) return respond({ error: 'Invalid outcome' }, 400);
    return respond(await rpc(connection, String(body.op), { attempt_id: body.attempt_id, outcome: body.outcome,
      provider_id: typeof body.provider_id === 'string' ? body.provider_id : null,
      run_reference: typeof body.run_reference === 'string' ? body.run_reference : null }));
  } catch { return respond({ error: 'Dispatch unavailable. Do not replay the Facebook send.' }, 503); }
});
