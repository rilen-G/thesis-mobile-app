# Post-Frontend Implementation Roadmap

Updated: 2026-09-11. Status: planned work, not completed implementation.

Implementation update (2026-09-12): Phase 1–2 code and local database tests are present. Hosted Supabase configuration, real Auth/Storage checks, and physical Android acceptance remain outstanding. See [Backend Setup and Phase 1–2 Validation](14-backend-setup.md); the phase completion gates are not yet signed off.

## Direction

Build persistent business operations first, followed by AI assistance, promotional tools, and evaluation. Live Meta integration is deferred from the critical path while the team consults its professor about advanced-access requirements. It is not abandoned.

Use an explicitly labeled in-app test chat for AI evaluation and export promotional materials for manual posting. Simulation and export are not evidence of real Messenger delivery or Facebook publication. Progress through completion gates rather than fixed dates.

## Agreed Defaults

- Android-first, React Native, Expo, and TypeScript; Supabase is authoritative and Gemini runs server-side.
- Owners manage menu, promotions, settings, integrations, and reporting. Staff handle orders and necessary customer details. Configurable staff permissions are deferred.
- Allocation means daily sellable quantity, stored by business date in `Asia/Manila`. Preserve historical quantities and adjustments.
- Initial fulfillment is pickup. Payments, courier dispatch, accounting, and additional social platforms are out of scope.
- Offline writes are not silently queued. Preserve form inputs and provide explicit retry.
- Isolate test records and allocation from operational data and exclude them from operational metrics.
- Partner and adviser decisions are required inputs, not choices implementers may invent.

## Phase Overview

| Phase | Deliverable | Dependency |
|---|---|---|
| 0 | Environment and delivery readiness | Existing frontend |
| 1 | Authentication and persistent business records | Phase 0 |
| 2 | Manual orders and daily allocation | Phase 1; approved order rules |
| 3 | AI test chat and grounded assistance | Phase 2; approved evaluation method |
| 4 | Promotional tools and manual export | Phase 1; backend AI foundation from Phase 3 |
| 5 | Follow-up reminders and simulated delivery | Phase 3; approved timing and eligibility |
| 6 | Dashboard and research exports | Events from Phases 2–5; approved metrics |
| 7 | Meta decision and conditional integration | Professor consultation and access feasibility |
| 8 | Release, approved pilot, and analysis | Relevant feature gates and approved study scope |

Begin Phase 7 consultation during Phase 0. Live Meta implementation does not block Phases 1–6. Phase 8 can proceed without it only under an adviser-approved study scope. Prove template export feasibility early before completing the editor.

## Phase 0 — Environment and Delivery Readiness

**Goal:** reproducible development and safe deployment conventions.

### Deliverables

- Inventory implemented screens, mock actions, and missing workflows; preserve the existing visual patterns.
- Establish development and pilot environment conventions, versioned migrations, test fixtures, and setup instructions.
- Identify owners and recovery contacts for Supabase, Gemini, Android signing, and potential Meta accounts.
- Keep provider credentials and privileged keys server-side; expose only public backend configuration in the app.
- Record target physical Android devices, release-build workflow, budgets, and operational contacts.
- Begin professor consultation about Meta and affected thesis objectives.
- Run an early template-rendering/export feasibility check on the lower-memory device.

### Completion gate

Another team member can run the documented development build. Configuration exposes no backend secrets. Migration/test-data procedures are reproducible, and remaining external dependencies have responsible people.

## Phase 1 — Authentication and Persistent Business Records

**Goal:** replace the first mock workflow with real, access-controlled data.

### Deliverables

- Sign-in, account recovery, session restoration, sign-out, and trusted business membership resolution.
- Owner/staff authorization enforced by backend policies, not only hidden controls.
- Persistent business settings, menu, customers, and daily availability.
- Private product-photo upload, authorized retrieval through expiring URLs, replacement, and failure handling.
- Audit records for consequential data changes.
- Loading, empty, validation, error, retry, and offline states on connected screens.
- Confine fixtures to development/test use; show unavailable states for unfinished operational features.

### Data and interface requirements

- Replace in-memory mutations with typed asynchronous services and feature hooks.
- Store stable identifiers, integer centavo amounts, numeric quantities, timestamps, and storage references; format values in the UI.
- Resolve permissions from trusted membership records. Signup cannot grant privileged access to an existing business through user-entered roles.
- Enable row-level security on exposed business tables and explicit policies for private assets.

### Completion gate

An owner signs in, creates a menu item with a private photo, restarts the app, and retrieves both. Customer/settings edits persist. Two-business and owner/staff tests reject unauthorized reads and writes. Expired sessions and upload failures have actionable recovery paths.

**First implementation target:** sign in → create menu item → upload photo → restart → retrieve securely. Finish this before connecting every screen.

## Phase 2 — Manual Orders and Daily Allocation

**Goal:** useful daily operations without AI or Messenger.

### Deliverables

- Manual order creation with customer, items, quantities, pickup details, and recorded payment method.
- Item price snapshots and backend-calculated totals independent of later menu price changes.
- Controlled six-status transitions, rejection reasons, and actor history.
- Atomic confirmation that checks and consumes daily quantity exactly once.
- Audited manual adjustments and exactly-once restoration for eligible rejection of accepted orders.
- Customer purchase history derived from authoritative orders.
- Typed validation, permission, insufficient-quantity, and conflict errors.

### Required decisions

Keep frontend labels aligned with the approved backend lifecycle: Confirmed, Accepted, Ready, Completed, Rejected, and Expired. Confirmed is customer-confirmed and awaiting staff acceptance. Cancellation outcomes become Rejected, while an unclaimed order remains Ready and is not collected. Preserve pickup cutoff, business-date assignment, and same-day pickup rules.

### Completion gate

Staff can create and complete an order without AI. Concurrent acceptances cannot oversell the final item. Repeated submissions and lost-response retries cannot duplicate orders or deductions. Invalid transitions fail server-side. Historical prices and daily quantities remain intact. Completed orders and unclaimed Ready orders do not automatically restore quantity.

## Phase 3 — AI Test Chat and Grounded Assistance

**Goal:** demonstrate and evaluate conversational behavior independently of Meta access.

### Deliverables

- Clearly labeled test chat with customer-message input, assistant replies, history, and owner takeover.
- Backend Gemini classification, structured order extraction, and targeted clarification.
- Owner-maintained approved FAQs, opening hours, pickup instructions, and business policies.
- Exact database lookups for price/availability and retrieval of approved descriptive knowledge with source/version tracking.
- Test-order acceptance through the same order service, using isolated test records and allocation.
- Versioned prompts, evaluation fixtures, and sanitized latency, cost, source, validation, and escalation records.

### Interface and behavior requirements

Separate incoming message normalization, conversation processing, and outgoing delivery. Initially implement only the test-chat transport. Avoid a large unused integration framework or mandatory Facebook identifiers in core order logic.

Validate AI output against real product references, required fields, quantities, and deterministic rules. AI cannot verify payment, invent policy, override availability, or bypass authorization. Provider failure preserves the conversation and offers retry or human handling.

### Completion gate

Evaluate English, Filipino, and Taglish, misspellings, ambiguity, and multi-message corrections. Missing details trigger clarification. Prompt injection cannot expose secrets or cross business boundaries. Takeover suppresses automation until explicitly resumed. Freeze scoring and expected answers before measurement, and assess against the adviser-approved target. Test activity never affects real sales or allocation.

## Phase 4 — Promotional Content and Manual Export

**Goal:** produce usable promotional materials without automated Facebook publication.

### Deliverables

- Owner campaign brief and Gemini caption drafts grounded in approved product/offer facts.
- Persistent editing, content versions, and approval of an exact caption/asset version.
- Constrained template editor: curated layouts, product photos, editable text, approved fonts/colors, and controlled positioning/resizing.
- Editable template persistence and flattened 1080 × 1080 image export.
- Copy caption and save/share image for manual posting through device capabilities.
- Distinct draft, approved, and exported states. Any manual-publication record is explicitly owner-reported, with optional post evidence.

### Completion gate

Drafts/templates restore after restart. Caption, image, offer, price, or date changes invalidate approval. Long text, large prices, low-resolution images, and realistic photo sizes are tested on physical Android devices. Export does not imply provider-confirmed publication. Generation failures preserve inputs.

## Phase 5 — Follow-Up Reminders and Simulated Delivery

**Goal:** test deterministic follow-up behavior without claiming live Messenger automation.

### Deliverables

- Owner-approved inactivity, eligible-stage, operating-hour, delay, and stop rules.
- Durable scheduled jobs with due times, states, attempt history, stable retry keys, and abandoned-job recovery.
- Maximum two simulated automated follow-ups per eligible test case.
- Simulated delivery inside test chat and visible due reminders; neither sends real Messenger messages.
- Eligibility recheck immediately before processing. Stop on applicable reply, takeover, opt-out, terminal order state, or count limit.

### Required decisions

Confirm first/second delays, eligible stages, holidays, and whether manual reminders belong in the pilot. Store execution timestamps in UTC with business timezone separately. Live provider eligibility is an additional requirement when Meta is enabled.

### Completion gate

Fixed-clock tests cover due-time boundaries, timezone changes, duplicate execution, and crash recovery. Stop conditions suppress pending work. Retries do not duplicate simulated messages. Test response statistics remain separate from real customer outcomes. Live automated sending stays disabled until access and messaging eligibility are validated.

## Phase 6 — Dashboard and Research Exports

**Goal:** reproduce measurements from capabilities actually available.

### Deliverables

- Operational order counts, completed sales, item performance, customer history, and audit activity.
- Separate AI evaluation and test-chat reports.
- Promotion draft/export activity without interpreting export as reach, engagement, or publication.
- Metric contracts: source, qualifying statuses, timestamps, timezone, formula, exclusions, duplicates, and missing-data handling.
- Pseudonymous research exports with restricted access, documented fields, retention, and transfer procedures.
- Only if adviser-approved: manual collection of external observations with source evidence and collection dates.

### Completion gate

Dashboard/export values match hand-calculated fixtures, including rejections, unclaimed Ready orders, empty periods, and date boundaries. Backend queries exclude test data. Unavailable Meta measures display unavailable rather than zero/sample data. Manual observations remain distinguishable from API data. Freeze metrics and instruments before baseline collection.

## Phase 7 — Meta Decision and Conditional Integration

**Goal:** keep a practical path back to Meta without blocking core delivery.

### Consultation deliverables

- Verify current official requirements for desired Messenger, publishing, follow-up, and insights capabilities.
- Record required access, business assets, account owners, review prerequisites, and feasibility risks.
- Obtain professor direction on retained, revised, or deferred objectives and acceptable manual evidence collection.
- Record the decision, evidence, affected thesis sections, responsible person, and next review point. Do not presume approval.

### If feasible and approved

1. Implement backend-managed Page connection, protected tokens, and connection diagnostics.
2. Add verified webhooks, durable ingestion, deduplication, and business association.
3. Connect eligible replies to the existing conversation processor and implement live takeover.
4. Publish only the current approved version and record provider-confirmed results.
5. Reconcile uncertain outbound outcomes before retrying; do not blindly resend when success is unknown.
6. Enable follow-ups only after checking current provider eligibility and product rules at send time.
7. Add permitted insights with explicit unavailable/partial-data states.

### Completion gate or deferral outcome

Real test-Page flows pass expired-token, duplicate-event, retry, access-control, and connection-failure tests. Live events remain distinguishable from sandbox activity and owner-reported publication. Only verified capabilities enter the release.

If access remains unresolved, retain test chat, manual export, and simulated follow-ups. Keep live controls unavailable and document the limitation. Obtain adviser approval for revised evaluation before starting a revised pilot or claiming thesis completion.

## Phase 8 — Release, Approved Pilot, and Analysis

**Goal:** validate the integrated application and evaluate approved, supported outcomes.

### Deliverables

- Physical Android tests across development/release builds, lower-memory hardware, and slow/interrupted/offline networks.
- Security and business-rule regression tests, backup/restoration rehearsal, and support/incident instructions.
- Partner onboarding, role training, integrated dry run, privacy/consent procedures, and approved data handling.
- Frozen evaluation instruments, baseline/pilot dates, exclusions, and supported measurement methods.
- Study results with missing data, outages, limitations, and confounding factors recorded.

### Completion gate

No critical access, allocation, data-loss, or false-success defects remain. Recovery, ownership, budgets, backups, and support contacts are documented. Functional/AI findings have traceable evidence. Sandbox outcomes are not presented as real Messenger engagement, Facebook reach, or Messenger-attributed sales.

The existing proposed 30-day pre/post design applies only after confirming compatibility with the revised scope. Any change requires adviser approval before data collection.

## Shared Validation and Handoff

- For implementation changes, run relevant `npm run typecheck`, `npm run lint`, and `npm run doctor` checks, plus backend/device tests as appropriate.
- Test authorization, totals, transitions, concurrency, idempotency, AI validation, scheduling, and metric formulas.
- Version database changes as migrations and rehearse in test environments before pilot deployment.
- Keep failures actionable and show success only after authoritative confirmation.
- Retain test case ID, objective, expected/actual result, build, environment/device, tester, date, and sanitized evidence.
- Assign a primary implementer and a different reviewer/tester per milestone.
- Update topic documents and decision records as implementation changes are accepted.
- Do not commit or push without explicit user authorization.

## Outstanding Decisions

| Decision | Needed before |
|---|---|
| Project/account ownership, target devices, budget | Environment deployment |
| Lifecycle, restoration, pickup cutoff, business-date rules | Phase 2 completion |
| AI scoring unit, reference dataset, target | Phase 3 evaluation |
| Layouts, brand assets, photo requirements | Phase 4 completion |
| Follow-up timing, eligibility, holidays, manual reminder scope | Phase 5 activation |
| Metrics, retention, manual evidence collection | Phase 6 completion and baseline |
| Revised Meta scope and thesis objectives | Phase 7 decision and pilot approval |
| Dates, participants, consent, exclusions, success criteria | Phase 8 pilot start |

Record final answers in [Team, Risks, and Decisions](12-team-risks-and-decisions.md). Refer to existing subsystem documents for technical detail. This roadmap supersedes their older sequence wherever it assumes Meta must precede AI; it does not imply professor approval of revised objectives.
