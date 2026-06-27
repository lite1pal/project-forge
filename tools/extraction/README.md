# Extraction Tooling

`tools/extraction/manifest.ts` is a machine-readable advisory manifest for a
future SaaS boilerplate extraction.

`tools/extraction/dry-run.ts` is the read-only planner that validates the
current repo tree against that manifest and prints what a future extraction
would copy, exclude, template, or stop for manual review.

`tools/extraction/extract.ts` is the local-only output writer. It reuses the
same planner and can write a candidate boilerplate tree under an ignored
directory such as `.generated/saas-boilerplate/`.

What it does:

- records which paths are intended to copy into a future boilerplate
- records which paths must stay in the AuditTrail product repo
- records which paths need templating or explicit manual review
- prints a deterministic dry-run plan without copying files

What it does not do:

- it does not mean extraction is currently supported
- it does not publish a package or create a separate repo
- it does not treat the generated directory as a finished boilerplate

Commands:

```bash
pnpm check:extraction-manifest
pnpm check:extraction
pnpm extract:boilerplate
pnpm check:extraction:placeholder
pnpm test:extraction
```

Rules for a future extraction script:

- fail closed on unknown or unclassified paths
- copy product-specific code only when the manifest explicitly marks it as a template replacement
- require manual review for mixed ownership, aggregated exports, migrations, docs, and deployment config
- preserve the platform boundary rule that `platform-core` and
  `platform-extension` code must remain free of AuditTrail product imports

`pnpm extract:boilerplate` writes local output only. Current behavior:

- runs the same fail-closed planner logic before writing
- writes to `.generated/saas-boilerplate/` by default
- removes the target directory first unless `--no-clean` is passed
- copies only `copy` files
- writes minimal placeholder stubs for `template` files
- omits `exclude` and `manual-review` files from the generated tree
- writes `EXTRACTION_README.md` and `extraction-report.json` into the output

`pnpm check:extraction:placeholder` is the current scaffold-validation step.
It reuses the local extraction output generator, writes a tiny placeholder
product fixture into the generated candidate, and then checks:

- the placeholder product config still satisfies the generic product schema
- the generated candidate contains the expected generic scaffold files
- the placeholder wiring does not import AuditTrail-specific modules or use
  AuditTrail-owned path names

What it proves:

- the current extracted candidate has the generic product-definition,
  onboarding, and shell seams needed for a minimal placeholder product
- a placeholder product can be layered onto the generated candidate without
  importing `@auditrail/domain/audit-events` or other `audit-product` modules

What it does not prove yet:

- it does not typecheck or build the generated candidate as a standalone repo
- it does not prove every `apps/web/app/**` composition file is extraction-ready
- it does not remove the remaining manual-review paths from the generated report

Current limitations:

- manual-review files still block any claim that the generated output is a
  reusable published boilerplate
- the placeholder overlay is a validation fixture only; it is not a real second
  product and does not change AuditTrail runtime behavior

Optional flags:

```bash
pnpm extract:boilerplate -- --no-clean
pnpm extract:boilerplate -- --output .generated/custom-boilerplate
```

Output safety policy:

- output must stay inside the current repo
- output must live under `.generated/` or `tmp/`
- output generation fails before writing if the dry-run planner reports any
  unknown, conflicting, unmatched-required, or product-copy leak error
- product-specific files are never copied unless they are explicitly classified
  as templates

`pnpm check:extraction-manifest` validates manifest structure only.

`pnpm check:extraction` runs the dry-run planner. It fails when:

- a required manifest entry matches nothing
- one file resolves to conflicting primary actions without the explicit template-over-exclude rule
- a tracked file under the monitored app, package, tool, or docs roots is unclassified
- a product-specific path leaks into the boilerplate copy set

The generated output is intentionally incomplete while manual-review files
still exist. Treat `extraction-report.json` as the source of truth for what was
copied, templated, excluded, or still requires explicit follow-up.

Current `packages/db/src` posture:

- reusable schema files such as `schema/identity.ts`, `schema/billing.ts`, and
  `schema/jobs.ts` are now classified explicitly
- most migrations now have explicit copy ownership
- the DB barrels and the initial mixed audit-event migration remain templated
  rather than copied blindly
- only the remaining unmatched migration history or audit-event schema files
  should stay in manual review
