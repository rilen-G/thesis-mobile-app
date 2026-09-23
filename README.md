# Q&Facio mobile

Android-first Expo / React Native application for the thesis **Development of AI-Agentic Digital Marketing and Chat-Based App for Philippine Micro and Small Foodservice Establishments**.

The app supports Supabase authentication, business membership, menu and private photos, customers, manual orders, daily quantities, owner-managed approved knowledge, and a disabled-by-default live Messenger integration through Zapier. Gemini runs on the backend. Messenger requires backend deployment, Zap configuration, and Page verification; see [Messenger setup](docs/MESSENGER.md). Automated publishing, promotional export, and timed follow-ups remain planned work.

## Start here

1. Run `npm install` from this directory.
2. Configure `.env` and your backend using [Setup](docs/SETUP.md).
3. Run `npm start`, then scan the QR code with Expo Go on the same Wi-Fi network.

Use `npm run web` for a browser preview. If LAN discovery fails, use `npx expo start --go --tunnel`; use `--clear` for a stale Metro cache. Native libraries outside Expo Go require `npm run start:dev-client` and a development build.

## Documentation

- [Setup](docs/SETUP.md): environment, database, accounts, AI configuration, and builds.
- [Architecture](docs/ARCHITECTURE.md): code layout, permissions, order rules, and chat behavior.
- [Roadmap](docs/ROADMAP.md): current scope, remaining work, and decisions.
- [Validation](docs/VALIDATION.md): test commands, recorded evidence, and research gates.

Business records belong in Supabase Database; product images belong in private Supabase Storage. The repository contains application code, one initial schema migration, and purposeful tests. Buckstars is fictional hosted demonstration data, not bundled application content.

## Checks

```powershell
npm run typecheck
npm run lint
npm test
npm run test:postgres
npm run doctor
```

Database tests use disposable local databases. Hosted checks and AI evaluations are separate, explicit commands documented in [Validation](docs/VALIDATION.md). Commits and pushes require the repository owner's instruction.
