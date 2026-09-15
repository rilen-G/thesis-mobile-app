# Team, Risks, and Decisions

## Suggested Responsibility Areas

- Coordination, requirements, and architecture.
- React Native and Expo UI, including the template maker.
- Supabase database, RLS, Storage, migrations, and Edge Functions.
- Gemini, RAG, and Meta integration.
- Testing, research instruments, pilot records, and SO1 through SO10 analysis.

Each major feature should have a primary implementer and a different reviewer or tester. At least two members should understand repository operation, Supabase administration, Meta configuration, deployment, and incident recovery.

## Collaboration Rules

- Break work into small, reviewable changes.
- Write acceptance criteria before implementation.
- Keep main stable.
- Use short feature branches if the team adopts a branch workflow.
- Do not share credentials through Git or screenshots.
- Record database changes as migrations.
- Demonstrate features on an integrated build, not only an isolated screen.
- Ask for help early when work touches another member’s subsystem.

The user controls commits and pushes in this repository. AI tools must wait for explicit instruction before either action.

## Risk Register

| Risk | Early mitigation |
|---|---|
| Meta review or verification delay | Build a permission checklist and review demo early; keep a manual or simulated test path. |
| AI accuracy below target | Freeze a representative evaluation set and test prompts and models incrementally. |
| Incorrect promotional claims | Ground in current business data, validate claims, and require owner approval. |
| Concurrent confirmations oversell | Use an atomic database function and concurrency tests. |
| Duplicate replies, follow-ups, or posts | Store idempotency keys and test retries. |
| Exposed secrets or weak RLS | Keep secrets server-side and test with separate business accounts. |
| Template export crashes | Spike export early and test realistic assets on low-memory hardware. |
| Expo package incompatibility | Prefer Expo-supported packages and validate development and release builds. |
| Poor connectivity | Design retries, offline states, and safe resumption. |
| Irreproducible metrics | Approve written metric contracts and test against fixed fixtures. |
| Scope growth | Trace every feature to a thesis objective and defer extras. |
| Knowledge concentrated in one member | Pair reviews and maintain deployment and incident runbooks. |

## Decisions the Group Must Resolve

1. Final application name, Android package identifier, icon, and signing-key ownership.
2. Exact staff permissions beyond basic order handling.
3. Exact delay and schedule for the second follow-up.
4. Exact condition that creates an eligible follow-up case.
5. SO3 scoring unit: field, message, or exact complete order.
6. Promotion-attribution window and dashboard formulas.
7. Operating hours, pickup cutoff, and late-order behavior.
8. Approved fonts, colors, layouts, logo rules, and photo requirements.
9. Ownership of development, test, and pilot Supabase projects.
10. Ownership and recovery access for the Meta app, Facebook Page, Gemini project, and billing.
11. Monthly service budget, quotas, and alerts.
12. Final privacy notice, research export process, retention period, and deletion trigger.
13. Calendar for development, dry run, pre-period, pilot or post-period, and analysis.
14. Whether allocation means physical inventory, a promotion sales cap, or two separate values.
15. Whether the team needs a develop branch or can work with short branches from main.

## Decision Record Template

### Order and Access Decisions — 2026-09-11

- User-approved implementation rules (revised 2026-09-14): same-day pickup in Asia/Manila; owner-configured opening/cutoff times; new orders start Confirmed; staff acceptance reserves quantity; cancellations are recorded as Rejected; eligible rejection after acceptance restores quantity exactly once; unclaimed orders remain Ready and are not counted as collected or completed. The complete persisted status set is Confirmed, Accepted, Ready, Completed, Rejected, and Expired.
- Daily allocation means sellable quantity rather than a promotion-only cap. Keep historical business dates.
- Staff have order operations and necessary customer access; owners manage menu, settings, team membership, and owner reporting.
- These decisions are reflected in the Phase 1–2 implementation and [backend setup guide](14-backend-setup.md). Adviser approval of revised thesis objectives and live Meta feasibility is still pending.

### Template

For each resolved question, record:

- decision;
- date;
- participants;
- reason;
- alternatives considered;
- affected documents, schema, or code;
- when the decision should be reviewed.

Do not bury final decisions only in chat history.

