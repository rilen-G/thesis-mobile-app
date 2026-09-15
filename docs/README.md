# Project Documentation

This directory is the working implementation guide for the mobile repository. It replaces the former single-file handoff with smaller documents that can be opened independently.

## Suggested Reading Order

1. [Product Scope](01-product-scope.md)
2. [Repository and Migration](02-repository-and-migration.md)
3. [System Architecture and Security](03-system-architecture-and-security.md)
4. [Mobile Application Structure](04-mobile-application-structure.md)
5. [Database, Orders, and Allocation](05-database-orders-and-allocation.md)
6. [Meta and Messenger](06-meta-messenger.md)
7. [Gemini and RAG](07-gemini-and-rag.md)
8. [Promotions, Templates, and Follow-ups](08-promotions-templates-and-followups.md)
9. [Dashboard and Evaluation](09-dashboard-and-evaluation.md)
10. [Post-Frontend Implementation Roadmap](10-implementation-roadmap.md) — phases, acceptance gates, and deferred Meta integration.
11. [Testing and Definition of Done](11-testing-and-definition-of-done.md)
12. [Team, Risks, and Decisions](12-team-risks-and-decisions.md)
13. [Reference Links](13-reference-links.md)
14. [Backend Setup and Phase 1–2 Validation](14-backend-setup.md)

## Quick Routing

| If you are working on… | Read |
|---|---|
| Feature scope or thesis alignment | 01 and 09 |
| Web mockup migration or folder layout | 02 and 04 |
| Authentication, secrets, RLS, or deployment | 03 |
| Running the Phase 1–2 backend and acceptance checks | 14 |
| Products, orders, stock, or promotion limits | 05 |
| Facebook Page connection or customer messages | 06 |
| AI replies, content generation, or knowledge retrieval | 07 |
| Template editor, approvals, publishing, or reminders | 08 |
| Sprint planning | 10 and 12 |
| Acceptance tests and pilot readiness | 11 |

## Coverage of the Former Handoff

The former REACT_NATIVE_EXPO_REPOSITORY_HANDOFF.md contained 27 numbered sections. They are retained here by topic:

| Former content | New location |
|---|---|
| Handoff purpose, project identity, non-negotiable decisions, scope | 01 |
| Repository audit, migration strategy, structure, dependencies | 02 and 04 |
| Architecture, environment variables, security, privacy | 03 |
| Database model, order lifecycle, allocation rules | 05 |
| Meta permissions, review, webhooks, messaging constraints | 06 |
| Gemini usage, structured output, RAG, model configuration | 07 |
| Promotions, approval, template maker, publishing, follow-ups | 08 |
| Dashboard, objectives, metrics, pilot evaluation | 09 |
| Phases, build order, first two weeks | 10 |
| Test strategy, Definition of Done, pilot checklist | 11 |
| Team workflow, risks, unresolved decisions | 12 |
| Official technical references | 13 |

## Documentation Status

- The revised roadmap in document 10 moves live Meta integration off the critical path pending professor consultation. Older subsystem documents describe intended live integration, not a prerequisite for the test chat or manual promotional export.
- The mobile repository is the only Git repository needed for implementation tracking.
- The user must explicitly authorize every commit and push.
- These files are planning documents, not proof that a feature is already implemented.
- When implementation and documentation disagree, inspect the code and update the documentation deliberately.

