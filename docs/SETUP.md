# Setup

## Local app

Use npm and the authoritative package-lock.json:

~~~powershell
npm ci
npm start
~~~

Use npm run web for browser development and npx expo install for native dependencies.

Copy .env.example to an untracked .env:

~~~dotenv
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_CLIENT_KEY
~~~

Restart Expo after changing values. Missing configuration shows a setup state; no sample-data fallback exists. A phone must reach the backend over the network; localhost on the phone means the phone itself.

No Gemini, Meta or Apify secret is required by the current app. Future provider secrets belong on the backend.

## Fresh database baseline

The retained migrations create business operations, private product storage and approved-knowledge editing. They exclude conversation transport, sending jobs, follow-up schedules, embeddings and content-generation tables.

**Apply this chain only to a fresh Supabase database.** It is not an incremental upgrade for the previous deployment. Do not apply it to an existing application schema, alter hosted migration history to make it fit, or reset a hosted database to silence differences.

For local Supabase, inspect current CLI help before local start/reset commands; its container runtime is required. npm test uses disposable local PGlite databases without a hosted project.

Later hosted cutover:

1. Provision the fresh research project after confirming organization, cost and ownership.
2. Explicitly verify the target. Existing ignored CLI link metadata and .env may still point at the earlier deployment.
3. Apply the baseline to the empty target; verify RLS with two business accounts.
4. Create new owner/staff accounts and BuckStar through the app. Enter verified menu facts and owner photos; do not import past conversations or generated demonstration photos.
5. Configure recovery URLs, update public configuration and sign in again. Auth/journals are separated by backend.
6. Before new Messenger testing, retire earlier webhook subscriptions, deployed handlers, schedules and credentials through a separately authorized cutover. Deleting source files does not stop hosted jobs.

Keep the original hosted environment intact until the replacement is verified. Database backups do not include Storage image bytes.

## Accounts and recovery

Register and verify an owner, then create the business. Staff register separately without creating another business; the owner adds their verified email in Settings. Membership removal blocks subsequent database access.

Allow exact Auth recovery callbacks: thesisfoodservice://recovery and thesisfoodservice:///recovery for native builds, the actual web origin plus /recovery, and the current Expo Go URL produced by Linking.createURL('/recovery'). PKCE links must open on the requesting device/browser.

The new auth namespace may require sign-in again. Reconcile uncertain old saves in their original environment before switching; do not transfer journals.

## Photos and knowledge

The private product-photos bucket accepts JPEG/PNG/WebP up to 5 MB. Current menu uploads create resized JPEGs at immutable business/product/upload paths. Owners upload actual food photos; members receive temporary signed URLs. Clients cannot overwrite/delete objects.

Manage FAQs under Settings → Approved knowledge. Approval prepares entries for future retrieval; it does not activate AI replies.

## Android

The preview profile in eas.json produces an internal APK. Inspect EAS CLI help and account/project ownership before starting a cloud build. Renaming the app/deep-link scheme requires a new native build to validate.

Test account recovery, back navigation, keyboards/safe areas, private photos and poor connectivity on a lower-memory physical Android phone. Browser checks are supplemental.

[Supabase migrations](https://supabase.com/docs/guides/deployment/database-migrations), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Storage security](https://supabase.com/docs/guides/storage/security/access-control), [Expo development builds](https://docs.expo.dev/develop/development-builds/introduction/).
