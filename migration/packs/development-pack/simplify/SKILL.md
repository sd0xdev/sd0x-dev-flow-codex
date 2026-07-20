---
name: simplify
description: "Route simplify using exact migration registry [{\"unit\":\"simplify/default\",\"routing\":{\"positive_triggers\":[\"Reduce duplication in this single helper without changing its behavior.\",\"Simplify this small function by flattening unnecessary nesting.\",\"Streamline the named code path with the smallest behavior-preserving edit.\"],\"negative_boundaries\":[\"Design a replacement architecture for the entire billing subsystem.\",\"Implement a new helper capability and expose it through the API.\",\"Refactor several modules around a new responsibility boundary.\"]}}]."
---

# Simplify a Bounded Code Path

Remove incidental complexity from one well-defined target while preserving its intended behavior.

## Protocol

1. Inspect the target, callers, tests, and repository conventions. Name the exact complexity to remove.
2. Record behavior invariants and capture the smallest reliable baseline. Do not mix existing failures with simplification results.
3. Prefer deletion, direct control flow, existing abstractions, and local deduplication over new layers.
4. Keep the edit small enough to review as one behavior-preserving change. Exclude new features, architecture replacement, and unrelated cleanup.
5. Repeat the same focused checks after the change, then any proportionate checks required by affected callers.
6. Review the diff for altered error behavior, ordering, state, public interfaces, or weakened tests.

## Result

Report the removed complexity, preserved invariants, changed files, before/after evidence, and residual uncertainty.

## Pack handoff

This payload is development-pack-ready source material. It stays outside core discovery and is not published from this repository.

<!-- sd0x-routing-contract:v1 unit=simplify/default -->
```json
{
  "positive_triggers": [
    "Reduce duplication in this single helper without changing its behavior.",
    "Simplify this small function by flattening unnecessary nesting.",
    "Streamline the named code path with the smallest behavior-preserving edit."
  ],
  "negative_boundaries": [
    "Design a replacement architecture for the entire billing subsystem.",
    "Implement a new helper capability and expose it through the API.",
    "Refactor several modules around a new responsibility boundary."
  ]
}
```
