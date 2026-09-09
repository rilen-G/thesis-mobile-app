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

## Recommended Order Status Flow

~~~text
draft
  -> awaiting_customer_confirmation
  -> confirmed
  -> preparing
  -> ready
  -> completed

awaiting_customer_confirmation -> abandoned or cancelled
confirmed or preparing -> rejected or cancelled, subject to business rules
ready -> unclaimed or completed
~~~

Use one controlled transition service or database function. Do not allow arbitrary status strings or direct client updates.

## Confirmation Transaction

Order confirmation must be atomic:

1. Lock or otherwise protect the relevant allocation record.
2. Re-read available quantity.
3. Reject the confirmation if quantity is insufficient or the offer is closed.
4. Change the order status.
5. Reduce the allocation.
6. Append status and allocation history.
7. Commit all changes together.

The database result is authoritative even if an AI message previously suggested availability.

## Allocation Rules

- Draft and incomplete conversations do not consume allocation.
- A successfully confirmed order consumes allocation once.
- A retried confirmation must not consume it twice.
- Rejection or eligible cancellation restores allocation once.
- Completed and unclaimed outcomes do not silently restore inventory.
- Manual adjustments require a reason and audit entry.
- The system may alert the owner when a limit is near, but the owner makes the final promotion cutoff decision.

The group must define whether allocation represents physical inventory, a promotion-only sales cap, or both. If both are required, model them separately.

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

