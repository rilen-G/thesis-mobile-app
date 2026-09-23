# Setup

## Run the application

Install Node.js and dependencies with `npm install`. `package-lock.json` is authoritative; inspect `package.json` before choosing compatible Expo packages. Use `npx expo install` for native dependencies.

Create an untracked `.env` in `mobile/`:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_CLIENT_KEY
```

Only public client configuration belongs here. Provider keys, database passwords, and service-role credentials must stay on the backend. Restart Expo after changing environment values.

Run `npm start` for Expo Go or `npm run web` for the browser. A physical phone must reach the backend over the network: `localhost` on the phone refers to the phone itself. A missing backend shows a setup state; the app has no sample-data fallback.

## Database

The existing development project is **Thesis** (`vfrgfhpvwxtraolrcryo`). Confirm the target before any hosted command; do not link to another project merely because it appears in a connected account.

`supabase/migrations/20260921031203_initial_schema.sql` is the consolidated baseline for a fresh database. It includes tables, constraints, indexes, functions, permissions, RLS, and the private `product-photos` bucket. It contains no business accounts, menu items, customers, orders, or uploaded images.

For a **new, empty development project**, inspect the installed CLI help, link the intended project, review `db push --dry-run`, and apply the baseline through the CLI migration workflow. Keep `private` out of the Data API exposed schemas. The app uses public RPC wrappers with privileged implementation functions in `private`.

For the **existing Thesis project**, do not execute the baseline against its existing tables and do not reset the hosted database to clean migration files. Consolidation reconciles migration history after verifying equivalence; application data stays in place. Subsequent schema changes belong in new timestamped migrations created with `supabase migration new <name>`. One baseline is the starting point, not a reason to overwrite deployed schema definitions later.

A full local Supabase stack requires Docker. `supabase db reset --local` rebuilds that local database from migrations and the empty seed file. `--linked` targets the hosted project and is destructive. The lightweight/native database test suites do not require Docker and never use the hosted project.

Auth configuration, Edge Function secrets/deployment, uploaded Storage bytes, and tenant data are separate from the schema migration. A database migration is not a complete project backup.

## Owner, staff, and recovery

1. Configure hosted email confirmation, a minimum eight-character password, and appropriate email delivery. Register and verify the owner, sign in, and create a business.
2. In Settings, enter the business name/address, opening time, pickup cutoff, and explicitly approve the order rules.
3. Register and verify a separate staff account without creating another business. The owner adds its email in Settings; staff refreshes membership or signs in again.
4. Remove staff through Settings when needed. Database membership checks apply immediately even if an access token still exists. Ownership transfer and account deletion require a separate administrative procedure.

Allow the exact recovery callback URLs in Supabase Auth. Development builds use `qfacio://recovery` or `qfacio:///recovery`; Expo Go uses the current device/LAN URL from `Linking.createURL('/recovery')`; web uses its actual origin plus `/recovery`. Open PKCE verification/recovery links on the device/browser that requested them. Expired links or links opened on another device require a fresh request there.

## Product photos and demo data

Photos are stored in the private `product-photos` bucket, with a 5 MB limit and JPEG/PNG/WebP types. Database records store `photo_path`. Paths are immutable `business/product/upload` references; owners upload and business members retrieve short-lived signed URLs. Clients cannot overwrite or delete objects.

Buckstars is a fictional development business. Its menu, prices, categories, FAQs, settings, and quantities are held in Supabase. All twelve AI-generated product photos are stored privately. Source copies for the eight later menu additions are retained under `assets/buckstars/`; the app retrieves their immutable Storage objects through short-lived signed URLs and does not import the local copies. The original local catalog, four photographs, and one-time seed/expansion scripts remain cleanup recovery material. Manage ongoing changes through the app. Initialize operational quantities explicitly for each business date.

Before removing unused hosted uploads, check all database references and allow a grace period for interrupted saves. Never infer that an object is unused merely because an upload request timed out. A schema backup does not back up the image bytes.

## Approved knowledge and AI replies

Open **Settings → Approved knowledge** to maintain FAQs and policies for live Messenger. Existing entries and version history are preserved. The former AI test chat, simulated orders/quantities, and its endpoint are retired by migration `20260922183054_retire_ai_test_chat.sql`. Do not redeploy the old endpoint.

Set `GEMINI_API_KEY` in backend Edge Function secrets. The optional `GEMINI_MODEL` override defaults to `gemini-2.5-flash`; verify account availability before evaluation. Configure and deploy the Messenger functions using the next guide. No provider credentials belong in the mobile app.

## Zapier Messenger setup

Follow [Messenger setup](MESSENGER.md) for the implemented endpoints, exact Zap payloads, connection secrets, recovery schedule, and disabled-by-default verification flow. The steps below remain useful for account preparation; Page publishing is still planned.

No Zapier workflow is implemented by these setup instructions. Follow the [integration plan and capability checks](ROADMAP.md#zapier-integration-plan--2026-09-23) before enabling live controls.

1. Record the team's Zapier account owner, recovery contact, plan/task budget, and workflow maintainer. Use a test Page and consenting test recipients for validation.
2. Connect the intended Facebook Page through Zapier's Facebook Messenger and, if Page publishing is confirmed, Facebook Pages connections. Record the business/Page association and required access; do not add a custom Meta app/token setup as a prerequisite for this planned route.
3. Verify available incoming-message triggers, sending actions, publication/media actions, and result fields in that account. Document unsupported capabilities and keep those controls unavailable.
4. Configure the authenticated Messenger intake, send authorization, and result reporting described in the setup guide before enabling automation. Keep workflow secrets and credential-bearing webhook URLs server-side; redact them from documentation, screenshots, and logs.
5. Complete the [live automation acceptance checks](VALIDATION.md#zapier-live-automation-acceptance-planned), including retries, takeover, edited approvals, connection loss, and quota exhaustion. Record workflow versions and pause/recovery procedures.

Facebook Page insights setup remains undecided and is not a prerequisite for testing messaging or publishing. Agree its source and research coverage separately in Roadmap.

## Android builds

```powershell
npx eas-cli login
npx eas-cli build --platform android --profile preview
```

The `preview` profile in `eas.json` produces an installable APK; `production` is for store output. EAS cloud builds require an Expo account. Test the actual development/release build on the target Android devices before acceptance.

## Maintenance references

Check current official documentation before changing APIs, versions, permissions, models, or pricing:

- [Supabase CLI](https://supabase.com/docs/reference/cli/introduction), [migrations](https://supabase.com/docs/guides/deployment/database-migrations), [Auth for React Native](https://supabase.com/docs/guides/auth/quickstarts/react-native).
- [Storage security](https://supabase.com/docs/guides/storage/security/access-control), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Edge Functions](https://supabase.com/docs/guides/functions).
- [Expo development builds](https://docs.expo.dev/develop/development-builds/introduction/), [Router](https://docs.expo.dev/router/introduction/), [SDK upgrades](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/).
- [Gemini structured output](https://ai.google.dev/gemini-api/docs/structured-output).
