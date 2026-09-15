# App Natin

React Native + Expo application for Q&Facio kitchen operations. Phases 1–2 now have Supabase-backed authentication, business membership, private menu photos, customers, settings, and manual orders with atomic daily allocation. Configure a dedicated development backend before use; the app does not fall back to sample records.

The native UI follows the sibling `mockup/` frontend as its visual source of truth while retaining the Supabase-backed behavior and native loading/error states.

Follow [Backend Setup and Phase 1–2 Validation](docs/14-backend-setup.md) for migrations, account recovery, roles, and the remaining hosted/device acceptance checks. Meta, AI, promotions, and research analytics are explicitly unavailable in this release.

## Read docs
Make sure to read the Markdown files inside docs to understand the context of the project requirements and architecture. Feel free to change the contents if an error is found.

## Run with Expo Go

1. Install the current Expo Go app on the phone.
2. Connect the computer and phone to the same Wi-Fi network.
3. From this `mobile` directory, run:

   ```powershell
   npm install
   npm start
   ```

4. Scan the QR code with Expo Go on Android or the Camera app on iOS.

`npm start` explicitly starts the Expo Go workflow. Local Expo Go development does not require matching Expo CLI and Expo Go account sessions. An Expo account is required for EAS cloud builds.

If LAN discovery is blocked by the network, run `npx expo start --go --tunnel` instead. If Metro has stale files, run `npx expo start --go --clear`.

## Other development commands

```powershell
npm run typecheck
npm run lint
npm run web
npm run start:dev-client
```

The development-client command is only needed after adding native libraries that Expo Go does not include.

## Build an Android APK

The `preview` profile in `eas.json` is configured to produce an installable APK:

```powershell
npx eas-cli login
npx eas-cli build --platform android --profile preview
```

Use the `production` profile for store-ready Android output. iOS builds use the same project but produce an iOS build rather than an APK.

## Implemented workflows

- Registration, email verification, sign-in, session restoration, recovery, and sign-out.
- Business creation and owner-managed staff membership.
- Menu editing, private gallery photo upload, availability, and daily quantity adjustments.
- Customer creation/editing/archiving and order history.
- Manual confirmed orders, immutable price snapshots, the six-status order lifecycle, and exactly-once quantity reservation/restoration on staff acceptance and eligible rejection.
- Owner activity history, business hours, approved order rules, and saved post-format preference.
- Durable recovery of uncertain saves with an explicit retry; no automatic offline sending.

## Automated checks

```powershell
npm run typecheck
npm run lint
npm test
npm run test:postgres
npm run doctor
```

The PostgreSQL suite starts an isolated localhost database under `.test-artifacts` and never uses a hosted project. See the setup guide for test limitations and browser/device checks.
