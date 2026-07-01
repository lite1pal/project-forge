# Todo Resource Preview

This preview was generated from a validated `todo` resource spec.

## Supported assumptions

- ownership: `organization`
- CRUD: `list`, `create`, `read`, `update`
- delete generation: unsupported in the first generator
- output mode: preview-only under `.generated/` or `tmp/`

## Fields

- `title`: `string` required
- `details`: `text`
- `status`: `enum` required
- `dueAt`: `datetime`

## Generated file groups

- `packages/domain/src/generated/todo/index.ts`
- `packages/db/src/schema/todo.ts`
- `apps/api/src/modules/generated/todo/routes.ts`
- `apps/api/src/modules/generated/todo/service.ts`
- `apps/api/src/modules/generated/todo/repo.ts`
- `apps/api/src/modules/generated/todo/postgres-repo.ts`
- `apps/api/src/modules/generated/todo/__tests__/routes.test.ts`
- `apps/api/src/modules/generated/todo/__tests__/routes.integration.test.ts`
- `apps/api/src/modules/generated/todo/__tests__/service.test.ts`
- `apps/web/src/features/todo/index.ts`
- `apps/web/src/features/todo/api/todo-client.ts`
- `apps/web/src/features/todo/components/todo-screen.tsx`
- `apps/web/src/features/todo/components/todo-form.tsx`
- `apps/web/src/features/todo/components/todo-table.tsx`
- `apps/web/src/features/todo/components/todo-empty-state.tsx`
- `apps/web/src/features/todo/domain/schemas.ts`
- `apps/web/src/features/todo/__tests__/todo-screen.test.tsx`
- `apps/web/src/features/todo/__tests__/todo-client.test.ts`
- `docs/resources/todo.md`
- `docs/resources/todo-customization.md`

## Manual follow-up

- add domain and DB barrel exports if this preview is promoted into real repo source
- register routes intentionally instead of copying generated preview files into `apps/api/src/app.ts` blindly
- write a real migration after picking the next migration identifier
