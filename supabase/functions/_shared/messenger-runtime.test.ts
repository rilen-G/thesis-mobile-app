import { authenticate, connections, equalSecret, readBody } from './messenger-runtime.ts';

function assert(value: unknown, message = 'Assertion failed'): asserts value { if (!value) throw new Error(message); }
async function rejects(fn: () => unknown) { let rejected = false; try { await fn(); } catch { rejected = true; } assert(rejected, 'Expected rejection'); }

Deno.test('webhook credentials are bound to one configured connection', async () => {
  const previous = Deno.env.get('MESSENGER_CONNECTIONS');
  const id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const secret = 'a'.repeat(48);
  try {
    Deno.env.set('MESSENGER_CONNECTIONS', JSON.stringify([{ id, secret, hook_url: 'https://hooks.zapier.com/hooks/catch/1/test/' }]));
    const request = (key: string, connection = id) => new Request('https://example.invalid', { headers: { 'x-messenger-secret': key, 'x-messenger-connection': connection } });
    assert((await authenticate(request(secret)))?.id === id);
    assert(await authenticate(request('wrong')) === null);
    assert(await authenticate(request(secret, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')) === null);
    assert(await authenticate(new Request('https://example.invalid')) === null);
    assert(!await equalSecret('', ''));
    Deno.env.set('MESSENGER_CONNECTIONS', '[{"id":"bad","secret":"short","hook_url":"http://localhost"}]');
    await rejects(connections);
  } finally { if (previous === undefined) Deno.env.delete('MESSENGER_CONNECTIONS'); else Deno.env.set('MESSENGER_CONNECTIONS', previous); }
});
Deno.test('JSON request reading rejects oversized and non-object payloads', async () => {
  const request = (body: string) => new Request('https://example.invalid', { method: 'POST', body });
  assert((await readBody(request('{"op":"authorize"}'))).op === 'authorize');
  await rejects(() => readBody(request('[]')));
  await rejects(() => readBody(request('null')));
  await rejects(() => readBody(request('bad json')));
  await rejects(() => readBody(request(JSON.stringify({ text: 'a'.repeat(16001) }))));
});
