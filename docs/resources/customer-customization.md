# Customer CUSTOMIZE

This preview is intentionally safe and incomplete. Treat it as generated scaffolding, not as a drop-in runtime slice.

## Safe customization points

- business rules: `apps/api/src/modules/generated/customer/service.ts`
- persistence queries: `apps/api/src/modules/generated/customer/postgres-repo.ts`
- request validation and route shaping: `apps/api/src/modules/generated/customer/routes.ts`
- UI copy and layout: `apps/web/src/features/customer/components/*`

## Ownership assumptions

- every CRUD call is organization-scoped
- generated preview files assume organization IDs are required at every API boundary
- product navigation is intentionally not wired automatically in this first generator

## Regeneration guidance

- avoid hand-editing generated schema boilerplate if you plan to regenerate from the same spec
- prefer layering business logic into service and adapter files after review
- do not copy the preview directly into runtime without adding barrel exports, route registration, and a real migration

## Checks to run after promotion

- `pnpm check:boundaries`
- `pnpm typecheck`
- `pnpm --filter @auditrail/api test`
- `pnpm --filter web test`
- `pnpm verify`
