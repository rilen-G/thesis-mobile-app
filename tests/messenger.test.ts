import test from 'node:test';
import assert from 'node:assert/strict';
import { confirmationCode, parseInbound, liveReply, manychatBody, manychatInbound, validHookUrl, LIVE_SYSTEM_PROMPT } from '../supabase/functions/_shared/messenger-domain.ts';

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
test('live renderer preserves approved knowledge and uses current availability', () => {
  const context = { products: [{ id: 'p', name: 'Coffee TEST', description: '', price_centavos: 100, active: true, version: 1 }],
    knowledge: [{ id: 'k', title: 'Tests', body: 'Review this TEST order:', approved: true, version: 1 }],
    allocations: [{ product_id: 'p', total: 10, used: 0 }], today: '2026-09-23', opening: '00:00:00', cutoff: '23:59:59', now: '2026-09-23T08:00:00+08:00' };
  const base = { intent: 'menu', language: 'en', product_ids: ['p'], source_ids: [], items: [], pickup_at: null, payment_method: null, clarification: 'none' };
  assert.match(liveReply(base, context).body, /Coffee TEST: ₱1.00 · 10 available online/);
  assert.equal(liveReply({ ...base, intent: 'faq', source_ids: ['k'] }, context).body, 'Tests: Review this TEST order:');
  assert.match(LIVE_SYSTEM_PROMPT, /Messenger/);
});
test('ManyChat contact data maps to a minimal inbound event', async () => {
  const body = JSON.parse('{"key":"user:28272978999035230","id":"28272978999035230","page_id":"1290339024167301","name":"<redacted>","profile_pic":"<redacted>","live_chat_url":"<redacted>","last_input_text":"2 “extra spicy” adobo\\npickup 6pm","last_interaction":"2026-09-28T18:11:30+08:00","custom_fields":{}}');
  const mapped = await manychatInbound(body);
  const event = parseInbound(mapped);
  assert.deepEqual(Object.keys(mapped).sort(), ['event_id', 'page_id', 'sender_id', 'text', 'timestamp', 'unsupported']);
  assert.equal(event.sender_id, '28272978999035230');
  assert.equal(event.page_id, '1290339024167301');
  assert.equal(event.text, '2 “extra spicy” adobo\npickup 6pm');
  assert.equal(event.unsupported, false);
  assert.match(event.event_id, /^manychat:[0-9a-f]{64}$/);
  assert.ok(Date.now() - Date.parse(event.timestamp) < 5000);
  assert.equal((await manychatInbound({ ...body })).event_id, event.event_id);
  for (const change of [{ last_interaction: '2026-09-28T18:11:31+08:00' }, { last_input_text: 'adobo' }]) assert.notEqual((await manychatInbound({ ...body, ...change })).event_id, event.event_id);
});
test('ManyChat attachment URLs become unsupported without keeping the URL', async () => {
  const url = 'https://scontent.xx.fbcdn.net/v/t1.15752-9/825311004_123_n.jpg?stp=dst-jpg&oh=abc';
  const event = parseInbound(await manychatInbound({ id: '28272978999035230', page_id: '1290339024167301', last_input_text: url, last_interaction: '2026-09-28T18:11:30+08:00' }));
  assert.equal(event.unsupported, true);
  assert.equal(event.text, '');
  assert.doesNotMatch(JSON.stringify(event), /fbcdn|https/);
});
test('ManyChat send body keeps the exact subscriber id digits', () => {
  const body = manychatBody('28272978999035230', 'Line "one"\nLine two');
  assert.match(body, /^\{"subscriber_id":28272978999035230,/);
  assert.deepEqual(JSON.parse(body).data, { version: 'v2', content: { messages: [{ type: 'text', text: 'Line "one"\nLine two' }] } });
  assert.throws(() => manychatBody('1,"x":1', 'text'));
});
