# Validation and research acceptance

## Engineering checks

~~~powershell
npm run typecheck
npm run lint
npm test
npm run test:postgres
npm run doctor
~~~

npm test covers domain parsing, recovery journals, menu behavior, the pure grounding helper and isolated PGlite database tests. The PostgreSQL command repeats database regressions on a disposable real server, including competing allocations. tests/migration-smoke.mjs separately verifies fresh migration application.

Tests cover two-business isolation, owner/staff permissions, private photos, knowledge history, optimistic versions, idempotency, no allocation at confirmation, atomic acceptance, overselling prevention, permitted restoration exactly once, immutable item snapshots and unclaimed Ready orders.

Grounding fixtures prove neither model quality nor live Messenger behavior. The current suite requires no external AI provider.

## Browser and Android

Export the web app, serve it locally and run npm run test:browser. UI_TEST_URL defaults to http://localhost:8083; the harness needs installed Edge/Playwright support. Use placeholder backend configuration for setup-state smoke tests.

Physical Android acceptance is required for the new name/deep-link scheme, recovery, back navigation, keyboards, safe areas, text scaling, photo loading/picking and offline behavior. Test a lower-memory phone. Browser success does not establish Android acceptance.

## Cleanup evidence — 2026-10-04

The cleanup retains a fresh-install operations schema and documents deferred features. Verified locally:

- Typecheck and lint passed.
- npm test passed all 48 tests, including isolated database and grounding regressions.
- npm run test:postgres passed all 18 reported tests, including the database suite and its 17 subtests; the disposable server was stopped before the runner exited.
- Expo Doctor passed all 21 checks after SDK 57 patch versions were aligned.
- Web export built 45 routes using placeholder backend configuration.
- Browser smoke passed setup-state, signup/recovery navigation, protected-route and runtime-error checks.
- Current source/configuration/documentation scans and git diff --check passed.

No physical Android device was connected; native recovery, the new scheme and device acceptance remain unverified. Browser smoke did not exercise an authenticated hosted business.

No hosted reset, project creation, function retirement, account-role change, real message send or paid provider operation is included. Previous deployment results do not establish acceptance of this baseline.

## Future acceptance gates

- Meta: actual tester receipt/reply, valid signatures, duplicate/older events, takeover, revoked tokens and unknown-send recovery.
- Follow-ups: fixed-clock eligibility/cancellation, 30-minute first reminder, second 2 hours after acceptance, two-message cap and response window.
- RAG: relevant approved current sources, business/collection isolation, no-match and injection handling, invalidation before send.
- Curation: permitted collection, bounded costs/results, provenance, duplicate/partial-run recovery and approval.
- Content: authentic photos, editable accurate graphics, invalidated approvals and manual copy/export on Android.
- Database: run future vector migrations on actual pgvector; do not silently skip unsupported extension tests.

## Research limits

Researchers act as BuckStar customers during development. Label their chats, orders and measurements as internal tests. They are not real sales or evidence of marketing impact.

Formal participants, budgets, consent, retention/deletion, instruments and dates require team/adviser decisions. The earlier thirty-day pre/post concept and targets remain proposals, not approval for this development setup.

| Objective | Proposed measure requiring confirmation |
|---|---|
| SO3 extraction | Define field/message/order scoring, reference answers and error handling |
| SO5 promotional drafts | Mean rubric score at least 4/5 |
| SO6 follow-ups | Complete functional workflow |
| SO7 usability | SUS at least 68; usefulness/acceptability mean at least 4/5 |
| SO8 marketing | Views +10%, chats +15%, views-to-chat conversion +15% |
| SO9 sales | Completed Messenger-order food sales +15% |
| SO10 follow-ups | Response rate +13% |

Freeze numerators/denominators, periods, timezone, qualifying statuses, attribution and missing-data treatment. Page insights need a verified permitted source. Unavailable is not zero; reaction counts are not reach; exports are not publication; provider acceptance is not delivery.

Keep development fixtures separate from frozen evaluation cases. Evaluate English, Filipino and Taglish and record groundedness, source/model/prompt versions, latency and cost. Pseudonymize exports. Engineering success does not establish causal marketing gains or final thesis acceptance.
