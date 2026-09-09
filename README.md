# App Natin

React Native + Expo translation of the Q&Facio owner mockup. The current app is a frontend prototype: its sample data and edits live in memory and reset when the app reloads.

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

## Implemented frontend

- Sign-in and sign-up mode
- Owner dashboard and KPI analytics
- Orders, filters, status actions, and editable order details
- Customer search, segments, profiles, and purchase history
- Menu search, item creation/editing, availability, and allocation controls
- Promotion schedule, drafts, details, edit states, and approval/retry actions
- Activity timeline
- Settings and default post format
