# Implementation Roadmap

## Delivery Principle

Build vertical slices. Each slice should include the screen, validation, database or API behavior, authorization, errors, and tests. Avoid completing every screen with mock data before connecting core workflows.

## Recommended Order

1. Audit the repository and preserve the working app.
2. Establish the Expo development build and target devices.
3. Consolidate design tokens and a small reusable component set.
4. Implement Supabase authentication, business membership, roles, and RLS.
5. Implement menu, product photos, availability, and customer records.
6. Complete the manual order workflow with atomic allocation.
7. Add Meta webhooks, reply sending, deduplication, and human takeover.
8. Add Gemini classification and structured order extraction.
9. Add grounded FAQ and promotional caption generation.
10. Build template editing, version approval, scheduling, and publication.
11. Add follow-up scheduling and stop conditions.
12. Build dashboard metrics, action history, and research export.
13. Perform security, device, connectivity, usability, and end-to-end testing.
14. Conduct a dry run, partner training, the 30-day pilot, and analysis.

## Milestone 0: Foundations

Exit conditions:

- development build installs on target Android devices;
- routing and design primitives work;
- local environment instructions are documented;
- secret handling is defined;
- database migration workflow is established.

## Milestone 1: Authenticated Business Data

Exit conditions:

- session persists and can be revoked;
- owner and staff memberships resolve correctly;
- owners can create and update menu records;
- staff restrictions are enforced by RLS;
- private photos upload and reload securely.

## Milestone 2: Manual Orders

Exit conditions:

- staff can create and manage an order without AI;
- status transitions are controlled;
- concurrent confirmation cannot oversell;
- retries are idempotent;
- history and totals are correct.

## Milestone 3: Messenger

Exit conditions:

- Page connection is secure;
- webhook validation and deduplication work;
- inbound and outbound messages are stored safely;
- eligibility and human takeover are visible;
- test conversations do not produce duplicate replies.

## Milestone 4: AI and RAG

Exit conditions:

- structured output is schema-valid and business-validated;
- FAQ answers use isolated approved sources;
- ambiguous requests escalate or clarify;
- evaluation fixtures meet the agreed threshold;
- model cost, latency, and failure behavior are measured.

## Milestone 5: Marketing Workflow

Exit conditions:

- content generation produces reviewable drafts;
- edits invalidate approval;
- template export works on target devices;
- publish retries cannot create duplicate posts;
- scheduled follow-ups stop correctly.

## Milestone 6: Evaluation and Pilot

Exit conditions:

- dashboard formulas match hand-calculated fixtures;
- research export is anonymized as planned;
- critical security and reliability tests pass;
- partner training and support procedures exist;
- pre-period and pilot dates are frozen.

## First Two Weeks

### Week 1

- Inventory the existing mobile code and web design reference.
- Agree on screen mapping and design tokens.
- Install a development build on the target phones.
- Create development and test environment conventions.
- Draft the membership, product, and storage schema.
- Define owner and staff permissions.

### Week 2

- Implement sign-in and session restoration.
- Resolve the signed-in user’s business and role.
- Display a real menu list.
- Create one product with a private photo.
- Add loading, empty, validation, offline, and server-error states.
- Demonstrate that an unauthorized account cannot edit the record.

## First Vertical Slice Acceptance

The initial slice is complete when it works after an app restart on the target devices, persists a real record and photo, enforces RLS against a second account, and communicates all major UI states. Reuse this established pattern for customers, allocations, orders, and promotions.

