# Promotions, Templates, and Follow-ups

## Promotion Workflow

~~~text
Owner enters campaign goal and offer
  -> backend loads current business and product facts
  -> Gemini returns structured content options
  -> owner selects and edits a draft
  -> owner previews the post and graphic
  -> owner approves an exact version
  -> backend publishes that version
  -> result and provider identifiers are stored
~~~

Generated content stays in draft state until a user approves it.

## Approval Versioning

Each meaningful edit creates or increments a content version. Approval records should identify:

- promotion ID;
- exact content version;
- approver;
- approval time;
- approved caption and asset reference or hash;
- target Page;
- scheduled or immediate publication choice.

If caption, image, offer terms, price, dates, or target Page changes, invalidate the approval.

## Template Maker: First Version

Build a constrained editor instead of a general-purpose Canva replacement. A practical first version supports:

- choosing from curated layouts;
- selecting product photos from camera, gallery, or business assets;
- editable headline, price, offer, and call-to-action;
- a small set of approved fonts;
- theme colors from the business profile;
- moving and resizing within controlled regions;
- safe-area and overflow warnings;
- 1080 by 1080 export;
- saving an editable template document and a flattened output.

## Template Data Model

Store a serializable document rather than only the final image:

- canvas dimensions and background;
- template version;
- ordered element list;
- element type;
- position, size, rotation, and layer;
- text, font, color, and alignment;
- asset reference and crop information;
- locked and editable properties.

Validate documents before rendering. Keep source assets separate from exported images.

## Editor Implementation Strategy

1. Render static templates with text and image placeholders.
2. Add form-based editing for content and colors.
3. Add element selection.
4. Add touch movement and resizing.
5. Add bounds, snapping, and safe-area constraints.
6. Add deterministic export.
7. Add draft persistence and restore.
8. Test memory use with realistic photos on Android.

Prove export quality and physical-device performance early because this is one of the highest technical risks.

## AI Images

Use generated imagery as an optional source asset, not the source of business truth. The owner should review results for inaccurate food appearance, misleading portions, inappropriate text, brand mismatch, and unwanted artifacts. Product photos supplied by the business should remain available as the safer default.

Image requests must go through the backend. Store prompt metadata and ownership, apply quotas, and do not expose provider secrets.

## Test Graphics

Create a small set of predictable placeholder graphics so editor development does not depend on image-generation availability. Include different aspect ratios, transparent assets, long text, large prices, and low-resolution photos to test constraints and errors.

## Follow-up Rules

The initial product rule is at most two automated follow-ups for an eligible conversation. The proposed schedule is Tuesday through Friday at 11:00 AM, but the group must confirm the timezone, delay after inactivity, eligible order stage, holidays, and stop conditions.

A follow-up job should:

1. confirm the conversation still qualifies;
2. confirm messaging is allowed by current Meta policy;
3. confirm the customer or staff has not replied;
4. confirm the order is not completed, rejected, expired, or opted out;
5. confirm the follow-up count is below the limit;
6. send using an idempotency key;
7. record the attempt and result;
8. stop permanently when a stop condition applies.

Do not use a language model to decide basic timing or eligibility.

## Scheduling

Store intended execution times in UTC and keep the business timezone separately. Scheduled jobs should query due records in small batches, claim them safely, tolerate retries, and recover records left in processing after a crash.

