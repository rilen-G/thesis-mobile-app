import test from 'node:test';
import assert from 'node:assert/strict';
import { confirmationCode, parseInbound, liveReply, validHookUrl, LIVE_SYSTEM_PROMPT } from '../supabase/functions/_shared/messenger-domain.ts';

test('intake preserves stable identifiers and rejects unsafe/ambiguous payloads', () => {
  const event = { page_id: '123', sender_id: '456', event_id: 'mid.1', text: ' coffee ', timestamp: Date.now() };
  assert.equal(parseInbound(event).text, 'coffee');
  assert.equal(parseInbound({ ...event, text: null }).unsupported, true);
  for (const change of [{ sender_id: 456 }, { event_id: '' }, { timestamp: 'wrong' }, { timestamp: Date.now() + 900000 }, { is_echo: 'false' }]) {
    assert.throws(() => parseInbound({ ...event, ...change }));
  }
});
test('only an exact confirmation command can authorize a summary', () => {
  assert.equal(confirmationCode(' confirm abcd1234 '), 'ABCD1234');
  for (const text of ['yes', 'oo', 'CONFIRM ABCD1234 but change quantity', 'CONFIRM 1234', 'CONFIRM ABCD1234\nCONFIRM 12345678']) assert.equal(confirmationCode(text), null);
});
test('hook transport cannot target an arbitrary server', () => {
  assert.equal(validHookUrl('https://hooks.zapier.com/hooks/catch/1/abc/'), true);
  for (const url of ['http://hooks.zapier.com/hooks/catch/1/abc', 'https://hooks.zapier.com.evil.test/hooks/catch/1/a', 'https://user:secret@hooks.zapier.com/hooks/catch/a', 'https://127.0.0.1/']) assert.equal(validHookUrl(url), false);
});
test('live renderer removes test wording without rewriting approved knowledge', () => {
  const context = { products: [{ id: 'p', name: 'Coffee TEST', description: '', price_centavos: 100, active: true, version: 1 }],
    knowledge: [{ id: 'k', title: 'Tests', body: 'Review this TEST order:', approved: true, version: 1 }],
    allocations: [{ product_id: 'p', total: 10, used: 0 }], today: '2026-09-23', opening: '00:00:00', cutoff: '23:59:59', now: '2026-09-23T08:00:00+08:00' };
  const base = { intent: 'menu', language: 'en', product_ids: ['p'], source_ids: [], items: [], pickup_at: null, payment_method: null, clarification: 'none' };
  assert.match(liveReply(base, context).body, /Coffee TEST: ₱1.00 · 10 available online/);
  assert.equal(liveReply({ ...base, intent: 'faq', source_ids: ['k'] }, context).body, 'Tests: Review this TEST order:');
  assert.doesNotMatch(LIVE_SYSTEM_PROMPT, /TEST CHAT|owner explicitly creates a test order/);
});
