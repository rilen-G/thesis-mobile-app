# Architecture and business rules

## Code and data ownership

The Expo app is the interface. Supabase Auth supplies identity, Postgres owns business state, Storage holds media, and Edge Functions call external providers. Gemini has no direct database authority.

| Location | Responsibility |
|---|---|
| `src/app/` | Expo Router routes and shared access boundaries |
| `src/components/`, `src/theme/` | Reusable native UI and design tokens |
| `src/features/operations/` | Business snapshots, writes, recovery journal, menu and order screens |
| `src/features/knowledge/` | Owner-approved FAQ/policy editor and versioned saves |
| `src/lib/` | Shared client infrastructure |
| `supabase/migrations/` | Reproducible database schema and permissions |
| `supabase/functions/_shared/` | Shared Messenger authentication and grounded reply formatting |
| `tests/`, `scripts/` | Regression fixtures and deliberate validation/evaluation tools |

The sibling `mockup/` is the visual reference: cream surfaces, Hanken Grotesk typography, terracotta actions, compact cards/status badges, and horizontal filters. Preserve the hierarchy while using native navigation and controls. Reuse types, domain rules, and tokens; rewrite DOM, browser storage, file inputs, CSS, and mouse-only interactions for native use. Check actual dependency versions in `package.json`.

Keep screens thin and domain logic in feature modules. Forms preserve input on failure; server state is reloaded from the backend. Loading, empty, error, retry, offline, and permission states are required. Unsupported features show unavailable states without fake operational values. Check Android back behavior, keyboards, safe areas, accessibility labels, contrast, text scaling, and low-memory image handling.

## Security and writes

One account has one business membership. Owners manage menu, quantities, settings, membership, knowledge and owner reports. Staff handle orders and necessary customer information. Authorization uses membership records, never user-editable Auth metadata.

All exposed business tables use RLS. Composite relationships prevent cross-business references. `public.app_command` and other public wrappers invoke restricted helpers in `private`; clients cannot bypass the command service with direct table mutations. Helpers set an empty search path and validate identities, payloads, versions, and permitted operations.

Each write has a stable request ID. Repeating the same ID/payload returns its recorded result; changing the payload under that ID fails. Optimistic record versions reject stale edits. Short transactions and per-business locks serialize allocation changes; external provider calls occur outside these locks.

An account-scoped local journal retains uncertain writes. After a lost acknowledgement, the user explicitly retries the same request; the app does not automatically submit on login/reconnect or accept conflicting writes while reconciliation is pending. A definitive response clears the journal. Agree retention for private request records and journals before the pilot; do not discard keys while clients may still retry them.

Only public client configuration goes in `EXPO_PUBLIC_*`. Keep Gemini, automation/webhook, signing, service-role, and database credentials server-side; Facebook connection credentials belong in the authorized provider connection, never the mobile bundle. Avoid logging tokens, unnecessary customer information, or complete conversations. Membership removal takes effect on database access; session revocation behavior still requires hosted Auth testing.

Live Messenger intake, grounded replies, coded confirmation, owner inbox/takeover, and status messages are implemented behind a disabled-by-default Zapier connection. Hosted configuration and actual Page acceptance are still required; see [Messenger setup](MESSENGER.md). Page publishing and follow-ups remain planned. The [Roadmap integration plan](ROADMAP.md#zapier-integration-plan--2026-09-23) records the transport boundary and unresolved insights source.

## Live Messenger transport

`messenger-ingest` authenticates a Page-specific connection secret, excludes echoes, and persists original event IDs before waking `messenger-worker`. The worker claims messages with expiring leases, uses shared grounding with live wording, and persists outbound jobs. Supabase Cron supplies one-minute recovery independently of the mobile app. The retired simulator tables are not present.

The outbound Zap must obtain single-use authorization from `messenger-dispatch` immediately before sending. It checks conversation revision, takeover, the 24-hour window, current sources, and current order status. Offered webhook jobs may be retried; authorized sends cannot. Provider callbacks record acceptance, not confirmed delivery. Unknown results block following sends until an owner reconciles them with evidence. A pause cannot retract a send already authorized.

Exact `CONFIRM <8-character code>` replies confirm a current, provider-accepted summary with a 30-minute/pickup expiry. The database rechecks sources, rules, and availability, creates one operational order, and retains the summary as evidence. Quantity is deducted only by the existing staff-acceptance transaction. Order transitions enqueue notices transactionally. The owner-only `messenger_command` follows membership, version, audit, and idempotent request-journal rules. Staff continue seeing orders without live-chat access.

## Menu and daily quantities

Products store name, description, integer-centavo price, active state, private `photo_path`, version, and optional category. Category names are business-defined: trim whitespace, require 1–40 characters, reject control characters and All/Uncategorized, and reuse existing spelling for case-insensitive matches within that business. Omitted category preserves the saved value; explicit NULL clears it. Server-generated product IDs retain their category and remain idempotent.

Menu filters and editor suggestions come from saved products. Search and category selection apply together; empty categories disappear and a removed selection falls back to All. Category edits do not change historical order item names, prices, totals, or quantities.

Daily allocation means sellable quantity, not a separate promotion cap. Each product/business date stores `total` and `used`; remaining is `total - used`. Dates use `Asia/Manila`. The owner initializes each day's quantity with an audited reason; an uninitialized day has no availability. Historical dates stay intact and total cannot fall below used quantity.

## Orders

The supported transitions are:

```text
Confirmed -> Accepted -> Ready -> Completed
Confirmed -> Rejected
Confirmed -> Expired
Accepted  -> Rejected
```

Confirmed means customer-confirmed and awaiting staff acceptance. It reserves no quantity. Acceptance checks current business hours, approved rules, same-day future pickup, active items, and availability, then reserves all items atomically. A failed item rolls back the entire acceptance; competing last-item requests cannot both succeed.

Rejecting a Confirmed order restores nothing. Rejecting an Accepted order restores quantity exactly once only when its policy, captured at acceptance, permits restoration. Later settings changes do not rewrite that policy. Ready becomes Completed after collection/handoff; an unclaimed order stays Ready, does not restore quantity, and is excluded from completed sales. There are no separate Draft, Preparing, Cancelled, or Unclaimed order statuses.

Orders retain item-name and integer-centavo price snapshots. Backend totals do not change when the menu changes. Confirmed pickup/payment/request details can be edited before acceptance. Item corrections after acceptance require rejection and a new order where the lifecycle permits it. Record payment method as information; neither the app nor AI verifies payment. Fulfillment is same-day pickup within the owner's opening/cutoff times; overnight and future-day schedules are outside the current release.

## Approved knowledge and grounded AI

The owner maintains FAQs through Settings and the owner-only `knowledge_command` RPC. Updates check optimistic versions and keep immutable knowledge history; retries return their saved result. Existing knowledge survives simulator retirement.

Messenger processing uses shared grounding under `supabase/functions/_shared/grounding.ts`. Replies use database values and exact approved excerpts, not free-form provider reply text. Product IDs, source versions, quantities, pickup times, and payment details are validated. Unsupported requests escalate to the owner. The application, not the model, checks customer confirmation codes.

The old test-chat route, Edge Function, RPCs, evaluation traces, and simulated tables are removed. The historical baseline is kept unchanged; the retirement migration removes those objects on new and existing databases.

## Operational limits and retention

The current operational snapshot loads business records together and displays the latest 100 audit events. Knowledge management currently caps entries at 1,000 rows; Gemini context uses up to 30 messages, 100 active products, and 40 approved knowledge items. Catalog replies list at most 20 products. Provider attempts are capped at 120 recorded attempts per business/hour. Add pagination/search before expanding beyond the small pilot dataset.

Photo replacement can leave unreferenced uploads. Clean them through an administrator process that checks references and pending-save grace periods. Define retention/access/export/deletion rules for conversations, knowledge history, request journals, uploads, and evaluation traces before participant collection. Research exports should use minimal data and pseudonymous IDs. See [Validation](VALIDATION.md) for current acceptance limits and [Roadmap](ROADMAP.md) for future integrations.
