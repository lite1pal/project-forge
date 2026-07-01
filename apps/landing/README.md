# Project Anvil Landing

This app is the public landing site for Project Anvil.

It is intentionally separate from the authenticated AuditTrail runtime and
exists only for framework-facing marketing and discovery copy.

## Provenance

The current implementation is based on the MIT-licensed
[`matt765/Tailcast`](https://github.com/matt765/Tailcast) Astro theme and has
been reduced to a single Project Anvil landing page with framework-specific
copy.

## Local commands

Run from the repository root:

```bash
pnpm dev:landing
pnpm --filter landing typecheck
pnpm --filter landing build
```

## Scope

- public marketing only
- no authenticated product flows
- no shared runtime contracts with `apps/api`, `apps/web`, or `apps/worker`
