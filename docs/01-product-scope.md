# Product Scope

## Project Identity

The thesis project is an Android-first mobile system for Philippine micro and small foodservice establishments. It combines digital marketing assistance, editable promotional content, chat-based customer support, order intake, controlled follow-ups, and performance monitoring.

## Primary Users

- Owner or manager: configures the business, approves content, manages products and orders, connects external accounts, and views results.
- Staff member: handles permitted operational tasks such as order updates and customer conversations.
- Customer: interacts through the connected Facebook Page or Messenger experience rather than through the owner application.

Exact staff permissions remain a team decision. Start with least privilege.

## First-Release Capabilities

1. Account sign-in and business profile setup.
2. Product, menu, availability, FAQ, delivery, and policy management.
3. AI-assisted promotional copy with mandatory human review.
4. An editable promotional template maker.
5. Facebook Page connection and approved publishing workflow.
6. Messenger webhook ingestion and AI-assisted FAQ responses.
7. Structured order collection, confirmation, and status management.
8. No-response follow-ups with strict timing and count limits.
9. Dashboard metrics needed for the thesis objectives and pilot.
10. Audit records for approvals, AI actions, status changes, and integrations.

## Non-Negotiable Product Decisions

- Android is the first deployment target.
- React Native with Expo and TypeScript is the client stack.
- Supabase provides the database, authentication, storage, and trusted server functions.
- Gemini is used through a backend function, never directly from the mobile bundle.
- Meta APIs are used only after required permissions and review are understood.
- Promotional posts require owner approval before publishing.
- The AI assists users; it does not make financial, inventory, or final campaign decisions.
- Order and allocation correctness is enforced by database logic.

## Explicitly Out of Scope Unless the Team Reopens Scope

- Card or e-wallet payment processing and automatic payment verification.
- Automatic courier booking or real-time rider tracking.
- Full accounting, payroll, procurement, or point-of-sale replacement.
- Fully autonomous ad buying.
- Multi-platform social integrations beyond the approved Meta flow.
- Broad enterprise multi-branch administration.

## Success Principle

The project succeeds by completing a reliable, measurable end-to-end workflow for the pilot business. A smaller system with correct orders, safe AI, traceable approvals, and usable results is more valuable than many disconnected demonstration screens.

