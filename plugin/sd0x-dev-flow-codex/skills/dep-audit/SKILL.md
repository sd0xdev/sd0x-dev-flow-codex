---
name: dep-audit
description: "Route dep-audit using exact migration registry [{\"unit\":\"dep-audit/default\",\"routing\":{\"negative_boundaries\":[\"Bump the package version for the next release.\",\"Implement the recommended dependency upgrades and regenerate lockfiles.\",\"Review application code correctness without focusing on dependencies.\"],\"positive_triggers\":[\"Audit all locked dependencies for current advisories and maintenance risk.\",\"Inspect this repository's dependency graph for vulnerable or abandoned packages.\",\"Review manifest and lockfile health without changing package versions.\"]}}]."
---

# Audit Dependencies

Inspect manifests and lockfiles for security, freshness, provenance, and maintenance risks without changing dependency state.

## Protocol

1. Identify every package ecosystem, workspace boundary, manifest, lockfile, runtime dependency, and tool-only dependency.
2. Bind findings to exact resolved versions from lockfiles; separate direct, transitive, optional, peer, and development dependencies.
3. Consult current official advisory databases and upstream release or support policies. Cite authoritative sources and record lookup time.
4. Check unpinned sources, duplicate versions, abandoned packages, unsupported runtimes, license concerns, and install-script exposure.
5. Assess exploitability in repository context instead of equating an advisory match with impact.
6. Produce an ordered remediation plan with compatible target versions, breaking-change risks, and verification steps.

## Boundaries

Do not install, update, remove, or lock dependencies. Do not execute package lifecycle scripts.

## Result

Report inventories, current advisory evidence, contextual risk, confidence, and a no-mutation remediation plan.

<!-- sd0x-routing-contract:v1 unit=dep-audit/default -->
```json
{
  "positive_triggers": [
    "Audit all locked dependencies for current advisories and maintenance risk.",
    "Inspect this repository's dependency graph for vulnerable or abandoned packages.",
    "Review manifest and lockfile health without changing package versions."
  ],
  "negative_boundaries": [
    "Bump the package version for the next release.",
    "Implement the recommended dependency upgrades and regenerate lockfiles.",
    "Review application code correctness without focusing on dependencies."
  ]
}
```
