---
name: bump-version
description: "Synchronize the requested semantic version across authoritative package and plugin release metadata. Does not publish a release or modify unrelated fields."
---

# Bump Version

Synchronize the requested semantic version through the repository’s authoritative release mechanism. Preserve unrelated fields and user changes. A version update does not authorize publishing, tagging, committing or pushing.

## Resolve the release owner

Inspect the repository’s release scripts, package metadata and documented version invariants before editing. An existing release owner takes precedence over a generic file checklist. Explicit versions are validated by that owner; major, minor and patch follow the repository’s semantic-version rules. With no increment specified, default to patch unless project guidance defines another default.

For this sd0x-dev-flow-codex repository, the canonical owner is release.js in the repository-root scripts directory and its `setVersion` function, exposed by the `set-version` CLI operation. Its transaction updates `package.json`, the plugin manifest at `plugin/sd0x-dev-flow-codex/.codex-plugin/plugin.json`, the documented version in `docs/PROJECT-MIGRATION-GUIDE.md`, `migration/alias-capability.json` with the manifest fingerprint, and the bound alias owner request’s decision hash. The release owner validates the current release and revalidates the result; do not reproduce its transaction with independent file edits.

Respect release preconditions. In particular, pending migration units or a Completed alias owner can block the operation. Preserve completed evidence and establish the required successor owner through the documented workflow before retrying; do not rewrite a Completed request or bypass release checks to force a bump.

When another repository has no release owner, identify its actual authoritative version fields and derived metadata from repository evidence, then apply a consistent, bounded update with relevant validation. Do not assume sd0x-specific files exist there.

## Installation and reload

Do not create or edit installation/runtime state such as `.sd0x/install-state.json` as part of a source version update. There is no startup-sentinel requirement that justifies changing that file here. Installer state belongs to its owning installation workflow.

This repository’s plugin manifest change requires the complete repository-only reload: close the old Codex process, perform the `dev:local:unlink`, `dev:local:link` and `dev:local:status` npm scripts in that order, then restart Codex with CODEX_HOME pointing to this repository’s `.codex-dev-home` and begin a new task. Keep global Codex home unchanged. Linking an already-linked installation is idempotent and is not a refresh. Follow the reload matrix in `docs/PROJECT-MIGRATION-GUIDE.md`; source edits alone do not prove activation.

## Completion evidence

Confirm the requested version and all release-owner metadata invariants, preserve unrelated content, and complete the repository-required review and verification for the new fingerprint. Report the source changes, executed validation, release preconditions and any reload still pending. Do not claim publication or refreshed activation from a version field alone.

<!-- sd0x-routing-contract:v1 unit=bump-version/default -->
```json
{
  "positive_triggers": [
    "Apply the canonical bump-version workflow and report its evidence.",
    "Help me run the bump-version workflow for this repository.",
    "I need the canonical bump-version procedure with its safety boundaries."
  ],
  "negative_boundaries": [
    "Do not run bump-version; only execute deterministic repository verification.",
    "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
    "Only review the current code changes for correctness and defects."
  ]
}
```
