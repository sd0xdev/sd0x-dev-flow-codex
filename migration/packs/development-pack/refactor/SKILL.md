---
name: refactor
description: "Route refactor using exact migration registry [{\"unit\":\"refactor/default\",\"routing\":{\"positive_triggers\":[\"Refactor the billing module structure while preserving all external behavior.\",\"Restructure these related files around one responsibility with baseline and regression checks.\",\"Transform this implementation to remove coupling without adding features.\"],\"negative_boundaries\":[\"Fix the incorrect billing result and add a regression test.\",\"Implement a new billing workflow from the approved specification.\",\"Simplify this one small function by removing incidental nesting.\"]}}]."
---

# Refactor with Behavioral Proof

Improve one named structural concern while preserving externally observable behavior.

## Protocol

1. Validate the repository-relative target and inspect its callers, dependencies, tests, and guidance.
2. State the structural problem, affected boundary, behavior invariants, excluded cleanup, and rollback point.
3. Establish a focused baseline with the repository's existing checks. If the baseline fails, separate that evidence from any proposed refactor.
4. Transform the smallest coherent slice. Keep compatibility surfaces stable and avoid new product behavior.
5. Repeat the baseline after each slice, then complete proportionate broader checks for affected integrations.
6. Inspect the final diff for hidden behavior change, dependency expansion, test weakening, or unrelated churn.
7. Complete the repository-required review and verification gates before claiming completion.

## Result

Report the structural concern, preserved invariants, changed boundaries, baseline/post-change evidence, and any unverified behavior.

## Pack handoff

This payload is development-pack-ready source material. It stays outside core discovery and is not published from this repository.

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
