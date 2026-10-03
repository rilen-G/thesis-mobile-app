# Direct Meta Messenger implementation brief

## Status

**Deferred as of 2026-10-04.** No deployable webhook, worker, sender, conversation schema or follow-up schedule is included. The owner screen is an unavailable state. Hosted services are not affected by source deletion; see [Setup](SETUP.md).

## Standard Access research setup

Use the BuckStar Page and researchers' accounts as customers. Capture only new research chats after cutover; historical import is excluded.

Start with accepted tester invitations on the Meta developer app. Developer-app roles, Page permissions and mobile-app membership are separate. Only integration maintainers need administrative access; customer participants do not need mobile-app owner/staff permissions.

Prove actual incoming messages and replies, then record the working Graph API version, permissions and token ownership. Meta developer documentation was rate-limited during planning; tester eligibility must be verified in the live configuration. Standard Access is not a promise of public-customer access.

The official [Messenger collection](https://www.postman.com/meta/messenger-platform-api/collection/iyp204x/messenger-platform-api) and [Send API](https://www.postman.com/meta/messenger-platform-api/folder/vilwbh4/send-api) document Page tokens, pages_messaging and the response window. Verify Page subscription permissions during setup.

## Planned boundary

Researcher → signed Meta webhook → durable Supabase intake → worker → rules/business RAG/Gemini → Meta Send API.

Implement the verification challenge and raw-body signature validation. Resolve business identity from the registered Page. Persist original IDs/timestamps before acknowledging; handle batches, duplicate/older events, quick replies, attachments and echoes.

Credentials stay server-side. Preserve owner takeover, manual replies, order confirmation and status notices. Unmatched human Page replies pause automation; matched bot echoes never cause loops.

Recheck source versions, conversation revision, takeover, order state and send eligibility immediately before sending. Distinguish queued, provider-accepted, delivered/read where evidenced, failed, suppressed and unknown. Never blindly replay an ambiguous send.

Customer confirmation creates an unreserved Confirmed order. Staff acceptance checks and allocates stock.

## Follow-up policy

- Only unfinished inquiries/orders needing a customer response qualify; a resolved FAQ answer alone does not.
- First reminder: 30 minutes after the eligible customer message.
- Second: 2 hours after Meta accepts the first reminder.
- Hard cap: two automated follow-ups per conversation; no automatic counter reset.
- Stop on reply, opt-out, takeover, resolved inquiry, confirmed order, disabled automation or expired eligibility.
- Both sends must remain inside the standard 24-hour response window. Outgoing messages do not reopen it.
- Deterministic rules and approved templates control timing/content. Queueing is not sending; acceptance drives counts and second-reminder timing.
- Durable jobs, leases and recovery work while the mobile app is closed.

## Acceptance

Verify signature rejection, duplicate/batched/older events, research participant scope, confirmation, allocation, takeover races, token failures and unknown outcomes. Test reminders with a fixed clock, then actual researcher conversations. Local tests are not delivery evidence.
