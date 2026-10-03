# Scope and roadmap

## Decisions — 2026-10-04

- Working name: Thesis Foodservice App. BuckStar is the research business.
- Keep the existing GitHub repository/history. Ordinary commits and pushes require explicit instruction; no replacement repository or history rewrite.
- Provision a fresh Supabase environment later. This cleanup changes repository files only.
- Use direct Meta APIs for new conversation capture, chatbot replies, order intake, takeover and controlled follow-ups.
- Start with Standard Access and accepted developer-app tester roles for researchers acting as customers. These roles do not grant mobile-app membership.
- Researcher-only testing is development, not final participant evaluation.
- Generate captions and editable graphics for manual copy/export. Automatic Page publishing is excluded.
- Preserve actual owner food photographs; AI generates backgrounds/decorations.
- Use bounded in-app Apify imports of selected Pages/posts, then researcher approval.
- Implement Supabase RAG with separate business-knowledge and marketing-inspiration collections.
- Confirmed orders reserve nothing; staff acceptance checks and allocates atomically.

## Current status

| Capability | Status |
|---|---|
| Auth, membership, menu/categories/photos, customers, settings | Implemented; fresh hosted/device acceptance remains |
| Manual orders, allocation, audit and uncertain-save recovery | Implemented with local regression coverage |
| Approved knowledge editing/history | Implemented |
| Pure grounded-reply helper | Retained, locally tested; no running AI service |
| Direct Meta connection, chatbot and conversation capture | Deferred; unavailable-state screen only |
| Follow-ups and query-specific RAG | Deferred |
| Apify imports and reference review | Deferred |
| Captions, generated designs, templates and export | Deferred |
| External marketing metrics and research exports | Deferred |

## Later delivery sequence

1. Provision and verify the fresh research backend, accounts, RLS and owner photos.
2. Prove direct Meta receipt/reply using BuckStar and researcher testers.
3. Implement business RAG and grounded order intake with staff allocation.
4. Implement stalled-chat reminders with fixed-clock tests and actual send evidence.
5. Implement Apify curation, marketing retrieval, captions, graphics and manual export.
6. Add research reporting/exports and complete adviser, participant and physical-device acceptance.

See [Messenger](MESSENGER.md), [RAG](RAG.md), [Content](CONTENT.md) and [Validation](VALIDATION.md).

## Unresolved decisions

Service ownership/budgets, devices, actual Meta permission availability, source-collection permission, business rules, retention/consent, final naming/signing ownership and adviser-approved instruments remain open.

Later participant use may require different Meta access/review. Page insights need a verified source and metric coverage. Internal testing cannot establish real customer sales, reach or conversion gains.

Payment verification, courier dispatch, accounting/POS, ad buying, extra messaging channels and enterprise multi-branch features remain outside scope.
