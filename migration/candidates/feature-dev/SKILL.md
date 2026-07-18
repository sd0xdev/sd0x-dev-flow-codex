---
name: feature-dev
description: "Route feature-dev using exact migration registry [{\"unit\":\"feature-dev/default\",\"routing\":{\"positive_triggers\":[\"Build the approved notification preference feature end to end.\",\"Extend the billing API with the specified refund behavior and tests.\",\"Implement this non-trivial capability from the technical specification.\"],\"negative_boundaries\":[\"Diagnose the failing refund test without implementing a correction.\",\"Generate focused tests for the existing billing behavior only.\",\"Review the notification preference diff without changing it.\"]}}]."
---

# Develop a Feature

Deliver one coherent capability from repository evidence through acceptance and fingerprint-bound gates.

## Workflow

1. Read repository guidance, the approved request or specification, the affected execution path, and nearby tests. Resolve material scope ambiguity before changing behavior.
2. State the in-scope behavior, explicit acceptance criteria, dependencies, risks, and the smallest dependency-ordered implementation plan.
3. Implement one logical slice at a time. Inspect each diff, preserve unrelated user changes, and follow existing architecture unless the accepted scope requires a documented change.
4. Add or update behavior-focused tests for successful, failure, and meaningful boundary cases. Keep test design proportional to risk.
5. Complete focused checks after each slice and the repository-defined deterministic checks after integration.
6. Complete the sd0x review workflow until both configured independent perspectives are clean, then complete deterministic verification. Any fix creates a new fingerprint and requires review again.

## Boundaries and result

The compatibility source name `codex-implement` maps to this canonical owner and does not create another entrypoint. Report delivered behavior, acceptance evidence, changed files, executed checks, and genuine residual risks.

<!-- sd0x-routing-contract:v1 unit=feature-dev/default -->
```json
{
  "positive_triggers": [
    "Build the approved notification preference feature end to end.",
    "Extend the billing API with the specified refund behavior and tests.",
    "Implement this non-trivial capability from the technical specification."
  ],
  "negative_boundaries": [
    "Diagnose the failing refund test without implementing a correction.",
    "Generate focused tests for the existing billing behavior only.",
    "Review the notification preference diff without changing it."
  ]
}
```
