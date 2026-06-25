# Auth Feature

Owns the web sign-in and session flow.

## Responsibilities

- sign-in form and callback form
- magic-link request and session creation actions
- current-user loading and sign-out
- view-model shaping for auth screens

## Key Files

- `api/auth-client.ts`: API boundary for auth routes
- `server/auth-server.ts`: server actions and protected-user loading
- `components/*`: presentational auth UI
- `domain/schemas.ts`: Zod validation for `/me`
- `domain/presenters.ts`: view-model conversion

## Invariants

- components stay presentational
- server actions call the Fastify API directly
- no Next.js route handlers or proxy endpoints
- sign-in confirmation and sign-out submit browser forms directly to API redirect endpoints
- session state comes from `/api/v1/me`

## When Editing

- add unit tests for presenter or client changes
- keep UI components under the component size limit
- update `README.md` and `docs/03-api.md` when auth behavior changes
