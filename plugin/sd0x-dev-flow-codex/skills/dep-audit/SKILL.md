---
name: dep-audit
description: "Audit exact resolved dependencies for current security, provenance and maintenance risks. Contextualizes advisories without installing or changing dependencies."
---

# Audit Dependencies

Inspect the requested package ecosystems, workspace boundaries, manifests and lockfiles for security, provenance, freshness and maintenance risks. Bind findings to exact resolved versions and distinguish direct, transitive, optional, peer and development dependencies.

Consult current official advisory databases and upstream release/support policies, citing sources and lookup time. Assess exploitability in repository context; advisory matches alone do not prove impact. Include relevant unpinned sources, unsupported runtimes, duplicate versions, maintenance gaps, license concerns and install-script exposure.

Do not install, update, remove or lock dependencies, or execute package lifecycle scripts. Return the evidence-backed risks and an ordered remediation proposal with compatible target versions, breaking-change risks and verification needs.

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
