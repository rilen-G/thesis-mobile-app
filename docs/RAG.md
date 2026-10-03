# Supabase RAG implementation brief

## Status

**Query-specific RAG is deferred as of 2026-10-04.** Approved knowledge editing and a pure grounding formatter exist. No live worker, embedding job, vector index or retrieval RPC is implemented. Loading a bounded list of FAQs or testing the helper does not satisfy thesis RAG.

RAG retrieves relevant saved material for each request and supplies context at runtime; it does not retrain the model.

## Planned design

Use Supabase Postgres/pgvector with hybrid semantic and keyword retrieval, retaining Gemini. No separate vector service or agent framework is needed initially.

| Collection | Source | Allowed use |
|---|---|---|
| Business knowledge | Approved FAQs, policies, pickup instructions, business descriptions | Messenger answers and factual promotional context |
| Marketing inspiration | Researcher-approved external references and annotations | Promotional ideas only |

Messenger must never retrieve marketing inspiration. Prices, products, availability, operating hours, offers and order state remain authoritative relational queries.

Add versioned business-scoped chunks, embeddings, indexing jobs and retrieval evidence through migrations. Record source ID/version, collection, content hash, approval/index state and model identity.

Keep short FAQs intact; split longer text into approximately 300–500-token chunks. Start with gemini-embedding-2 at 768 dimensions and documented query/document formats, verifying availability before implementation. Model changes require reindexing; incompatible vectors cannot be compared.

Combine HNSW and PostgreSQL keyword indexes with reciprocal-rank fusion. Start with five relevant chunks and a bounded context budget. Calibrate relevance/abstention on development fixtures before freezing evaluation settings.

Filter business, collection, approval and current source version inside retrieval. Enforce business scope explicitly in privileged workers; service credentials bypass RLS. Durable jobs index approved content; edits, deapproval/deletion immediately exclude old versions, including when indexing fails.

Validate sources during generation and immediately before sending. Missing, weak, conflicting or stale evidence clarifies/escalates. Retrieved text is data, not instructions. Preserve deterministic order, payment, allocation and messaging-window rules.

## Evaluation

Compare against a bounded-context baseline using separate development and frozen evaluation sets. Include English, Filipino, Taglish, paraphrases, no-match, conflicting sources, malicious instructions, withdrawn approval and cross-business attempts.

Measure retrieval relevance/recall, answer grounding, abstention, latency and cost. Record source/model/prompt versions without logging full conversations. Adviser-approved scoring and targets are required before formal thesis acceptance.

[Supabase hybrid search](https://supabase.com/docs/guides/ai/hybrid-search), [RAG permissions](https://supabase.com/docs/guides/ai/rag-with-permissions), [pgvector](https://supabase.com/docs/guides/database/extensions/pgvector), [Gemini embeddings](https://ai.google.dev/gemini-api/docs/embeddings).
