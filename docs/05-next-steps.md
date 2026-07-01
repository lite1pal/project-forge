# Next Steps

The active roadmap is the hosted AuditTrail MVP. The goal is to make the
current sign-in -> setup -> ingest -> investigate flow provable, documented,
and release-gated before broadening the product or the framework tooling story.

## Hosted MVP Sequence

1. Stabilize and document reality:
   - keep the deployment shape explicit as `web + api + worker + postgres`
   - document the current source-runtime limitation honestly: the hosted stack
     still starts the API and worker through `tsx` entrypoints even though the
     repo also carries compiled start paths that need a later hardening pass
   - record the current root release-gate status before taking on new product
     breadth

1. Prove the hosted happy path:
   - sign in with a browser session
   - create an organization
   - create a project
   - create an API key
   - ingest an event
   - confirm the event appears in the dashboard
   - revoke the key
   - confirm the revoked key is rejected

1. Tighten dashboard usefulness after the first event:
   - keep `GET /api/v1/events` and `GET /api/v1/events/stats` as the primary
     read contract
   - add explicit empty states, first-event success states, and event-detail
     investigation UX
   - keep event lists bounded through pagination or explicit limits
   - add new filters only when they are indexed or clearly justified

1. Harden ingest as a release-critical public surface:
   - cover success, validation failure, auth failure, revoked-key failure,
     quota failure, and rate-limit behavior
   - prove project and organization scoping at the event data boundary
   - prove outbox intent is written only on successful ingest and is drained by
     the worker runtime
   - keep request logging and safe-error behavior free of API keys, cookies,
     auth headers, and raw sensitive payload bodies

1. Turn the MVP into a release gate:
   - keep `pnpm check:boundaries`, `pnpm typecheck`, and `pnpm test` green
   - run the hosted verification set in [docs/04-quality-gates.md](./04-quality-gates.md)
   - keep a manual production smoke checklist for the hosted sign-in, API key,
     ingest, and revocation flow

## Post-MVP Freeze

The following work is explicitly not a hosted release blocker unless it starts
breaking the hosted journey above:

- API compiled-runtime hardening
- Docker image trimming
- session inventory and MFA foundations
- broader extraction or scaffold expansion

## Follow-Up After MVP

After the hosted MVP is provable end to end, the next deliberate slices are:

1. add installed-product state plus a runtime registry so one organization can
   enable multiple products deliberately instead of through app-level patches
1. make shell, onboarding, and API composition manifest-driven for multiple
   installed products
1. harden the API container runtime to use compiled JavaScript safely
1. harden the worker container runtime to use compiled JavaScript safely
1. decide whether richer dashboard summaries need a minimal API extension
1. revisit framework or scaffold extraction work only when it no longer
   competes with hosted product proof
