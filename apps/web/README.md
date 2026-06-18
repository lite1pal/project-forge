# AuditTrail Web App

Next.js product UI for the Fastify API in `apps/api`.

## What This App Owns

- browser sign-in and magic-link callback flow
- protected dashboard UI
- organization and project settings UI
- API key management UI
- audit-event table, dashboard cards, and detail inspection

## Hard Boundaries

- do not add `app/**/route.ts`
- do not add `pages/api/**`
- do not proxy API calls through Next.js handlers
- call the existing Fastify API directly
- use `@/...` imports for all local code

## Where To Start

For most feature tasks:

1. `src/features/<feature>/components/*`
2. `src/features/<feature>/domain/*`
3. `src/features/<feature>/__tests__/*`

Shared UI primitives live in `src/components/ui`.
Shared infra lives in `src/lib`.

## Useful Commands

Run from the repository root:

```bash
pnpm --filter web check:architecture
pnpm --filter web lint
pnpm --filter web typecheck
pnpm --filter web test
```

For local development:

```bash
WEB_API_BASE_URL=http://localhost:4000 \
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000 \
pnpm dev:web
```

If you need manual local sign-in without a provider-backed email sender, start
the API with the explicit local auth harness instead of the standard runtime:

```bash
pnpm dev:api:local-auth
```

## Auth Reminder

The web app depends on API auth routes. Local browser auth also needs:

```bash
AUTH_TOKEN_SECRET=replace-with-a-long-random-secret
WEB_PUBLIC_URL=http://localhost:3000
```

## Cheap Context Path

If you are working on a web task and want minimal context, read:

1. `../AGENTS.md`
2. the owning `tasks/*.txt` entry
3. `../docs/08-agent-quickstart.md`
4. the relevant `src/features/<feature>` folder
