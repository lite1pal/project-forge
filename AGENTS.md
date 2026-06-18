# AuditTrail Agent Instructions

## Task Workflow

GitHub Issues are the source of truth for work tracking. `tasks.txt` is the
agent's lightweight local queue and cache, not the canonical tracker.

1. Read `tasks.txt` before starting.
2. Work on exactly one task at a time.
3. If a task has no GitHub issue, create one before coding.
4. Use branch name: `codex/<task-id>-<slug>`.
5. Update `tasks.txt` when:
   - the issue is created
   - work starts
   - a PR is opened
   - the task is complete
6. Never delete task history. Move completed tasks to `Done`.
7. Do not create duplicate GitHub issues. Search existing issues first.
8. Mark a task complete only after tests pass, or explicitly document skipped
   tests in task notes and the change summary.
9. For any non-trivial user request, create or link a tracked task before
   coding unless the user explicitly says not to track it.

Supported task states are:

- `todo`
- `ready`
- `in_progress`
- `blocked`
- `review`
- `done`

## Architecture Rules

Keep every unit tiny, reusable, testable, and simple.

- Prefer small modules over broad framework abstractions.
- Keep domain logic pure: no database, HTTP, filesystem, queue, or environment access.
- Validate all external input with Zod at the boundary.
- Keep environment parsing centralized and tested.
- Do not add infrastructure until a vertical slice needs it.
- Do not introduce optional architecture-showcase technology before the core event path works.

## API Route Rule

No API route should be added without tests.

The API test command must enforce at least 95% coverage for:

- lines
- statements
- branches
- functions

Use Fastify `app.inject()` for route tests unless the behavior specifically requires a real network socket.

Test code must not rely on shared global environment mutation when the same behavior can be injected directly. Prefer explicit app, plugin, service, or repo options over `process.env` stubbing for unit tests, because Vitest runs files concurrently.

When changing Fastify plugin registration, keep TypeScript overload behavior in mind: do not pass `undefined` as plugin options. Register the plugin without an options object unless options actually exist.

## Environment Rule

API environment variables must be validated before build and start.

Service URLs must be explicit. Defaults are acceptable only for non-secret process settings such as host, port, and `NODE_ENV`.

Environment file loading precedence is:

1. repository `.env`
2. app-local `.env`
3. real process environment

Real process environment must win so test and deployment overrides remain deterministic.

## Command Handoff Format

When commands are needed, provide them in copy-pasteable blocks from the repository root unless another directory is explicitly required.

Example:

```bash
pnpm typecheck
pnpm --filter @auditrail/api test
```

## Documentation Rule

Documentation updates are required in the same change when behavior or architecture changes materially.

Any change to architecture, API contracts, deployment, test layout, package boundaries, or agent workflow must update the relevant docs in the same change.

Minimum expected doc targets:

- `README.md` for setup, workflow, or operator-facing changes
- `docs/02-architecture.md` for module and package boundary changes
- `docs/03-api.md` for API contract, versioning, auth, or error-shape changes
- `docs/04-quality-gates.md` for testing, coverage, validation, or test-layout changes
- `docs/06-deployment.md` for runtime, container, or deployment changes
- `docs/07-change-log.md` for meaningful architecture decisions and structural changes

Do not treat docs as optional follow-up work.

If no doc update is required, the change summary must state why.

## Change Completion Checklist

Before considering a task complete, verify:

- code changes are complete
- `tasks.txt` reflects the latest task state
- expected verification commands are provided
- affected docs were updated
- architecture implications are reflected in `docs/07-change-log.md` when the change is structurally meaningful
