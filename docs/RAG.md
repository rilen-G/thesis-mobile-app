# Supabase RAG for Messenger replies

## Status and current behavior

**Not implemented as of 2026-09-24.** The current Messenger worker retrieves up to 40 approved `business_knowledge` rows, 100 active products, and 30 recent messages from Supabase. It sends that bounded context to Gemini. The model returns intent and source IDs; `groundedReply` validates the IDs and formats replies from saved business data and approved excerpts. This is database-backed grounding, but there is no query-specific retrieval, embedding generation, vector index, or similarity search. The fixed connection-test reply bypasses Gemini and does not validate grounded replies or RAG.

The relevant code is `supabase/migrations/20260922174423_messenger_integration.sql` (`claim`), `supabase/functions/messenger-worker/index.ts`, and `supabase/functions/_shared/grounding.ts`. Keep the existing deterministic order, payment, confirmation-code, takeover, and outbound authorization rules when adding retrieval.

## Required implementation

Implement query-specific retrieval through Supabase for approved business knowledge before asking Gemini to classify and extract a normal Messenger reply. If the thesis proposal specifies semantic or vector RAG, use server-side embeddings and a Supabase Postgres vector index; loading every approved FAQ into the prompt does not satisfy that requirement. Confirm the proposal's exact definition, embedding provider/model, scoring method, and target thresholds with the team/adviser before claiming thesis alignment.

1. Add a migration for versioned, business-scoped knowledge chunks and embeddings, plus an indexed search function. Search must filter by the authenticated business and currently approved source version. Do not expose another business's text or vectors through direct client access or a broad RPC.
2. Generate or refresh embeddings on approved knowledge creation/edit; invalidate or remove them on deapproval or deletion. Handle indexing failures explicitly so stale text cannot appear in a reply. Define a backfill for existing approved knowledge.
3. In the trusted Messenger worker, embed the incoming question, retrieve a small relevant set from Supabase, and pass only those excerpts and source IDs to Gemini. Set documented top-k and relevance behavior; an empty or low-confidence result should ask for clarification or escalate to the owner.
4. Preserve the current source-ID and version checks at reply creation and again before Zap B is authorized to send. Keep products, prices, stock, opening hours, and order state on authoritative relational queries; their live values must not come from embeddings.
5. Keep embedding and Gemini credentials in Edge Function secrets. Do not put them in Expo, Zapier, or browser code. Bound input size, retrieved context, latency, retries, cost, and logging of customer text.

## Acceptance evidence

- A relevant question retrieves the intended approved FAQ chunk and produces an answer traceable to its current source ID/version.
- Unapproved, deleted, stale-version, and other-business knowledge cannot be retrieved or cited. Changing a source between retrieval and send suppresses or regenerates the reply safely.
- No-match, conflicting-source, provider-failure, and prompt-injection cases clarify or escalate without inventing facts.
- Menu, hours, availability, order confirmation, payment, takeover, and the 24-hour send window still follow their existing deterministic rules.
- Compare the new retrieval path with the current bounded-context baseline using frozen, adviser-approved questions and scoring criteria. Record retrieval quality, answer grounding, latency, and cost. Complete live Page and physical Android checks before calling the feature accepted.

Do not mark RAG complete based on the fixed Messenger probe or the existing approved-knowledge grounding alone. See [Architecture](ARCHITECTURE.md) for current behavior, [Roadmap](ROADMAP.md) for the delivery gate, and [Validation](VALIDATION.md) for broader acceptance limits.
