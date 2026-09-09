# Meta and Messenger

## Integration Goals

The intended Meta integration can support:

- connecting a business-owned Facebook Page;
- receiving customer Messenger events through webhooks;
- sending allowed replies and follow-ups;
- publishing owner-approved Page content; and
- reading permitted Page or post insights for the dashboard.

Features must degrade clearly when permissions are missing or tokens expire.

## Typical Permission Areas

The exact permission set must be verified against the current Meta documentation and the features submitted for review. Likely areas include:

- pages_show_list to let the user select a managed Page;
- pages_manage_metadata to subscribe the Page to webhooks;
- pages_messaging for Messenger replies;
- pages_read_engagement for Page or content data;
- pages_manage_posts for Page publishing;
- read_insights for permitted Page insights.

Request only permissions required by implemented and demonstrable features.

## Connection Flow

1. Owner starts connection from the mobile app.
2. Authentication opens through the system browser.
3. The callback returns to an approved deep link.
4. A backend function exchanges and validates credentials.
5. The backend lists eligible Pages.
6. The owner selects a Page.
7. The backend stores the Page association and protected token material.
8. The backend subscribes the Page to required webhook fields.
9. The app runs a visible connection test.

Do not store long-lived Page tokens in Expo secure storage as the primary design. Keep them in a backend-controlled secret store or encrypted server-side record.

## Webhook Flow

The public webhook endpoint must:

- complete Meta verification;
- validate request signatures;
- reject unsupported event types;
- persist the external event ID;
- acknowledge promptly;
- process heavy work asynchronously;
- associate the event with the correct business and Page;
- avoid duplicate messages or orders on retry; and
- redact sensitive payload details from logs.

Do not wait for Gemini or other slow APIs before acknowledging a valid webhook.

## Messaging Constraints

Meta messaging eligibility, standard messaging windows, allowed message types, tags, and review rules can change. Before implementation and again before review:

- verify the current Messenger Platform policy;
- define when a business may reply;
- define when a follow-up is allowed;
- stop automation outside permitted conditions;
- allow a human to take over;
- record why each outbound automated message was eligible.

The planned two-follow-up product limit is not permission to send messages that Meta policy disallows.

## App Review Preparation

Prepare review evidence as features become functional:

- reviewer test account and test Page;
- clear reproduction steps;
- screen recording for each requested permission;
- explanation of why the permission is necessary;
- privacy policy and data-deletion instructions;
- working OAuth redirect and domain configuration;
- visible user benefit rather than unfinished placeholders.

Development-mode access is not proof that production users will receive the same permissions.

## Publishing

- Only an approved, current content version may be published.
- Recheck approval immediately before the API call.
- Use an idempotency record to prevent duplicate posts.
- Store provider post ID, publication time, result, and safe error details.
- Do not mark a post as published until Meta confirms success.
- When an edit creates a new version, require a new approval.

## Failure States

The owner should see distinct states for:

- not connected;
- connection requires attention;
- permission missing;
- token expired or revoked;
- webhook unhealthy;
- publishing failed;
- messaging currently ineligible;
- provider rate limited.

Provide a corrective action instead of a generic connection error.

