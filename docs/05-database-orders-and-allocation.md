# Database, Orders, and Allocation

## Data Ownership

Every business-owned record should carry a business identifier, either directly or through a relationship that RLS can evaluate safely. Avoid client-supplied ownership values when they can be derived from the authenticated membership.

## Logical Data Areas

The first schema will likely need:

- profiles, businesses, business members, and roles;
- products, product availability, and menu information;
- FAQ and policy knowledge entries;
- promotions, content versions, approvals, and publication attempts;
- templates, template elements, source assets, and rendered exports;
- conversations, participants, messages, and webhook events;
- orders, order items, status history, and allocation adjustments;
- scheduled follow-ups and delivery attempts;
- integration connections and encrypted token references;
- AI runs, prompt versions, retrieval citations, and safety outcomes;
- audit events and dashboard aggregates.

Names can change. The invariants should not.

## Product and Order Fields

At minimum, a sellable product needs a name, price, active state, and availability definition. Orders need:

- business and customer association;
- source conversation;
- ordered items with price snapshots;
- quantities and computed totals;
- fulfillment method;
- required contact and fulfillment details;
- payment method as customer-provided information;
- order status;
- timestamps and actor history.

Never recompute old order totals from a product price that may have changed.

## Implemented Phase 2 Order Status Flow

~~~text
confirmed -> accepted -> ready -> completed
confirmed -> rejected
confirmed -> expired
accepted -> rejected
~~~

Use one controlled transition service or database function. Do not allow arbitrary status strings or direct client updates.

The only persisted order statuses are Confirmed, Accepted, Ready, Completed, Rejected, and Expired. New orders begin as Confirmed and wait for a staff user to accept them. Cancellation outcomes are recorded as Rejected. There is no separate Draft, Preparing, Cancelled, or Unclaimed order status. An unclaimed order remains Ready and is excluded from collected/completed sales. Same-day pickup in Asia/Manila remains the implemented fulfillment rule. The owner records opening/cutoff times in Settings. See [Backend Setup](14-backend-setup.md) for deployed-schema prerequisites, exact rules, and acceptance checks. AI/chat states remain future work.

## Acceptance Transaction

Staff acceptance must be atomic:

1. Lock or otherwise protect the relevant allocation record.
2. Re-read available quantity.
3. Reject the confirmation if quantity is insufficient or the offer is closed.
4. Change the order status.
5. Reduce the allocation.
6. Append status and allocation history.
7. Commit all changes together.

The database result is authoritative even if an AI message previously suggested availability.

## Allocation Rules

- Confirmed orders awaiting staff acceptance do not consume allocation.
- A successfully accepted order consumes allocation once.
- A retried acceptance must not consume it twice.
- Rejection of an accepted order restores allocation once when the saved business policy enables restoration.
- Rejected confirmed orders never consumed allocation. Completed orders and unclaimed Ready orders do not silently restore inventory.
- Manual adjustments require a reason and audit entry.
- The system may alert the owner when a limit is near, but the owner makes the final promotion cutoff decision.

Allocation was defined as daily sellable quantity. Each product/business date stores total and used quantity; remaining equals total minus used. Prior dates are retained, and the owner initializes each day's quantity with an audited adjustment. This is not a separate promotion sales cap.

## Idempotency

Use a stable key for each externally initiated operation. Examples include Meta event ID, client-generated order-confirmation key, scheduled-job ID, and publication request ID. Store the key with the operation result and return the existing result for safe retries.

## Payment Boundary

The system may record:

- the payment method selected by the customer;
- owner-entered payment notes;
- a manually reviewed payment state.

It must not claim that a payment is verified unless a supported payment provider or authorized human verified it. AI-generated chat text is never proof of payment.

## Audit History

Record consequential changes with the business, record type and ID, action, actor type and actor ID, timestamp, previous and new status where relevant, and a safe metadata summary. Avoid copying access tokens or full sensitive payloads into audit records.

