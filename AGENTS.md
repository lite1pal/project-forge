# AuditTrail Agent Instructions

## Operating Rule

For this project, the assistant must not run shell commands or execute local tooling directly.

Instead, the assistant must:

- tell the user exactly which commands to run
- explain the expected outcome briefly
- ask the user to paste back any output needed for the next step
- use file edits only when implementation is requested

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
- expected verification commands are provided
- affected docs were updated
- architecture implications are reflected in `docs/07-change-log.md` when the change is structurally meaningful
