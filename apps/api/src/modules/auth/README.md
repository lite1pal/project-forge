# Auth Module

Owns browser-session authentication for the API.

## Responsibilities

- magic-link request and verification
- session creation and revocation
- session cookie contract
- auth persistence adapters
- magic-link sender boundary

## Key Files

- `service.ts`: auth workflow and token/session rules
- `routes.ts`: Fastify HTTP adapter
- `postgres-repo.ts`: Postgres persistence
- `senders.ts`: magic-link sender implementations, including local in-memory and Resend-backed delivery
- `tokens.ts`: opaque token creation and hashing

## Invariants

- all external input is validated at the route boundary
- magic links are single-use
- session tokens are hashed before storage
- route handlers stay thin and delegate to the service
- browser confirmation and sign-out redirects own session cookie writes in production flows
- standard runtime startup must use a provider-backed sender
- local fake delivery is reserved for tests and the explicit dev-only auth harness

## When Editing

- update the route tests when changing request or response shapes
- update repo tests when changing persistence behavior
- update `docs/03-api.md` and `docs/07-change-log.md` for contract changes
