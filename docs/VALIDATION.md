# Validation and research

## Repository checks — 2026-09-26

The consolidated schema and subsequent migrations applied to isolated PostgreSQL. `npm test` passed 49 checks; the native operational and Messenger PostgreSQL suites passed 18 and 12 checks. TypeScript, lint, and `git diff --check` passed. Hosted migration application and physical Android acceptance were not part of these checks.

## Messenger installation — 2026-09-23

- Applied both migrations to the linked Thesis project. Verified five Messenger tables with RLS and all six knowledge entries and history entries preserved.
- Deployed the three Messenger functions. No Page connection is provisioned or enabled; Zapier setup and real-message acceptance are still required.
- Shared grounding remains under `_shared`; knowledge management is in Settings.
- TypeScript, lint, 49 regression checks, 18 native operational PostgreSQL checks, 12 native Messenger PostgreSQL checks, Edge Function type checks, web export, and the mocked browser flow passed. Browser coverage includes missing-schema/retry states, knowledge creation and preservation, takeover, failed-reply preservation, and staff restrictions. Physical Android testing remains outstanding.
- Security advisors reported existing project-level warnings for public `rls_auto_enable()` execute privileges and disabled leaked-password protection. These are outside this feature change and were not modified.

## Routine checks

Run from `mobile/`:

```powershell
npm run typecheck
npm run lint
npm test
npm run test:postgres
npm run doctor
```

`npm test` covers domain rules, menu filtering, grounded reply validation, recovery journals, and PGlite database checks. `npm run test:postgres` runs the database suite with multiple connections to disposable native PostgreSQL on localhost; it tests simultaneous last-item acceptance, rollback, lifecycle, versions, tenant/role boundaries, and idempotency. Test data remains under ignored `.test-artifacts/`; the harness stops its own server. Windows may require permission to start `initdb`.

Both database harnesses supply minimal Auth/Storage stubs. They do not replace real email, token, upload, or signed-URL checks. The bundled native engine is PostgreSQL 18 while local Supabase targets 17; repeat critical hosted checks on the actual project's version. The baseline tests also simulate broad platform default grants to catch accidental permission exposure.

Use `npx deno check supabase/functions/messenger-worker/index.ts` for Edge Function type validation. For builds, `npx expo export --platform web` and `npx expo export --platform android` validate bundling; neither is physical-device acceptance.

## Browser and hosted checks

For the **missing-backend** browser test, use a workspace without configured backend environment values, export web to `.test-artifacts/build`, run `node tests/serve-build.mjs`, then `npm run test:browser` in another terminal. It uses headless Microsoft Edge and checks setup/auth navigation and protected routes. `UI_TEST_URL` overrides the preview origin. Stop the preview when finished.

`scripts/verify-hosted-menu-categories.sql` tests persistence, invalid-category rollback, clearing, safe replay after later edits, and generated product IDs. Run through `supabase db query --linked --file scripts/verify-hosted-menu-categories.sql` after checking the linked project and CLI help. Its temporary writes roll back.

## Recorded evidence and limits

### Repository consolidation — 2026-09-21

Eight local migrations were consolidated into `20260921031203_initial_schema.sql`. A disposable PostgreSQL rebuild matched the original local schema and Storage policies; PostgreSQL normalized equivalent parentheses in one category constraint. The single baseline passed 33 local tests and 18 native PostgreSQL runner checks, including broad platform default grants, tenant isolation, and concurrent acceptance. TypeScript passed; lint retained the two existing unused-import warnings. Expo Doctor passed 20/21 checks, reporting existing patch-version mismatches for Expo, Constants, Image Picker, and Router. Documentation link checks passed and the hosted migration push dry run reported no pending changes.

The hosted change updated migration history only. Before/after comparisons confirmed unchanged function definitions, columns, constraints, RLS policies, grants, and row checksums across 23 application/Auth/Storage tables. Local and remote history both contain the baseline version. All four Buckstars photos were downloaded through signed URLs and SHA-256 matched against their local originals before removal.

The baseline represents the repository's consolidated schema, not a complete clone of platform-managed objects. Existing hosted differences were preserved: an internal legacy command body contains older order branches (the current `command_v2` wrapper intercepts those operations), inherited public RPC grants differ from the baseline's explicit restrictions, and the hosted `rls_auto_enable()` function is platform-specific. No application functions or hosted access settings were replaced during cleanup.

Recovery material is outside the Git repository at `../.cleanup-backups/20260921/`: `before-cleanup.zip` contains the original docs, migrations, setup scripts, and assets; `buckstars-originals/` retains the images/catalog directly. Hosted history/schema snapshots and `restore-history.sql` preserve the former migration bookkeeping. These are cleanup recovery materials, not a full database/Storage backup. Restore the old files and matching history together only after reviewing any subsequent migrations; the history restore guard rejects later versions.

### Earlier implementation evidence

These are dated engineering observations, not current research sign-off:

| Date | Evidence |
|---|---|
| 2026-09-12 | Phase 1–2 local unit/database checks, native concurrency tests, web/Android exports, and missing-backend browser smoke passed; hosted/device acceptance was incomplete then |
| 2026-09-21 | Business-defined menu categories deployed; recorded 33 local tests and 18 native PostgreSQL runner checks passed, with hosted category assertions rolled back |

Previously recorded project warnings concern public execution of `public.rls_auto_enable()` and disabled leaked-password protection. Existing lint warnings concern two unused imports; Expo Doctor previously reported four Expo patch-version mismatches. Recheck these before pilot release; cleanup alone is not resolution. Physical Android acceptance and an independent reviewer remain outstanding.

## Acceptance before release

- Verify unrelated owners and staff through real Auth/client requests, session restart/expiry/sign-out, removal, and recovery links.
- Create/edit/archive customers; preserve order history. Upload/retrieve/replace photos; test cancellation, invalid size/type, interrupted uploads, and signed-URL expiry.
- Exercise every permitted/forbidden order transition, manual totals, competing last-item requests, rejection/restoration, business-date/hour boundaries, and unclaimed Ready orders.
- Exercise offline/reconnect and lost-response recovery with no automatic resubmission, double order, or duplicate quantity change.
- Complete adviser-approved AI language/safety cases, summary confirmation, source changes, owner takeover, and quota-error checks.
- Test Android 12 lower-memory and Android 14 target devices, recording actual models, RAM, screen size, OS patch, development/release build, keyboard/back behavior, accessibility, image memory use, and slow/interrupted networks.
- For future features, verify edit/reapproval, template export, scheduling eligibility/retries, provider delivery, and metric/export formulas before enabling them.
- Complete independent review, partner dry run, consent/privacy, service/account ownership, budgets, backup/restore rehearsal, support contacts, approved instruments, and collection dates.

Retain case ID, objective, fixture/input, expected/actual result, build, environment/device, tester, date, and sanitized evidence. No critical access, allocation, data-loss, false-payment, or false-success defect may remain before a pilot.

## Messenger implementation checks — 2026-09-23

- Local regression suites passed across domain, menu, grounding, operational database, and Messenger flows.
- `npm run test:postgres`: 18 passing checks on a disposable real PostgreSQL instance, including existing allocation concurrency tests with Messenger triggers installed.
- `npm run test:messenger:postgres`: Messenger tests run against a disposable real PostgreSQL instance, covering role isolation, probe gating, duplicates, stale workers, coded confirmations, takeover, unknown outcomes, concurrent authorization, changed/expired summaries, and expired hook recovery.
- App TypeScript, lint, and web export passed. Deno checked all three Messenger Edge Functions. Two runtime tests passed for connection-secret authentication and bounded JSON input.
- `tests/browser-messenger.mjs` passed with fully mocked Auth/REST: owner inbox, takeover, preserved text after failure, successful queued reply, staff restriction, no browser runtime errors. Screenshot: `.test-artifacts/messenger-inbox.png`. This is not a real Facebook or hosted database test.
- Still required: hosted migration/function deployment, actual Zap field verification and both-direction Page test, Vault/Cron recovery check, and physical Android acceptance. Live automation remains disabled by default. Publishing and timed follow-ups are not part of this release.

## Zapier live automation acceptance (planned)

These are future acceptance gates, not evidence of implemented or working Zaps. Test against the intended Page/account and record workflow version, plan, Page association, sanitized run references, timestamps, and actual outcomes.

- Prove an incoming Messenger message reaches the correct business, receives a grounded reply, and cannot create duplicate messages/orders on event replay. Verify the live intake path does not use isolated test records.
- Reject forged handoffs and cross-business/Page substitutions. Verify takeover suppresses pending automation and that ineligible/opted-out recipients receive no automated follow-ups.
- Verify the two-follow-up cap and eligibility checks under delayed jobs, replies, concurrent attempts, and Zap retries.
- For the confirmed publishing destination, publish only the owner's exact approved version; editing or withdrawing approval before dispatch must prevent publication. Verify the actual post/message and available provider identifier.
- Exercise a paused Zap, revoked Page access, exhausted task quota, provider failure, and a lost acknowledgement after external success. Do not label queued work as delivered or automatically replay unknown outcomes without reconciliation.
- Verify media access lasts through the approved publication attempt without exposing unrelated private uploads. Check pause/recovery instructions and restricted access to customer data in Zap history.

## Research measures

These targets come from the planning documents and must be reconciled with the final adviser-approved manuscript:

| Objective | Planned target |
|---|---|
| SO1 customer records; SO2 menu records | At least 95% functional-test pass rate each |
| SO3 order extraction | At least 95% accuracy under an agreed scoring method |
| SO4 dashboard | Functional and user evaluation |
| SO5 promotional drafts | Mean rubric score at least 4/5 |
| SO6 follow-ups | Complete functional workflow |
| SO7 usability | SUS at least 68; usefulness/acceptability mean at least 4/5 |
| SO8 marketing | Views +10%, chats +15%, views-to-chat conversion +15% |
| SO9 sales | Completed Messenger-order food sales +15% |
| SO10 follow-ups | Response rate +13% |

Freeze each metric's numerator/denominator, qualifying statuses, source/events, timestamp, timezone, period, exclusions, missing/duplicate handling, and attribution rule. Candidate measures include inquiries, confirmed/accepted/completed orders, rejected/expired orders, unclaimed Ready orders, item quantity/revenue, permitted reach/views, attributed chats, conversion, and eligible follow-up cases/messages/replies. Staff sees only role-appropriate measures.

SO3 must define field-, message-, or complete-order scoring, required fields, partial credit, corrections, ambiguity, and unsupported requests before testing. Promotion attribution needs source evidence, a fixed window, organic/multiple-promotion treatment, timezone boundaries, and duplicate handling; use aggregate methods with stated limits if user-level evidence is unavailable.

The Facebook Page insights source remains undecided. Before collection, map each SO4/SO8 external measure to a verified Zapier result, an owner-supplied export/manual observation, or another adviser-approved source. Record metric definition, Page/post scope, available history, collection frequency, and evidence. A successful Zap run is not reach, views, or conversion evidence. If a required measure cannot be collected, obtain an approved instrument/objective revision rather than inventing a substitute.

Exclude test records from operational/research outcomes. Never treat exports as publication, simulations as delivered messages, unavailable external metrics as zero, or manual observations as API results. Test formulas against hand-calculated fixtures and pseudonymize restricted research exports with documented access, transfer, retention, and deletion.

The proposed study is one partner business with a 30-day pre/post design and no control group. Obtain approval for changes before collection. Report observed associations with limitations, recording holidays/closures, hours/prices/menu/stock changes, other promotions, outages, weather/seasonality, staffing, and incomplete measurement days. Engineering test results do not establish causal marketing or sales gains.
