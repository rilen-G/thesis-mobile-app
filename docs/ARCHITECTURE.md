# Architecture and business rules

## Current implementation

Expo is the interface. Supabase Auth supplies identity, Postgres owns business state, and private Storage holds product photos. No deployable AI or Messenger endpoint is included.

| Location | Responsibility |
|---|---|
| src/app | Expo Router routes and access boundaries |
| src/components and src/theme | Native UI and design tokens |
| src/features/operations | Snapshots, commands, recovery, menu, customers, orders and settings |
| src/features/knowledge | Owner-approved FAQ/policy editing and versioned saves |
| src/features/messenger | Unavailable-state screen |
| supabase/migrations | Fresh-install business schema and knowledge command |
| supabase/functions/_shared/grounding.ts | Pure validation/formatting foundation, exercised locally |
| tests and scripts | Regression and explicit verification tools |

Preserve existing cream surfaces, Hanken Grotesk, terracotta actions, cards and native navigation. Keep screens thin. Forms retain inputs on failure; data screens expose loading, empty, error, retry, offline and permission states. Unsupported features never display fabricated results.

## Authorization and recovery

One account has one business membership. Owners manage menu, allocations, settings, staff, knowledge and reports. Staff handle orders and necessary customer information. Use membership records, never editable user metadata.

Exposed business tables use RLS. Composite relationships prevent cross-business references. Public RPC wrappers invoke restricted private helpers with an empty search path; clients cannot mutate tables directly.

Commands use stable request IDs and optimistic record versions. Same-request retries return the saved result; changed payloads under that ID fail. Per-business locks and short transactions serialize allocations.

Journals are scoped by backend URL and account. Unknown saves require explicit retry; reconnecting never automatically resubmits them. The new namespace does not replay earlier journals into a replacement backend. Reconcile old saves in the original environment before cutover.

Only the Supabase URL and public client key belong in EXPO_PUBLIC variables. Future Gemini, Meta and Apify calls and secrets stay on the backend. Do not log full conversations or tokens.

## Menu and photos

Products store name, description, integer-centavo price, active state, version, optional category and private photo_path. Categories allow 1–40 characters, exclude control characters and All/Uncategorized, and reuse spelling for case-insensitive matches within a business.

Owners upload actual food photography. Current menu uploads are resized/compressed and stored at immutable paths. Future high-resolution original retention belongs to the content milestone. No generated demonstration menu photos are bundled or seeded.

Daily allocation is sellable quantity: remaining = total - used. Dates use Asia/Manila. Owners initialize each day with an audited reason; uninitialized days have no availability. Historical records remain intact and total cannot fall below used.

## Orders

~~~text
Confirmed -> Accepted -> Ready -> Completed
Confirmed -> Rejected
Confirmed -> Expired
Accepted  -> Rejected
~~~

Confirmed orders reserve nothing. Acceptance checks approved rules, opening/cutoff times, same-day future pickup, active products and availability, then reserves every item atomically. A failed item rolls back the whole operation; competing requests cannot both take the final portion.

Rejecting/expiring a Confirmed order restores nothing. Rejecting an Accepted order restores quantity exactly once only when its acceptance-time policy permits. An unclaimed Ready order stays Ready and does not restore allocation. Only Completed orders count as completed sales.

Item names and prices are snapshots. Pickup/payment/request details may be edited while Confirmed. Rejection reasons are saved and audited; the current app does not send them to Messenger. Payment method is information, not verification. Expiration is supported by the command layer; no automatic expiration worker exists in this baseline.

## Knowledge and deferred services

Owner knowledge saves use knowledge_command, immutable version history, membership checks and idempotent requests. The grounding helper validates supplied IDs, approved excerpts, quantities and pickup details. It has no provider call, webhook, worker or app entrypoint and does not constitute RAG or a chatbot.

[Messenger](MESSENGER.md), [RAG](RAG.md) and [Content](CONTENT.md) define later work. Current operational totals use app records; external reach, attribution and follow-up metrics remain unavailable.

Snapshots load business records and the latest 100 audit events; knowledge editing reads at most 1,000 entries. Add pagination before larger pilots. Clean unused uploads only after checking references and pending-save grace periods.

Agree consent, retention/deletion and pseudonymized export policies before participant collection. Source cleanup does not alter hosted services; see [Setup](SETUP.md).
