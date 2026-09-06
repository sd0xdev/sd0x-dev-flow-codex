---
name: refactor
description: "Improve a named structural concern while preserving observable behavior and compatibility. Establish regression evidence and complete required review and verification."
---

# Refactor with Behavioral Proof

Improve one named structural concern while preserving externally observable behavior.

## Protocol

1. Validate the repository-relative target and inspect its callers, dependencies, tests, and guidance.
2. State the structural problem, affected boundary, behavior invariants, excluded cleanup, and rollback point.
3. Establish a focused baseline with the repository's existing checks. If the baseline fails, separate that evidence from any proposed refactor.
4. Choose coherent edit batches that preserve compatibility surfaces and avoid new product behavior.
5. Focused checks are appropriate when they discriminate regressions in the chosen batch, reuse valid baseline evidence, and validate affected integrations proportionately.
6. Inspect the final diff for hidden behavior change, dependency expansion, test weakening, or unrelated churn.
7. Complete the repository-required review and verification gates before claiming completion.

## Result

Report the structural concern, preserved invariants, changed boundaries, baseline/post-change evidence, and any unverified behavior.

## Pack handoff

This canonical skill is distributed from the core plugin. Its legacy development-pack payload remains immutable migration provenance and is not a runtime routing surface.

<!-- sd0x-routing-contract:v1 unit=refactor/default -->
```json
{
  "positive_triggers": [
    "Refactor the billing module structure while preserving all external behavior.",
    "Restructure these related files around one responsibility with baseline and regression checks.",
    "Transform this implementation to remove coupling without adding features."
  ],
  "negative_boundaries": [
    "Fix the incorrect billing result and add a regression test.",
    "Implement a new billing workflow from the approved specification.",
    "Simplify this one small function by removing incidental nesting."
  ]
}
```
