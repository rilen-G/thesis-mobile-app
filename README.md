# Thesis Foodservice App

Android-first Expo / React Native application for **Development of AI-Agentic Digital Marketing and Chat-Based App for Philippine Micro and Small Foodservice Establishments**.

The working name is temporary. **BuckStar** is the research test business, not the app name.

## Current application

Supabase authentication, owner/staff membership, menu/categories and private photos, customers, manual orders, daily quantities, audit history, recovery of uncertain saves, and owner-approved business knowledge are implemented. Confirmed orders reserve nothing; staff acceptance checks and allocates stock atomically.

Direct Meta Messenger integration, the chatbot, follow-ups, Apify imports, query-specific RAG, promotional generation, template editing and export are **deferred**. Their screens show unavailable states. The retained grounding helper is a tested foundation, not a running AI service.

Future content will be copied or exported for manual Facebook posting. Automatic Page publishing is excluded. Graphics must preserve actual owner-uploaded food photos.

## Start and checks

Read [the project guide](docs/README.md), then [Setup](docs/SETUP.md). Use npm; package-lock.json is authoritative.

~~~powershell
npm ci
npm start
npm run typecheck
npm run lint
npm test
npm run test:postgres
npm run doctor
~~~

Migrations are a **fresh-install baseline**, not an upgrade for the previous deployment. This cleanup does not provision/reset a hosted project or retire deployed services. See Setup for the later cutover.

Continue in the existing GitHub repository with ordinary commits/pushes when instructed. No new repository, history rewrite or force-push is planned. Earlier commits remain in history.
