# Messenger and Zapier setup

The app implements live Messenger intake, grounded replies, coded order confirmation, owner takeover/manual replies, and status messages. It does not implement promotional publishing or timed follow-ups. Approved knowledge is managed in Settings; the former AI test chat is removed. Deployment and real Page acceptance are separate from local test results.

## 1. Collect actual Page evidence

In Zapier, test **Facebook Messenger → New Message Sent to Page** with a team account. Record the original Page ID, sender's Page-scoped ID (PSID), stable Facebook message ID, original message timestamp, text, and any echo/attachment fields. Use the actual event fields shown in your account; labels may vary. Do not substitute the Zap execution ID, display name, or current time. Verify **Send Message From Page** can send back to that PSID.

If an incoming trigger, stable event ID, or reliable sender/page identification is unavailable, do not enable the live integration. Connection authorization alone is not sufficient. The connected Facebook Pages app is reserved for a later publishing release.

## 2. Provision a disabled connection

Apply the Messenger migration after the existing baseline, using the project's normal linked migration workflow. Never replay the consolidated baseline on an existing database. Deploy `messenger-ingest`, `messenger-dispatch`, and `messenger-worker`; their `verify_jwt=false` configuration is intentional because each validates a dedicated secret internally.

As a database administrator, insert one connection (replace example values, do not use these literally):

```sql
insert into public.messenger_connections
 (business_id,page_id,page_name,probe_sender_id)
values ('<business UUID>','<numeric Page ID>','<Page name>','<tester PSID>')
returning id;
```

The connection starts disabled and unverified. Only the configured tester can receive a fixed connection-test reply in this state. Other incoming messages are retained for owner review. They are not replayed when automation is enabled. The tester PSID is scoped to this Page, not a public Facebook account ID.

Create Zap B's Catch Hook to obtain its URL. Configure these **Edge Function secrets**, never `EXPO_PUBLIC_*`:

| Secret | Value |
|---|---|
| `MESSENGER_CONNECTIONS` | JSON array: `[{"id":"<connection UUID>","secret":"<random 32+ character secret>","hook_url":"https://hooks.zapier.com/hooks/catch/.../.../"}]` |
| `MESSENGER_WORKER_SECRET` | A separate random 32+ character secret used only by the recovery schedule |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Existing AI provider configuration; the model defaults to `gemini-2.5-flash` |

Use different random secrets for each Page connection. The Supabase service-role credential remains inside Edge Functions; do not give it to Zapier. The server resolves business identity from the authenticated connection. For key rotation, pause the integration, update the Edge secret and both Zaps, and repeat the probe with a newly configured verification state before re-enabling.

## 3. Zap A: incoming messages

1. Trigger: **Facebook Messenger → New Message Sent to Page**, selecting the connected Page.
2. Action: **Webhooks by Zapier → POST** to `https://<project>.supabase.co/functions/v1/messenger-ingest`, JSON payload.

Set headers `x-messenger-connection` to the connection UUID and `x-messenger-secret` to its secret. Map:

```json
{
  "page_id": "<original Page ID as text>",
  "sender_id": "<original sender PSID as text>",
  "event_id": "<original stable Facebook message ID>",
  "timestamp": "<original ISO timestamp with timezone>",
  "text": "<message text>",
  "is_echo": false,
  "unsupported": false
}
```

`timestamp` also accepts a JSON number containing Unix milliseconds. IDs must remain strings to avoid numeric precision loss. Booleans must be JSON booleans, not the strings `"false"`/`"true"`. Map echo and unsupported attachment indicators from the real event. If Zapier cannot supply a field, confirm the event semantics before using a constant. Empty/missing text is retained as unsupported and flagged for owner handling. Do not forward full customer profiles, files, or unrelated event fields.

Success means the event is stored, not that a reply was sent. It is safe to retry intake using the same event ID. The service excludes Page echoes, deduplicates events, suppresses stale processing, and preserves unsupported messages as owner-review placeholders.

## 4. Zap B: outgoing messages

Use the same Page and the same connection headers for every webhook action:

1. **Webhooks → Catch Hook**. Receive `connection_id`, `job_id`, and `attempt_id`; no customer message text is included at this step.
2. **Webhooks → POST** to `/functions/v1/messenger-dispatch`: `{"op":"authorize","attempt_id":"<Catch Hook attempt_id>"}`.
3. **Filter**: continue only when the authorization response's `allowed` is boolean `true`.
4. **Facebook Messenger → Send Message From Page**. Select the configured Page. Map `Recipient_id` from authorization `recipient_id`, and `Text` from authorization `text`.
5. **Webhooks → POST** to `/functions/v1/messenger-dispatch`: `{"op":"result","attempt_id":"<Catch Hook attempt_id>","outcome":"accepted","provider_id":"<Facebook result message ID if supplied>","run_reference":"<Zap run reference if supplied>"}`. Omit identifiers the action does not supply.

Place the send immediately after authorization without a delay step. Disable Zap autoreplay for this workflow. Never manually replay step 4 by itself: Facebook may have accepted the first attempt. A successful callback means provider acceptance, not confirmed delivery or reading. A failed send that prevents the final step is detected by the recovery worker after five minutes and shown as an unknown outcome.

Authorization is single-use. Repeated or expired authorizations return `allowed:false`; retries must pass through that boundary. A timeout after authorization must be reconciled against Zap history and the actual Messenger conversation. The app's **Confirmed sent / Confirmed not sent** controls require an evidence note and never resend automatically. If confirmed not sent, the owner can take over and send a fresh manual reply. Pause cannot recall a send already authorized by Zapier.

## 5. Recovery schedule and verification

In Supabase Vault, create `messenger_project_url` and `messenger_worker_secret` (the latter must match `MESSENGER_WORKER_SECRET`). Execute `scripts/messenger-schedule.sql` once. It creates the extensions if needed and upserts the named one-minute schedule. The scheduled job calls only the protected worker endpoint. Incoming events also wake the worker immediately; order-status and manual replies are picked up within the next recovery tick.

Open **Dashboard → Messenger inbox** (also linked from Settings). Send a new message from the configured tester. Check Zap A, Zap B, and receipt of the fixed test reply in Messenger. Click **I received the test reply**. The backend requires a recorded successful probe first. The connection remains paused until the owner clicks **Enable Messenger automation**.

Exercise menu inquiries, a pickup order, `CONFIRM <8-character code>`, and staff acceptance/ready/received. Codes expire after 30 minutes or pickup time, whichever is earlier. Corrections invalidate old codes. A confirmed order reserves no quantity; staff acceptance performs the normal atomic allocation checks. After confirmation, further concerns are flagged for the owner rather than modifying the order automatically.

## Operating and acceptance limits

- Owners alone see conversations and control takeover. Staff retain operational order access. No read receipts or push notifications are implemented.
- The inbox polls while visible and supports loading additional history. Manual replies require takeover and an open 24-hour window. Resuming considers only the latest unanswered supported customer message.
- Uncertain sends block subsequent sends in the same conversation until reconciled. Failed AI processing can be retried explicitly. Unacknowledged hook offers stop after five attempts; the owner may retry the handoff only if no attempt was authorized to send. Workers use leases and stale completions cannot save replies.
- Up to 120 distinct incoming messages are claimed per business/hour. A worker handles bounded batches. This is a small-pilot implementation; task usage includes each webhook and Facebook action. Measure actual Zap task usage before the pilot.
- Jobs persist in Postgres; provider-call retries can incur another Gemini charge. Do not assume exactly-once external delivery: a Zap send cannot be transactionally coupled to the database. Lost callback outcomes require reconciliation.
- Pause automation before connection repair. Inspect `worker_seen_at`, the named Cron job, Zap history, and message outcome indicators. No API currently claims knowledge of Zapier billing/quota/disconnection reasons unless the execution evidence supplies it.
- Do not claim hosted/device acceptance until Page tests, background recovery, and a physical Android check have passed. Set study-specific retention and participant approval before collecting research data.

Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run test:postgres`. For the live suite alone on real Postgres, use `npm run test:messenger:postgres`. No test sends Facebook messages.
