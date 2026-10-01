import test from 'node:test';
import assert from 'node:assert/strict';
import { confirmationCode, confirmChips, parseInbound, liveReply, manychatBody, manychatInbound, manychatTap, replyKind, resumeAnswer, resumeExtraction, summaryReply, validHookUrl, LIVE_SYSTEM_PROMPT } from '../supabase/functions/_shared/messenger-domain.ts';

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
  const base = { intent: 'menu', language: 'en', product_ids: ['p'], source_ids: [], items: [], pickup_hour: null, pickup_minute: null, pickup_period: 'none', pickup_day: 'today', special_request: null, payment_method: null, clarification: 'none' };
  assert.match(liveReply(base, context).body, /Coffee TEST: ₱1.00 · available today/);
  assert.equal(liveReply({ ...base, intent: 'faq', source_ids: ['k'] }, context).body, 'Tests: Review this TEST order:');
  assert.match(LIVE_SYSTEM_PROMPT, /Messenger/);
});
test('ManyChat contact data maps to a minimal inbound event', async () => {
  const body = JSON.parse('{"key":"user:28272978999035230","id":"28272978999035230","page_id":"1290339024167301","name":"<redacted>","profile_pic":"<redacted>","live_chat_url":"<redacted>","last_input_text":"2 “extra spicy” adobo\\npickup 6pm","last_interaction":"2026-09-28T18:11:30+08:00","custom_fields":{}}');
  const mapped = await manychatInbound(body);
  const event = parseInbound(mapped);
  for (const field of ['name', 'profile_pic', 'live_chat_url']) assert.equal(field in mapped, false);
  assert.equal(event.sender_id, '28272978999035230');
  assert.equal(event.page_id, '1290339024167301');
  assert.equal(event.text, '2 “extra spicy” adobo\npickup 6pm');
  assert.equal(event.unsupported, false);
  assert.match(event.event_id, /^manychat:[0-9a-f]{64}$/);
  assert.notEqual(event.timestamp, new Date(body.last_interaction).toISOString());
  assert.equal((await manychatInbound(body)).event_id, event.event_id);
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
  assert.deepEqual(JSON.parse(body).data, { version: 'v2', content: { messages: [{ type: 'text', text: 'Line "one"\nLine two' }], quick_replies: [] } });
  assert.throws(() => manychatBody('1,"x":1', 'text'));
});
test('only exact short replies count as yes; filler and attachments are unclear', () => {
  for (const text of ['oo', 'Opo!', 'yes po 👍', 'Sige po.', 'CONFIRM', 'ok po', ' sige ']) assert.equal(replyKind(text), 'yes');
  for (const text of ['ok', 'hmm', '👍', 'Hmmm...', '']) assert.equal(replyKind(text), 'unclear');
  assert.equal(replyKind('[Unsupported message or attachment — open Messenger to review]', true), 'unclear');
  for (const text of ['oo pero 2 na lang', 'yes, change to 7pm', 'okay na 3 pcs']) assert.equal(replyKind(text), null);
});
test('pending summaries: yes confirms the latest code, unclear re-asks, change asks what to change', () => {
  assert.deepEqual(summaryReply('oo po', false, 'ABCD1234', false), { body: 'Checking your confirmation.', sources: [], confirm_code: 'ABCD1234' });
  assert.equal(summaryReply('hmm', false, 'ABCD1234', false)?.body, 'Would you like to confirm this order?');
  assert.equal(summaryReply('', true, 'ABCD1234', true)?.body, 'I-confirm na po ba ang order?');
  assert.equal(summaryReply('oo', false, null, false), null);
  assert.equal(summaryReply('2 lattes instead', false, 'ABCD1234', false), null);
  assert.equal(summaryReply('CHANGE ORDER', false, null, true)?.body, 'Ano pong gusto niyong baguhin sa order?');
});
test('chip taps map to the existing confirmation path and count once', async () => {
  const tap = { connection_id: 'conn', page_id: '1290339024167301', sender_id: '28272978999035230', code: 'ABCD1234', action: 'confirm' };
  const event = parseInbound(await manychatTap(tap, 'conn'));
  assert.equal(event.text, 'CONFIRM ABCD1234'); assert.equal(event.sender_id, '28272978999035230');
  assert.equal((await manychatTap(tap, 'conn')).event_id, event.event_id);
  const change = await manychatTap({ ...tap, action: 'change' }, 'conn');
  assert.equal(change.text, 'CHANGE ORDER'); assert.notEqual(change.event_id, event.event_id);
  for (const bad of [{ ...tap, connection_id: 'other' }, { ...tap, code: 'abc' }, { ...tap, action: 'cancel' }]) await assert.rejects(manychatTap(bad, 'conn'));
});
test('confirmation chips carry the full callback payload in the send body', () => {
  const chips = confirmChips('https://example.supabase.co/functions/v1/messenger-ingest', { id: 'conn', secret: 's'.repeat(32) }, { page_id: '1290339024167301', recipient_id: '28272978999035230', code: 'ABCD1234', language: 'taglish' });
  assert.deepEqual(chips.map(c => c.caption), ['I-confirm', 'Baguhin']);
  assert.deepEqual(chips[0].payload, { connection_id: 'conn', page_id: '1290339024167301', sender_id: '28272978999035230', code: 'ABCD1234', action: 'confirm' });
  assert.equal(chips[0].headers['x-messenger-connection'], 'conn');
  const body = JSON.parse(manychatBody('28272978999035230', 'Please check your order', chips));
  assert.equal(body.data.content.quick_replies.length, 2); assert.equal(body.data.content.quick_replies[1].type, 'dynamic_block_callback');
});
test('closing and opt-out messages are recognized from fixed lists only', () => {
  for (const text of ['salamat po', 'Ok salamat po!', 'sige po salamat', 'thanks', 'Thank you po 🙏', 'noted']) assert.equal(replyKind(text), 'closing');
  for (const text of ['stop', 'Wag na po', 'ayoko na', 'UNSUBSCRIBE']) assert.equal(replyKind(text), 'opt_out');
  for (const text of ['salamat pero 2 na lang', 'thanks, change to 7pm', 'cancel', 'stop the order of latte']) assert.equal(replyKind(text), null);
  assert.equal(replyKind('ok po'), 'yes');
});
test('order-timeout offer: Yes/No taps and typed replies map to one answer for the current code', async () => {
  const tap = { connection_id: 'conn', page_id: '1290339024167301', sender_id: '28272978999035230', code: 'ABCD1234', action: 'resume' };
  const yes = await manychatTap(tap, 'conn'), no = await manychatTap({ ...tap, action: 'decline' }, 'conn');
  assert.equal(yes.text, 'RESUME ABCD1234'); assert.equal(no.text, 'DECLINE ABCD1234'); assert.notEqual(yes.event_id, no.event_id);
  assert.equal(resumeAnswer('RESUME ABCD1234', 'ABCD1234'), 'yes'); assert.equal(resumeAnswer('decline abcd1234', 'ABCD1234'), 'no');
  assert.equal(resumeAnswer('RESUME ZZZZ9999', 'ABCD1234'), null);
  for (const text of ['oo po', 'Sige', 'yes']) assert.equal(resumeAnswer(text, 'ABCD1234'), 'yes');
  for (const text of ['hindi po', 'No', 'ayaw ko na']) assert.equal(resumeAnswer(text, 'ABCD1234'), 'no');
  for (const text of ['hindi ko alam', 'magkano po latte']) assert.equal(resumeAnswer(text, 'ABCD1234'), null);
  const chips = confirmChips('https://example.supabase.co/functions/v1/messenger-ingest', { id: 'conn', secret: 's'.repeat(32) }, { page_id: '1', recipient_id: '2', code: 'ABCD1234', language: 'taglish' }, 'resume');
  assert.deepEqual(chips.map(c => [c.caption, c.payload.action]), [['Oo', 'resume'], ['Hindi', 'decline']]);
  assert.deepEqual(confirmChips('https://x.test', { id: 'conn', secret: 's' }, { page_id: '1', recipient_id: '2', code: 'ABCD1234' }, 'resume').map(c => c.caption), ['Yes', 'No']);
});
test('a Yes rebuilds the same order: keeps a future pickup time, asks again when it has passed', () => {
  const context = { products: [{ id: 'p', name: 'Coffee', description: '', price_centavos: 10000, active: true, version: 1 }], knowledge: [],
    allocations: [{ product_id: 'p', total: 10, used: 0 }], today: '2026-09-23', opening: '08:00:00', cutoff: '22:00:00', now: '2026-09-23T02:00:00.000Z', language: 'en' as const };
  const resume = { items: [{ product_id: 'p', quantity: 2 }], pickup_at: '2026-09-23T10:00:00+00:00', payment_method: 'GCash', notes: 'less ice' };
  const summary = liveReply(resumeExtraction(resume, 'en', context.now), context);
  assert.equal(summary.body, 'Please check your order:\n2 × Coffee\n₱200.00 · pickup 6:00 PM · GCash\nNote: less ice');
  const passed = liveReply(resumeExtraction({ ...resume, pickup_at: '2026-09-23T01:00:00+00:00' }, 'taglish', context.now), { ...context, language: 'taglish' as const });
  assert.equal(passed.draft, null); assert.match(passed.body, /^Anong oras po ninyo kukunin ang 2 × Coffee today\?/);
});
