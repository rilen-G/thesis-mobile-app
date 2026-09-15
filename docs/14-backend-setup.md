# Backend Setup and Phase 1–2 Validation

Status as of 2026-09-12: implementation and local database checks are available. No hosted project has been selected or migrated. Hosted authentication/Storage and physical Android acceptance remain outstanding. Do not mark the roadmap gates complete solely from local tests.

## What Is Implemented

- Email/password registration, verification, session restoration, PKCE recovery links, sign-out, and guarded application routes.
- A single business membership per account, with owner and operations-only staff roles. Owners can add an existing verified account as staff and remove staff access.
- Menu, private photo references, customers, settings, daily quantities, orders, item price snapshots, and audit history.
- Database-controlled writes, optimistic record versions, and short transactions serialized per business for allocation correctness.
- A durable local recovery journal for uncertain writes. Retrying reuses the request ID; changed or unrelated writes wait for reconciliation. No queued write runs automatically.
- Loading, error, retry, empty, and unavailable-feature states. No operational sample-data fallback.

## Select and Configure a Development Backend

1. Select a dedicated Supabase development project. Do not reuse an unrelated or pilot project for test migrations. A project reference is still required for hosted deployment.
2. Inspect the installed CLI help (`npx supabase --help`, `npx supabase link --help`, and `npx supabase db push --help`) before linking or deploying. Review and apply every ordered SQL file under `supabase/migrations/` through the project's migration workflow. The `20260914160000_six_order_statuses.sql` migration safely maps any earlier Draft, Preparing, Cancelled, and Unclaimed records into the six supported statuses and installs the revised command path. Do not manually create conflicting tables in Dashboard.
3. Leave `private` out of the Data API exposed schemas. The application uses `public.app_command` and `public.app_snapshot`; privileged implementations remain in `private`. The migration grants authenticated reads and RPC execution explicitly and enables RLS.
4. Copy `.env.example` to `.env` and populate `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Use only the project's public/publishable client key. Restart Expo after configuration changes.
5. In hosted Auth settings, require email confirmation and at least eight password characters. Configure an appropriate email delivery service for the intended users. No email service was provisioned by this implementation.
6. Add the exact account callback URLs to the Auth redirect allowlist. Development builds use the `qfacio` scheme; local config includes `qfacio://recovery` and `qfacio:///recovery`. For Expo Go, add the exact device/LAN URL returned by `Linking.createURL('/recovery')` for that session. Prefer the development build for stable recovery-link testing. For web, add the actual origin plus `/recovery`.
7. Open verification and recovery emails on the same device/browser that requested them; PKCE requires the locally stored verifier. Expired or other-device links require a new request on the target device.

The migration creates the private `product-photos` bucket with a 5 MB limit and JPEG/PNG/WebP MIME restrictions. Photos use immutable `business/product/upload` paths. Owners upload; members of that business can retrieve expiring signed URLs. Client deletion/upsert is intentionally not granted.

## Local Full Supabase Option

`supabase/config.toml` is initialized with PostgreSQL 17, email confirmation, stable app redirects, and an empty seed file. A full local Supabase stack requires Docker, which was not available in the inspected environment. Use CLI help before starting that stack. On a physical phone, a localhost backend URL refers to the phone; configure the host computer's reachable LAN address instead.

The automated isolated database tests below do not require Docker, Auth email delivery, a Supabase project, or provider credentials. They are not a replacement for the full-stack acceptance checks.

## First Owner and Staff

1. Register and verify the owner's email, sign in, and create a business.
2. In Settings, enter the business name, address, opening time, and pickup cutoff, then explicitly confirm the displayed order rules.
3. Register a separate staff account and verify its email. Staff should not create a second business. The owner adds the verified email in Settings; the staff member refreshes membership or signs in again.
4. Remove staff access from the displayed staff list when necessary. Database policies recheck membership on requests, including when the old login session still exists.
5. Ownership transfer and account deletion are administrative procedures outside this release. Do not remove the only owner through manual database edits without a recovery plan.

## Approved Order Rules

The user approved the original fulfillment rules on 2026-09-11 and revised the order statuses on 2026-09-14:

- Same-day pickup in `Asia/Manila` only. There is no future-day or overnight operating schedule in this release.
- Owner-configured opening/cutoff times. Acceptance requires the current time within those hours and pickup today, in the future, and no later than the cutoff.
- New orders begin Confirmed and reserve nothing while awaiting staff acceptance.
- Staff acceptance checks business hours and allocation atomically, then reserves quantity exactly once.
- A cancellation is recorded as Rejected. Rejecting a Confirmed order restores nothing; rejecting an Accepted order restores quantity once when the recorded policy enables restoration.
- Ready orders become Completed only after collection/payment handoff is confirmed. An unclaimed order remains Ready, is not counted as collected/completed, and does not restore quantity.
- The restoration choice is captured at acceptance, so later settings changes do not rewrite an existing order's policy.

Canonical lifecycle:

```text
Confirmed → Accepted → Ready → Completed
Confirmed → Rejected
Confirmed → Expired
Accepted → Rejected
```

Orders retain their original item names and integer-centavo unit prices. Changing menu prices does not alter historical totals. Confirmed pickup/payment/request details can be edited before staff acceptance; item corrections after acceptance require rejection and a new confirmed order in this release. Payment method is recorded information, never payment verification.

Daily allocations store total and used quantity for a product/business date. Remaining is total minus used. The owner initializes each day's quantities with an adjustment reason; a new day has zero available until initialized. Earlier allocation records are retained. Total cannot be reduced below used quantity.

## Validation Commands and Evidence

```powershell
npm run typecheck
npm run lint
npm test
npm run test:postgres
npm run doctor
```

- `npm test`: domain validation/recovery-journal tests and an isolated PGlite PostgreSQL suite. The engine serializes queries; this alone does not demonstrate simultaneous database access.
- `npm run test:postgres`: the same database suite against a disposable native PostgreSQL server with multiple client connections. Covers competing acceptances, rollback, stale versions, retries, tenant isolation, staff restrictions, storage policies, and lifecycle outcomes. It binds only to localhost, uses a generated test password, and does not change a hosted database.
- Native test data stays in `.test-artifacts/postgres-*`, ignored by Git. The test stops its own server when finished. Windows may require permission to run `initdb`; failure is not a passing test. Never point this harness at an existing data directory.
- Auth and Storage tables are minimal test fixtures, not the complete Supabase services. Hosted token, email, upload, signed-URL, and revocation behavior require the checks below.
- The embedded native PostgreSQL package currently supplies PostgreSQL 18; local Supabase is configured for 17. Repeat the suite/acceptance scenarios on the actual development project's version before pilot deployment.

For the no-backend browser smoke check, with no `.env` backend configured, run:

```powershell
npx expo export --platform web --max-workers 2 --output-dir .test-artifacts/build
node tests/serve-build.mjs
```

In another terminal, run `npm run test:browser`. It uses installed Microsoft Edge headlessly and verifies the setup state, signup/recovery navigation, and protected-route redirect. A screenshot is written under `.test-artifacts`. Set `UI_TEST_URL` for a different local preview origin. Stop the preview with Ctrl+C after testing. This is not a hosted sign-in test. Metro and TypeScript exclude `.test-artifacts` so generated PostgreSQL files are not watched as application source.

## Hosted and Physical Android Acceptance Checklist

### Local results recorded 2026-09-12

| Check | Result |
|---|---|
| TypeScript and ESLint | Passed |
| `npm test` | 20 runner tests passed (including the database parent test) |
| Native PostgreSQL suite | 16 runner tests passed, including simultaneous last-item confirmations |
| Expo Doctor | 21/21 checks passed |
| Android and web export | Passed after the SDK patch/configuration updates |
| Headless Edge smoke test | Passed: missing-backend state, signup/recovery navigation, callback screen, protected routes, no runtime errors |
| Hosted Auth/Storage, actual Supabase version, physical Android | Not yet verified |

### Remaining sign-off

- [ ] Configure a dedicated project, apply migrations, and inspect security advisories.
- [ ] Register/verify two unrelated owners and one staff account; verify isolation through actual client requests.
- [ ] Restore a session after app restart, refresh an expired session, sign out, and complete recovery from an email deep link.
- [ ] Create a real menu item/photo, restart the app, and retrieve both. Check picker cancellation, invalid/oversized images, interrupted upload, signed-URL expiry, and replacement.
- [ ] Create/edit/archive a customer; verify purchase history remains intact.
- [ ] Set daily quantity, create/confirm/accept/prepare/complete an order, and compare totals with a manual calculation.
- [ ] Confirm competing last-item orders from two clients and verify only one succeeds.
- [ ] Interrupt a write after the server may have committed, restart, explicitly retry the pending save, and verify exactly one result.
- [ ] Test every allowed/forbidden transition in the six-status lifecycle and the approved rejection/restoration policy, including day boundaries and an unclaimed order that remains Ready.
- [ ] Verify keyboard avoidance, Android back navigation, small-screen readability, and low-memory photo selection on a physical device.
- [ ] Record build, device, tester, expected/actual result, and sanitized evidence for the roadmap gates.
- [ ] Have a reviewer other than the implementer complete the integrated acceptance review.

## Operational Limits and Maintenance

- The initial business snapshot loads the business's records together; owner activity shows the 100 most recent events. Add pagination before expanding beyond the small pilot dataset. Full audit records remain in the database.
- Unreferenced/old photo uploads can remain after an interrupted upload or replacement. Clean them only with an administrator process that checks references and retains a grace period for pending saves; never remove an asset solely because the upload client reported a timeout.
- Idempotency records contain operation payloads and are private. Agree retention for those records and local pending journals with the research/data-handling policy. Do not prune request keys while clients may still retry them.
- Local pending saves can contain customer/order inputs. They are scoped to the signed-in account, are removed after a definitive result, and are never automatically sent on login or reconnection.
- Supabase access tokens may remain valid until expiry after session revocation. Membership removal is checked immediately; validate required revocation behavior on the configured Auth service before the pilot.
- No Meta, Gemini, automated follow-up, promotion publication, or research outcome claims are implemented in Phases 1–2.
