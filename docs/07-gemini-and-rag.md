# Gemini and RAG

## Appropriate AI Tasks

Gemini may assist with:

- promotional captions and content variants;
- FAQ answers grounded in business knowledge;
- structured extraction of order details from chat;
- suggested clarification questions;
- reply drafts and safe summaries;
- template text suggestions;
- descriptive analytics summaries.

It should not:

- verify payment;
- override database availability;
- finalize promotion cutoff decisions;
- invent products, prices, policies, or delivery promises;
- publish without required approval; or
- make unrestricted database changes.

## Backend Invocation

The mobile application and webhook processor call a trusted backend endpoint. That endpoint authenticates the request, loads business context, retrieves relevant knowledge, calls the configured model, validates the result, applies deterministic rules, records a safe trace, and returns an application-level response.

Never place a Gemini API key in the Expo application.

## Structured Output

Use a schema for outputs that drive application behavior. An order extraction result could contain:

- intent;
- product references;
- quantities;
- fulfillment preference;
- customer details collected;
- missing required fields;
- proposed customer reply;
- confidence or clarification flag.

A schema constrains shape, not truth. The backend must still:

- resolve product references against the database;
- use current prices;
- recompute totals;
- check availability;
- validate required fields;
- reject unsupported enum values;
- request clarification when ambiguous.

## RAG Knowledge Sources

Good retrieval sources include:

- current menu and product details;
- opening hours;
- pickup and delivery areas;
- fees and minimums;
- ordering instructions;
- allergen or preparation notes approved by the business;
- cancellation and refund policies;
- current promotion terms;
- owner-authored FAQs.

Prefer structured database queries for exact values such as price, quantity, and current availability. Vector retrieval is more useful for descriptive policies and varied customer wording.

## Ingestion

1. The owner creates or updates an approved knowledge item.
2. Normalize the text and attach business, source, version, and status metadata.
3. Split only when the source is long enough to require chunks.
4. Generate embeddings in the backend.
5. Store chunks and embeddings with strict business isolation.
6. Retire or replace embeddings when the source changes.

Do not ingest unapproved AI output as authoritative business knowledge.

## Retrieval

For each eligible customer question:

1. Identify the business and conversation.
2. Classify whether a deterministic lookup can answer it.
3. Search only active knowledge belonging to that business.
4. Retrieve a small set of relevant sources.
5. Build a prompt that distinguishes instructions from retrieved data.
6. Ask for a grounded answer or an explicit cannot-answer result.
7. Validate and log the source IDs used.

If confidence is insufficient or sources conflict, ask the customer for clarification or route to a human.

## Isolation and Prompt-Injection Defense

- Filter every retrieval query by trusted business identity.
- Treat retrieved text and customer messages as untrusted content, not system instructions.
- Never allow retrieved content to request secrets, tools, or policy changes.
- Allowlist backend actions that AI may propose.
- Validate every tool argument.
- Limit prompt and response size.
- Redact unnecessary personal data.

## Model Configuration

Keep model names and generation settings in backend configuration instead of hardcoding them throughout the app. Separate configurations by task so the team can change a text model, image model, temperature, safety setting, or fallback without a mobile release.

Choose models through small evaluations using actual project examples. Measure grounded correctness, schema validity, latency, cost, Filipino and English quality, and refusal or escalation behavior. Current model availability and pricing must be rechecked in official documentation before deployment.

## Failure and Fallback Behavior

- For FAQ failure, offer human assistance or a safe contact path.
- For extraction failure, preserve the conversation and ask a specific clarification.
- For generation failure, preserve the owner’s form inputs and allow retry.
- For rate limits, queue eligible work or show a retry time.
- Do not silently substitute invented content.

## Evaluation Set

Create a versioned test set containing representative questions, paraphrases, Taglish language, misspellings, ambiguous orders, unavailable items, conflicting requests, prompt injection attempts, and out-of-scope payment questions. Keep expected sources and acceptable outcomes so model changes can be compared.

