# System Architecture and Security

## High-Level Architecture

~~~text
Expo Android application
  -> Supabase Auth
  -> Supabase Database and Storage
  -> Supabase Edge Functions
       -> Gemini APIs
       -> Meta Graph API and Messenger
       -> scheduled follow-up processing

Meta webhooks
  -> public verified Edge Function endpoint
  -> idempotent event processing
  -> database
  -> optional Gemini response generation
  -> Messenger Send API
~~~

The mobile client requests actions. Trusted backend code verifies the user, validates ownership, applies business rules, invokes external APIs, and stores results.

## Environment Configuration

The mobile application may contain only values designed to be public:

- Supabase project URL.
- Supabase publishable or anonymous key.
- Non-secret build identifiers and public feature settings.

Backend-only values include:

- Supabase service-role key.
- Gemini API key.
- Meta app secret.
- Page access tokens.
- webhook signing or verification secrets;
- database passwords and deployment credentials.

An EXPO_PUBLIC prefix makes a value accessible to application code and therefore recoverable from the installed app. It is not a secret store.

## Authentication and Authorization

- Use Supabase Auth for identity.
- Model business membership and roles in database tables.
- Write Row Level Security policies for business isolation.
- Do not authorize access using user-editable metadata.
- Check ownership again inside privileged Edge Functions.
- Use short-lived sessions and established token refresh behavior.
- Define how account recovery and ownership transfer work before the pilot.

Remember that an update operation also needs a matching select policy. Review database views carefully because view behavior may bypass underlying RLS depending on configuration.

## Database and Storage Security

- Enable RLS on every table reachable through the client API.
- Test policies with two unrelated businesses and at least two roles.
- Keep privileged helper functions in a private schema when possible.
- Store business images and generated exports in buckets with explicit policies.
- Prefer private buckets for customer or business-sensitive content.
- Use signed URLs with short expiration periods.
- Understand the extra permissions required before using Storage upsert.

## Edge Function Responsibilities

Edge Functions should:

- verify the authenticated caller or webhook signature;
- validate request shape and business ownership;
- enforce quotas and rate limits;
- call Gemini or Meta;
- redact sensitive logs;
- use idempotency keys;
- write auditable results; and
- return stable, typed error responses.

Keep external API SDK objects and secrets out of React components.

## Privacy and Data Minimization

- Collect only information needed for the order and study.
- Define retention for chat messages, customer identifiers, generated media, and logs.
- Avoid placing unnecessary personal information in prompts.
- Give the business a way to correct or remove customer data when required.
- Separate research exports from live operational data.
- Document consent, notices, and access procedures with the thesis advisers.

## Reliability Controls

- Apply timeouts and bounded retries to external calls.
- Use exponential backoff only for retryable failures.
- Store webhook event IDs to prevent duplicate processing.
- Use a job table with explicit pending, processing, completed, failed, and cancelled states.
- Recover abandoned processing jobs using leases or timestamps.
- Make scheduled work safe to run more than once.
- Display actionable failures in the mobile application without exposing secrets.

## Deployment Environments

Maintain separate development and pilot or production configurations where feasible. Do not test Meta review, real customer messages, or destructive migrations against the only copy of pilot data. Keep schema changes versioned as migrations and rehearse rollback or restoration procedures before the pilot.

