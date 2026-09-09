# Repository and Migration

## Current Repository Snapshot

The mobile repository is already an Expo application rather than an untouched web mockup. At the time this guide was created it used:

- Expo SDK 57;
- React Native 0.86;
- React 19;
- TypeScript;
- Expo Router;
- expo-dev-client;
- npm with package-lock.json.

The current implementation already has routes under src/app, reusable components under src/components, feature code under src/features, design tokens under src/theme, data fixtures under src/data, and application assets.

Verify versions from package.json before making dependency decisions because packages will change over time.

## Migration Principle

Use the web mockup as a design and behavior reference. Do not copy browser-specific implementation into the native app without review.

### Usually reusable

- TypeScript domain types.
- Constants and validation rules.
- API contracts.
- Pure helper functions.
- Text content, labels, and business terminology.
- Color, spacing, typography, and radius tokens.
- Framework-independent state logic.

### Usually adaptable

- React component boundaries.
- Form schemas.
- Hooks that do not depend on the DOM.
- Fetching and caching logic.
- Navigation concepts.
- SVG assets after checking native compatibility.

### Usually rewritten

- HTML elements and CSS.
- Tailwind classes intended for the browser.
- Browser routing.
- localStorage and document or window access.
- Drag-and-drop based on mouse events.
- Canvas or DOM screenshot libraries.
- File input elements.
- Web-only authentication callbacks.

## Screen Mapping

Map each mockup page to one of four outcomes before coding:

| Outcome | Meaning |
|---|---|
| Reuse | Logic or assets can move with minimal change. |
| Adapt | Structure is useful but native primitives and behavior are required. |
| Rewrite | The feature depends heavily on browser APIs or unsuitable interactions. |
| Reference only | Preserve the visual intent, not the implementation. |

For each screen, record its route, user role, data source, important states, actions, and acceptance criteria.

## Safe Migration Sequence

1. Preserve the working mobile application and inspect Git status.
2. Inventory the web mockup routes, components, assets, tokens, and browser dependencies.
3. Create a screen-mapping table.
4. Transfer design tokens and static assets.
5. Build reusable native primitives.
6. Port one vertical slice through real navigation and data.
7. Validate it on a physical Android device.
8. Migrate remaining flows incrementally.

## Dependency Rules

- Prefer Expo-supported libraries.
- Use npx expo install for packages with native code.
- Move from Expo Go to a development build before integrations depend on native configuration.
- Check whether packages support the installed Expo SDK and New Architecture.
- Record why a major dependency exists.
- Avoid duplicating state, form, networking, or UI libraries.

## First Vertical Slice

A useful first complete slice is:

~~~text
Sign in
  -> create or select a business
  -> create a product
  -> generate a draft promotion through a mocked backend
  -> review and approve it
  -> save it and display it in history
~~~

This proves navigation, authentication, database ownership, forms, backend boundaries, approval state, and mobile UI conventions before Meta or image generation adds complexity.

