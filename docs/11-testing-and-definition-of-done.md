# Testing and Definition of Done

## Testing Layers

### Unit tests

Use for totals, allocation calculations, transition rules, validators, metric formulas, prompt-output validation, and other deterministic functions.

### Database tests

Use for RLS, membership boundaries, atomic confirmation, concurrent access, idempotency, status transitions, and restoration rules.

### Integration tests

Use for Edge Functions, Storage, Gemini schemas and fallbacks, Meta webhook verification, outbound send decisions, and scheduled jobs.

### Application tests

Use for navigation, forms, session restoration, role visibility, loading and error states, offline recovery, editor gestures, and export.

### End-to-end tests

Cover the small set of thesis-critical paths on real Android devices.

## Priority Scenarios

- Owner and staff permission boundaries.
- Session persistence, expiry, sign-out, and revocation.
- Menu and customer create, update, archive, and validation behavior.
- English, Filipino or Tagalog, and Taglish messages.
- Informal wording, misspellings, emojis, ambiguity, and multi-message corrections.
- Unsupported and payment-related requests.
- AI pause, clarification, and human takeover.
- Two customers confirming the last available item concurrently.
- Every allowed and forbidden order transition.
- Duplicate webhook events and repeated mobile submissions.
- Promotion factual validation and reapproval after editing.
- Template export quality and memory use.
- Publication and follow-up retries.
- Slow, intermittent, and unavailable networks.
- Dashboard values against hand-calculated fixtures.
- Private asset and cross-business access denial.
- Anonymized research export and retention-policy dry run.

## Target Device Matrix

At minimum, include:

- the lower-memory Android 12 device identified for the study;
- the Android 14 device identified for the study;
- development and release builds;
- Wi-Fi, slow connection, interrupted connection, and offline recovery.

Record the actual device models, memory, screen sizes, and OS patch levels before formal testing.

## Definition of Done

A feature is done when:

- its written acceptance criteria work in the integrated application;
- applicable loading, empty, validation, offline, retry, and failure states exist;
- backend code validates client and AI input;
- authorization and RLS have positive and negative tests;
- duplicate and retry behavior has been considered for important writes;
- database changes are migrations;
- secrets and unnecessary personal data are absent from code and logs;
- accessibility basics and target-device behavior have been checked;
- relevant automated or documented tests pass;
- documentation and thesis-objective traceability are updated;
- someone other than the implementer has reviewed and tested it.

## Pilot-Readiness Gate

Do not begin the partner pilot with unresolved critical defects involving:

- unauthorized access;
- cross-business data leakage;
- double allocation or corrupted totals;
- duplicate messages or posts;
- loss of orders or customer messages;
- exposed credentials or unnecessary personal data;
- false payment claims;
- unusable behavior on the target devices.

Also confirm:

- production ownership and recovery accounts;
- privacy notice and consent procedures;
- backup, restoration, incident, and support contacts;
- Meta permission readiness;
- Gemini and Meta budgets and usage alerts;
- final metric definitions and frozen evaluation instruments;
- partner training and dry run;
- pilot start, end, and exclusion rules.

## Test Evidence

For thesis-critical tests, retain a case ID, objective, input or fixture, expected result, actual result, build identifier, device or environment, tester, date, and sanitized evidence. Never include access tokens or unnecessary participant data in screenshots.

