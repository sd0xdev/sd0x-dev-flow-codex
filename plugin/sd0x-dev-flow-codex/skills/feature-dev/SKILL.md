---
name: feature-dev
description: "Implement a coherent feature from its accepted scope through behavior-focused acceptance evidence and configured review/verification gates."
---

# Develop a Feature

Deliver the accepted capability from repository evidence through acceptance and fingerprint-bound gates. Understand relevant guidance, specifications, architecture boundaries, affected behavior and nearby tests; resolve material scope ambiguity before changing behavior.

Choose an implementation plan, edit batches and focused checks according to dependencies and risk. Preserve unrelated user changes and established architecture unless the accepted scope requires a change. Add behavior-focused tests for consequential success, failure and boundary cases; scale testing to the behavior and risk.

Complete the configured primary review, resolve actionable findings, then complete deterministic verification on the same final fingerprint. Any subsequent edit reopens required gates. Do not claim completion from a plan, summary or stale result.

Report delivered behavior, acceptance evidence, executed checks and material residual risk. The compatibility name `codex-implement` maps to this owner and does not create another entrypoint.

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
