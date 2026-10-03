# Content generation and curated references

## Status and scope

**Deferred as of 2026-10-04.** Apify imports, captions, generated images, template editing, approvals and export are not built. Promotions shows an unavailable state.

Owners will copy captions/export graphics and manually post them to Facebook. Automatic Page publishing/scheduling is excluded. Export is not publication.

## Apify curation

Select comparable foodservice Pages for discovery, then approve individual posts. Direct post links support deliberately chosen examples. Start with the maintained [Facebook Posts Scraper](https://apify.com/apify/facebook-posts-scraper); verify its [input schema](https://apify.com/apify/facebook-posts-scraper/input-schema) when implementing.

Defaults: five Pages maximum, twenty posts per Page, ninety-day lookback, one hundred results per import. Imports are manually requested in-app, one active run per business, with backend result/runtime/spending limits. No recurring scrape is planned initially.

The backend starts an asynchronous run, tracks status, validates/paginates results and deduplicates them into a review queue. Partial/failing imports stay visible; retries must not silently duplicate paid runs. Only approved references become eligible for marketing retrieval.

Keep Page/post IDs and URLs, text, publication/collection times, available aggregate counts, run/build provenance and approval. Exclude personal profiles, private groups, commenter identities and full comment threads. Competitor images never enter product-photo storage.

An available scraper does not grant collection permission. [Meta requires permission for automated collection](https://about.fb.com/news/2021/04/how-we-combat-scraping/). Support permitted sources and manual references if Facebook collection cannot be authorized. Scraped counts do not establish reach or causal performance.

## Generation and photo fidelity

Retrieve a few approved examples for themes, tone, offer structure and calls to action. Combine them with BuckStar's facts and the owner's brief. Never blindly feed an entire scrape, copy competitor claims or follow instructions embedded in external content. [RAG](RAG.md) owns source isolation.

Actual owner photos are the source of truth. Add private high-resolution original retention during the content milestone; current menu uploads are resized, not archival originals.

AI generates decorative backgrounds/design assets. Composite the actual food photo separately without regenerating ingredients, portions or presentation. Reference-image prompting alone cannot guarantee fidelity. Fictional menu images cannot stand in for real products.

Begin with three 1080 × 1080 templates: spotlight, bundle and limited-time offer. Keep captions, headlines, prices, colors, placement and photo references editable. Persist a versioned document and immutable export. Use existing native SVG rendering; add Expo clipboard/file/sharing support only when building export.

## Approval and manual posting

Brief + verified products → suggestions → editable draft → exact-version owner approval → copy/export → optional manually reported posting.

Use Draft, Needs revision, Approved and Exported states; store manually reported posting separately with optional URL/time. Edits invalidate approval. Recheck product/offer facts before approval/export and retain drafts on provider failure.

Acceptance includes original-photo preservation, source isolation, approval invalidation, accurate prices, long text, private access, offline recovery and low-memory Android export. [Gemini image documentation](https://ai.google.dev/gemini-api/docs/image-generation) describes the future backend provider.
