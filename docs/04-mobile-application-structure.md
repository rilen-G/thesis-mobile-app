# Mobile Application Structure

## Preserve the Existing Layout

The repository already uses src/app for routes. Extend that structure rather than replacing it with a second application layout.

A practical target organization is:

~~~text
src/
  app/
    _layout.tsx
    (auth)/
    (onboarding)/
    (owner)/
    (staff)/
  components/
    ui/
    forms/
    feedback/
  features/
    auth/
    business/
    products/
    promotions/
    templates/
    conversations/
    orders/
    dashboard/
    integrations/
  services/
    supabase/
    api/
  theme/
  types/
  utils/
assets/
supabase/
  migrations/
  functions/
~~~

This is a direction, not a requirement to move working files immediately. Refactor only when it supports an actual feature.

## Routing

- Use route groups to separate authentication, onboarding, owner, and staff experiences.
- Protect authenticated routes using session state at a shared layout boundary.
- Check business membership after authentication.
- Keep deep-link targets stable for OAuth callbacks and notifications.
- Define a useful fallback for expired or malformed links.
- Test Android hardware-back behavior on nested routes and modals.

## State Ownership

- Server data should come from Supabase or backend endpoints and have one clear cache policy.
- Form state belongs close to its form.
- Authentication and selected-business context may use shared providers.
- Do not place all business data in a global store.
- Persist only the minimum safe device state.
- Treat locally cached data as potentially stale and revalidate before consequential actions.

## Reusable UI Foundations

Create or consolidate these before duplicating them across screens:

- typography and spacing tokens;
- buttons and icon buttons;
- text fields, selectors, and validation messages;
- cards, badges, chips, and status indicators;
- screen containers and section headers;
- loading, empty, error, retry, and offline states;
- confirmation dialogs and bottom sheets;
- image and media placeholders.

## Forms

- Show field requirements before submission.
- Use appropriate Android keyboards.
- Avoid hiding fields behind the keyboard.
- Preserve safe draft input if a request fails.
- Validate locally for usability and again on the server for trust.
- Make currency, dates, times, quantities, and phone formats explicit.
- Require confirmation for irreversible or customer-facing actions.

## Device and Accessibility Checks

- Use safe-area handling and responsive layouts.
- Keep touch targets comfortably usable.
- Provide labels for icon-only controls.
- Do not communicate status through color alone.
- Check contrast and dynamic text behavior.
- Compress and resize images before upload.
- Test on a lower-memory Android device and a representative screen size.
- Verify behavior with slow or intermittent connectivity.

## Development Builds

Expo Go is useful for early UI work, but the project should adopt an Expo development build early. Meta configuration, notifications, native media handling, and some editor or export dependencies may require native configuration unavailable in Expo Go.

## Error Handling

User-facing errors should answer:

1. What failed?
2. Was anything saved or sent?
3. What can the user do now?

Technical details belong in sanitized logs. External errors should be translated into stable application error codes so screens do not depend on provider-specific response text.

