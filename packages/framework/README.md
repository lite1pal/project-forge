# Framework Contracts

`@auditrail/framework` is the pure contract layer for future framework tooling.

It currently provides:

- generic module, route, check, agent-task, and generator-plan schemas
- a canonical resource-spec schema for future resource planning, generation, and AI-agent context commands
- the normalized contract consumed by the current dry-run planner command:
  `pnpm saas plan resource tools/saas/examples/customer.resource.json`

The resource-spec entrypoint is `frameworkResourceSpecSchema` from
`packages/framework/src/index.ts`.

Example:

```ts
frameworkResourceSpecSchema.parse({
  resource: "customer",
  label: "Customer",
  ownership: "organization",
  fields: [
    { name: "name", type: "string", required: true },
    { name: "email", type: "email", required: true, unique: true },
    {
      name: "status",
      type: "enum",
      required: true,
      values: ["active", "inactive"],
      default: "active"
    }
  ]
});
```

The schema is strict and generic:

- no AuditTrail-specific imports or product assumptions
- no filesystem, shell, env, database, HTTP, queue, or code-generation behavior
- validation for reserved resource names, duplicate fields, enum declarations,
  CRUD safety, and API-prefix shape

`normalizeFrameworkResourceSpec()` is available for pure defaulting:

- `pluralLabel` from `label`
- CRUD defaults with `delete: false`
- UI page defaults from CRUD flags
- API prefix from the resource name
- default timestamps

Current planner scope:

- reads JSON resource specs
- validates and normalizes them through `frameworkResourceSpecSchema`
- prints a grouped dry-run file plan
- stays generic and audit-free while downstream tooling consumes it

Current generator consumer scope:

- `pnpm saas add resource ... --output ...` reuses the same canonical schema and planner
- the first generator supports one narrow organization-owned CRUD subset only
- unsupported ownership, field types, destructive CRUD, public APIs, and nav wiring are rejected before writing
- generated output is preview-only and must stay under `.generated/` or `tmp/`

Current AI-agent context consumer scope:

- `pnpm saas agent context resource ...` reuses the same canonical schema and planner
- the command emits concise task metadata, path policy, checks, stop conditions, and prompt text for generated-resource work
- markdown is the default output mode and `--json` is available for stable future machine consumption
- the command does not add CRUD generation behavior or mutate runtime source

Current AI-agent install recipe consumer scope:

- `pnpm saas agent recipe resource-install ...` reuses the same canonical schema plus the planner and agent-context metadata
- the command emits deterministic install guidance, path policy, stop conditions, checks, and report format for one generated resource task
- markdown is the default output mode and `--json` is available for stable future machine consumption
- the command does not add CRUD generation behavior or mutate runtime source

Current scaffold-planner consumer scope:

- `pnpm saas plan scaffold ...` reuses extraction dry-run metadata, placeholder-product metadata, and framework quality-gate seams
- the command emits deterministic scaffold-plan data for a future create-app flow, including source groups, replacements, checks, and AI workflow hints
- markdown is the default output mode and `--json` is available for stable future machine consumption
- the command does not create scaffold output or mutate runtime source

Current scaffold-generator consumer scope:

- `pnpm saas generate scaffold ... --output ...` reuses the same scaffold planner contract before writing
- the command stages extraction output plus placeholder-product files into deterministic local candidate output
- it writes a generated README and scaffold report while staying under `.generated/` or `tmp/`
- it fails closed on unsafe output, unresolved placeholders, forbidden AuditTrail imports, and unsafe overwrite attempts
- it does not publish a package, create a repo, or mutate runtime source

Current scaffold-smoke consumer scope:

- `pnpm saas check scaffold ...` reuses the same scaffold generator contract and validates the actual generated candidate output
- it checks required scaffold files, placeholder-product output, forbidden imports, unresolved placeholders, and deterministic repeated generation
- it runs only in isolated temp output and must not mutate real runtime source

Current generator stability consumer scope:

- `pnpm saas check generators` reuses the same canonical schema, planner, and generator output
- committed golden fixtures capture the current supported generator scope only
- drift detection compares generated file paths and contents against the committed fixture tree
- `--update` is the explicit path for intentional fixture refreshes

Current apply consumer scope:

- `pnpm saas apply resource ... --target ...` reuses the same schema, planner, generator, and smoke validation before writing
- `pnpm saas install resource ...` reuses that flow for repo-root installation when the target runtime matches the supported seams
- apply stays explicit and target-scoped; preview generation remains the default
- the current safe patch surface is intentionally narrow and deterministic
- repo-root install currently supports domain exports, DB schema barrels, and one deterministic `apps/api/src/app.ts` route-registration seam
- unsupported central runtime files must fail closed rather than being guessed
