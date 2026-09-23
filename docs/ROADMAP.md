# Scope and roadmap

## Current position

This Android-first thesis app supports Philippine micro and small foodservice businesses. Owners manage the business and approve consequential actions; staff handle daily operations. Customers are intended to use Messenger when the live integration is approved and available. The current in-app customer chat is explicitly a test environment.

| Area | Status |
|---|---|
| Auth, membership, menu/photos, customers, settings | Implemented; remaining hosted/device acceptance is listed in [Validation](VALIDATION.md) |
| Manual orders, quantities, audit, recovery of uncertain saves | Implemented with database regression coverage |
| Approved knowledge and grounded Messenger extraction | Implemented; former AI test chat retired |
| Promotional drafts, template editing, manual export | Planned |
| Follow-up reminders and simulated delivery | Planned |
| Research dashboard and exports | Planned beyond current operational views |
| Live Messenger automation | Implemented locally with disabled-by-default Zapier connections; deployment, Page feasibility, and device acceptance remain open |
| Automatic Facebook Page publishing | Planned through Zapier after Messenger acceptance |
| Facebook Page business insights | Undecided; assess available metrics and adviser-approved collection methods separately |

The original fulfillment/access decisions were recorded on 2026-09-11 and the six-status lifecycle on 2026-09-14. Daily allocation means sellable quantity; pickup uses Asia/Manila; owners control rules and staff membership. [Architecture](ARCHITECTURE.md) owns the exact implemented rules. Buckstars mock-rule approval is not partner/adviser approval.

Payment processing/verification, courier dispatch, accounting/POS replacement, ad buying, extra social platforms, and enterprise multi-branch administration are outside scope. AI cannot make final inventory, payment, publication, or campaign-cutoff decisions.

## Delivery sequence and acceptance gates

| Phase | Deliverable | Gate before acceptance |
|---|---|---|
| 0 | Reproducible environment and delivery ownership | Another member can run the build; account recovery, budgets, target devices, and deployment responsibilities are recorded |
| 1 | Persistent business operations | Owner creates a private-photo menu item, restarts, retrieves it; unrelated-business and staff restrictions hold |
| 2 | Manual orders and daily allocation | Complete an order, preserve historical prices, prevent last-item overselling, and reconcile lost responses without duplicates |
| 3 | Grounded Messenger replies | Frozen language/safety scenarios meet the approved scoring method; takeover works; test activity never affects operational totals |
| 4 | Promotional drafts and manual export | Drafts restore, edits invalidate approval, and accurate graphics export on physical Android |
| 5 | Follow-up reminders and simulation | Fixed-clock tests prove timing, eligibility, stop conditions, two-message cap, and retry/crash recovery |
| 6 | Dashboard and research exports | Formulas match hand calculations; test data and unavailable external metrics remain distinguishable |
| 7 | Zapier messaging and publishing integration | Account capabilities, owner approval, delivery recovery, and actual Page tests pass; insights source is decided separately |
| 8 | Release and approved pilot | Independent review, device acceptance, privacy, backups, instruments, and study dates are ready |

Begin Zapier feasibility testing and insights consultation early; neither blocks Phases 1–6. A pilot without live Messenger or required external metrics needs adviser-approved revisions to the study. Passing local tests alone does not sign off a phase. Assign a primary implementer and a different reviewer/tester for each milestone; at least two team members should understand deployment and recovery. Commits and pushes remain under the user's control.

## Promotional tools

Start with a business brief and current product/offer facts. The backend generates editable caption options; the owner previews and approves an exact content/asset version. Changes to caption, image, price, offer, dates, or target invalidate approval. Distinguish draft, approved, and exported states. Manual publication is owner-reported, with optional evidence; export is not proof of Facebook publication.

Build a constrained template editor: curated layouts, product photos, headline/price/offer/call-to-action, approved fonts and colors, and bounded position/size controls. Save a versioned editable document containing canvas/background, ordered elements, text/styles, asset references/crops, geometry, and locked properties, alongside a flattened 1080 × 1080 output. Validate documents, safe areas, and overflow.

Prove static rendering and export first, then form editing, selection, movement/resizing, snapping, persistence, and sharing. Test long text, large prices, low-resolution/large photos, and lower-memory devices early. Optional AI imagery requires backend quotas and owner review of food appearance, portions, text, and branding. Preserve inputs on provider failure.

## Follow-ups

The planned cap is two automated follow-ups per eligible conversation. Tuesday–Friday at 11:00 AM was a proposal, not an approved schedule. The group must decide timezone, first/second delays, inactivity trigger, eligible order stage, holidays, and whether manual reminders belong in the pilot.

Store due times in UTC with business timezone separately. Durable jobs need states, leases, attempt history, and stable retry keys. Recheck eligibility immediately before processing and stop on applicable replies, takeover, opt-out, terminal order state, or count limit. Use deterministic rules, not AI, for timing. Use mocked/local harnesses for simulations; never report them as Messenger delivery. Live sending also requires current provider eligibility.

## Zapier integration plan — 2026-09-23

The project uses Zapier for Messenger message automation because direct Meta API integration is problematic for the team. The first Messenger implementation now includes intake, grounded replies, code confirmation, owner inbox/takeover, and order-status messages. Facebook Page publishing remains planned. This replaces the custom Meta connection flow; it does not establish deployment, live acceptance, or research approval. See [Messenger setup](MESSENGER.md). Facebook authorization and platform rules still apply through the third-party service.

Implementation decisions confirmed by the user: Messenger orders first; trial/paid webhook workflows available; Facebook accounts connected but message/reply tests not yet performed; exact confirmation codes; owner-only inbox; timed follow-ups deferred. Same-day pickup and existing staff order permissions remain unchanged.

The phrase “automatic posting on Messenger” needs a destination decision: Messenger sends messages to conversations, while Facebook Page publishing creates promotional posts. Provisionally, plan Page publishing through Zapier separately from Messenger replies/follow-ups; confirm whether promotional Messenger messages are also intended before implementation. Automatic publication always requires the owner's approval of the exact content, asset, destination, and schedule; edits invalidate that approval. Manual export remains a fallback.

### Capability checks

Official sources checked on 2026-09-23; verify again in the intended Zapier account before enabling workflows:

- [Facebook Messenger integration](https://zapier.com/apps/facebook-messenger/integrations) lists `New Message Sent to Page` and `Send Message From Page`, but its FAQ also calls the integration action-only. Prove incoming-message capture and outgoing replies on the actual Page; do not assume complete two-way support from the catalog.
- [Facebook Pages setup and actions](https://help.zapier.com/hc/en-us/articles/8495933127693-How-to-get-started-with-Facebook-Pages) lists `Create Page Post`, `Create Page Photo`, and `Page Post Insights`. Check Page access, caption/media support, result identifiers, and the selected plan's requirements.
- [Messenger limitations](https://help.zapier.com/hc/en-us/articles/8496018935437-Common-Problems-with-Facebook-Messenger-on-Zapier) describe the standard 24-hour response window. Zapier does not remove messaging eligibility restrictions; the two-follow-up cap is a product limit, not permission to send.

### Planned workflow boundaries

Zapier transports events and executes approved external actions. The trusted application backend continues to own business rules, grounded Gemini processing, order validation, approvals, takeover, and follow-up eligibility. Live Messenger uses the operational intake path; the former owner-only test chat has been retired. Do not replace validated reply generation with an independent Zapier chatbot by default.

Bind each connection to its business and Page. Authenticate inbound requests and callbacks using a verified mechanism supported by the chosen workflow; validate signatures where supplied, reject replay/forged requests, persist stable event IDs, and process heavy work asynchronously. Keep automation credentials and webhook URLs out of the mobile bundle; never give Zaps unrestricted database credentials. Send only the data needed for the workflow and define access/retention for Zap history.

Immediately before the external action, the workflow must obtain backend authorization for current approval, destination, messaging eligibility, and takeover state. Use stable job IDs across retries and record attempts, Zap run references, provider IDs when available, and confirmed outcomes. A queued Zap or successful webhook handoff is not delivery/publication. Reconcile unknown outcomes before replaying; if the provider cannot deduplicate or expose outcomes, require manual reconciliation. Distinguish disconnected, permission failure, paused Zap, task quota, ineligible messaging, failed delivery, and unknown outcome states.

### Facebook Page business insights — undecided

Evaluate Zapier's post-insights action against the exact dashboard and research metrics; its existence does not establish Page-level coverage, historical availability, or Messenger attribution. Alternatives to assess are owner-supplied Meta Business Suite exports/manual observations, or a separately approved direct Meta integration only if necessary and feasible. No collection route is selected yet.

Keep operational order/sales metrics separate from external reach, views, and engagement. Record source, collection period, timezone, freshness, and missing-data treatment for each measure. Show unavailable external metrics as unavailable. Decide with the adviser how missing insights affect SO4/SO8 and the study before collection; see [Validation](VALIDATION.md).

## Decisions still needed

- Final app name/package/icon, signing-key ownership, development/pilot project owners, recovery contacts, service budget, quotas, and alerts.
- Partner confirmation of hours, pickup/rejection rules, staffing permissions beyond the implemented roles, and onboarding/support procedures.
- Adviser-approved AI scoring unit, targets, reference answers, and research instruments.
- Brand layouts, fonts, colors, photos, and template export requirements.
- Follow-up eligibility, timing, holidays, stop conditions, and pilot scope.
- Metric formulas, promotion attribution, manual observation methods, and missing-data treatment.
- Privacy/consent, retention, deletion triggers, exports, access, and transfer procedures.
- Zapier account/plan ownership, task budget, incoming-message feasibility, posting destination, and workflow support/recovery responsibilities.
- Facebook Page insights source and metric coverage, affected thesis objectives, and adviser approval; participant, baseline, pilot, exclusion, and analysis dates.

For each decision, record date, participants, choice, rationale, alternatives, affected code/docs, and review point here. Do not infer approval from a mock demonstration. Mitigate the principal risks with concurrency/RLS tests, frozen AI fixtures, early device export checks, explicit offline recovery, service quotas, and shared deployment knowledge.
