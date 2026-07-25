---
name: risk-assess
description: "Route risk-assess using exact migration registry [{\"unit\":\"risk-assess/default\",\"routing\":{\"negative_boundaries\":[\"Audit the repository against a named external engineering standard.\",\"Find concrete security vulnerabilities in this change.\",\"Review code correctness and maintainability as a merge gate.\"],\"positive_triggers\":[\"Assess the release and operational risk of this database migration.\",\"Estimate this change's blast radius, reversibility, and required mitigations.\",\"Score the implementation risk of the current diff with evidence.\"]}}]."
---

# Assess Change Risk

Estimate the delivery and operational risk of one bounded change from repository evidence.

## Protocol

1. Resolve the comparison base, changed files, runtime boundaries, data paths, deployment surface, and rollback mechanism.
2. Identify breaking API or schema changes, behavior shifts, dependency changes, concurrency hazards, migration needs, and security-sensitive paths.
3. Evaluate test evidence, observability, rollout controls, compatibility, blast radius, reversibility, and team familiarity.
4. Score likelihood and impact separately; explain every score with file, test, or operational evidence.
5. Model credible failure scenarios and the controls that prevent, detect, contain, and recover from them.
6. Return overall risk, confidence, release conditions, rollback requirements, and residual risks.

## Result

Report scope, risk dimensions, failure scenarios, mitigations, release recommendation, and unknowns.

<!-- sd0x-routing-contract:v1 unit=risk-assess/default -->
```json
{
  "positive_triggers": [
    "Assess the release and operational risk of this database migration.",
    "Estimate this change's blast radius, reversibility, and required mitigations.",
    "Score the implementation risk of the current diff with evidence."
  ],
  "negative_boundaries": [
    "Audit the repository against a named external engineering standard.",
    "Find concrete security vulnerabilities in this change.",
    "Review code correctness and maintainability as a merge gate."
  ]
}
```
