---
name: project-audit
description: "Route project-audit using exact migration registry [{\"unit\":\"project-audit/default\",\"routing\":{\"negative_boundaries\":[\"Assess only the security properties of this code change.\",\"Check whether this feature has enough unit and integration coverage.\",\"Review this branch specifically for pull-request readiness.\"],\"positive_triggers\":[\"Assess this repository's overall engineering and open-source health.\",\"Audit project robustness, maintainability, testing, documentation, and release readiness.\",\"Produce a scored repository health report with prioritized improvements.\"]}}]."
---

# Audit Repository Health

Evaluate one repository across maintainability, robustness, operability, security hygiene, testing, documentation, and open-source readiness.

## Protocol

1. Detect ecosystems, repository boundaries, generated and vendored content, and declared project guidance.
2. Inventory build, test, lint, release, CI, ownership, license, contribution, security, and operational artifacts.
3. Inspect representative implementation and test paths; do not score solely from file presence.
4. Prefer deterministic read-only probes already declared by the project when execution is appropriate.
5. Mark checks applicable, not applicable, passing, partial, failing, or unknown and preserve the evidence for each judgment.
6. Produce dimension scores, critical blockers, quick wins, and a dependency-ordered improvement roadmap.

## Result

Report detected context, evidence table, dimension scores with confidence, top risks, and prioritized improvements.

<!-- sd0x-routing-contract:v1 unit=project-audit/default -->
```json
{
  "positive_triggers": [
    "Assess this repository's overall engineering and open-source health.",
    "Audit project robustness, maintainability, testing, documentation, and release readiness.",
    "Produce a scored repository health report with prioritized improvements."
  ],
  "negative_boundaries": [
    "Assess only the security properties of this code change.",
    "Check whether this feature has enough unit and integration coverage.",
    "Review this branch specifically for pull-request readiness."
  ]
}
```
