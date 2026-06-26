# Extraction Manifest

`tools/extraction/manifest.ts` is a machine-readable advisory manifest for a
future SaaS boilerplate extraction.

What it does:

- records which paths are intended to copy into a future boilerplate
- records which paths must stay in the AuditTrail product repo
- records which paths need templating or explicit manual review

What it does not do:

- it does not copy files
- it does not modify the repo
- it does not mean extraction is currently supported

Rules for a future extraction script:

- fail closed on unknown or unclassified paths
- copy product-specific code only when the manifest explicitly marks it as a template replacement
- require manual review for mixed ownership, aggregated exports, migrations, docs, and deployment config
- preserve the platform boundary rule that `platform-core` and
  `platform-extension` code must remain free of AuditTrail product imports

Use `pnpm check:extraction-manifest` to validate the manifest structure only.
