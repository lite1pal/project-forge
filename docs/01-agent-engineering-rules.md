# Agent engineering rules

AuditTrail should be easy for AI agents to extend without silently weakening the architecture.

## Task workflow

GitHub Issues are the source of truth for tasks. `tasks.txt` is the agent's
local queue/cache so work can be resumed reliably from the repository alone.

Agents should:

1. read `tasks.txt` before starting work
2. work on exactly one task at a time
3. create or link a GitHub issue before coding if the task has no `github:` value
4. use branch names in the form `codex/<task-id>-<slug>`
5. update `tasks.txt` when issue/branch/PR/state changes
6. move completed tasks to `Done` without deleting history
7. search for existing GitHub issues before creating a new one
8. mark tasks complete only after tests pass, or after explicitly documenting skipped tests
9. automatically create or link a tracked task for any non-trivial request unless the user explicitly opts out

Supported task states:

- `todo`
- `ready`
- `in_progress`
- `blocked`
- `review`
- `done`

The repository includes `scripts/task-sync.sh` for the common `gh`-based issue
operations and `tasks.txt` updates.

## API route rule

No API route should be added without tests.

The API test command enforces 95% coverage for lines, statements, branches, and functions:

```bash
pnpm --filter @auditrail/api test
```

Route tests should use Fastify `app.inject()` unless the behavior specifically requires a real network socket.

## Environment rule

API environment variables are validated with Zod before build and start:

```bash
pnpm --filter @auditrail/api validate:env
pnpm --filter @auditrail/api build
```

The validator reads root `.env`, then `apps/api/.env`, then process env. App-level values override root values.

Required API envs:

- `DATABASE_URL`
- `REDIS_URL`
- `API_KEY_PEPPER`
- `API_HOST`
- `API_PORT`
- `RATE_LIMIT_MAX`
- `RATE_LIMIT_WINDOW`
- `NODE_ENV`

Defaults exist only for non-secret process settings. Service URLs must be explicit.

## Local ports

Postgres maps to host port `5433` by default to avoid conflicting with an existing local Postgres on `5432`.

Redis maps to host port `6379` by default.

## Shared package rule

Shared packages should stay narrow:

- `packages/config`: environment and config parsing helpers only
- `packages/domain`: pure schemas, types, and business helpers only
- `packages/db`: database schema, database client, migrations, and query helpers only
- `packages/testkit`: test helpers only

Do not put framework, database, queue, or filesystem access into `packages/domain`.
