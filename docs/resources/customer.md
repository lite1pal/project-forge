# Customer Resource Preview

This preview was generated from a validated `customer` resource spec.

## Supported assumptions

- ownership: `organization`
- CRUD: `list`, `create`, `read`, `update`
- delete generation: unsupported in the first generator
- output mode: preview-only under `.generated/` or `tmp/`

## Fields

- `name`: `string` required
- `email`: `email` required
- `isActive`: `boolean` required
- `status`: `enum` required
- `externalId`: `uuid`
- `lastContactedAt`: `datetime`

## Generated file groups

- `packages/domain/src/generated/customer/index.ts`
- `packages/db/src/schema/customer.ts`
- `apps/api/src/modules/generated/customer/routes.ts`
- `apps/api/src/modules/generated/customer/service.ts`
- `apps/api/src/modules/generated/customer/repo.ts`
- `apps/api/src/modules/generated/customer/postgres-repo.ts`
- `apps/api/src/modules/generated/customer/__tests__/routes.test.ts`
- `apps/api/src/modules/generated/customer/__tests__/routes.integration.test.ts`
- `apps/api/src/modules/generated/customer/__tests__/service.test.ts`
- `apps/web/src/features/customer/index.ts`
- `apps/web/src/features/customer/api/customer-client.ts`
- `apps/web/src/features/customer/components/customer-screen.tsx`
- `apps/web/src/features/customer/components/customer-form.tsx`
- `apps/web/src/features/customer/components/customer-table.tsx`
- `apps/web/src/features/customer/components/customer-empty-state.tsx`
- `apps/web/src/features/customer/domain/schemas.ts`
- `apps/web/src/features/customer/__tests__/customer-screen.test.tsx`
- `apps/web/src/features/customer/__tests__/customer-client.test.ts`
- `apps/web/app/customers/page.tsx`
- `apps/web/app/customers/create/page.tsx`
- `apps/web/app/customers/[id]/page.tsx`
- `apps/web/app/customers/[id]/edit/page.tsx`
- `docs/resources/customer.md`
- `docs/resources/customer-customization.md`

## Manual follow-up

- add domain and DB barrel exports if this preview is promoted into real repo source
- register routes intentionally instead of copying generated preview files into `apps/api/src/app.ts` blindly
- write a real migration after picking the next migration identifier
