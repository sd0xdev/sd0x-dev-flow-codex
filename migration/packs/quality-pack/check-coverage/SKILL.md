---
name: check-coverage
description: "Route check-coverage using exact migration registry [{\"unit\":\"check-coverage/default\",\"routing\":{\"negative_boundaries\":[\"Add the missing unit and integration tests now.\",\"Judge whether these individual tests are well written and non-flaky.\",\"Run the repository verification gate and record its evidence.\"],\"positive_triggers\":[\"Analyze unit, integration, and end-to-end coverage gaps for the refund feature.\",\"Map this feature's source branches to existing tests and identify missing cases.\",\"Review the three-layer test coverage for the authentication request.\"]}}]."
---

# Analyze Test Coverage

Assess unit, integration, and end-to-end coverage for one feature without changing tests.

## Protocol

1. Read the feature request or specification and extract flows, invariants, boundaries, and failure behavior.
2. Build a source inventory from entrypoints through meaningful branches and external boundaries.
3. Map existing tests to source behavior and classify each by layer. Treat filenames and aggregate percentages as hints, not proof.
4. Inspect assertions, fixtures, mocks, negative cases, concurrency, persistence, and integration seams.
5. Read coverage artifacts when present and fresh; report tool, timestamp, scope, and missing branch detail. Never fabricate percentages.
6. Rank gaps as critical, major, or minor and recommend the smallest tests that prove the missing behavior.

## Result

Return the feature scope, layer matrix, artifact evidence, uncovered behaviors with file locations, and a prioritized test plan.

<!-- sd0x-routing-contract:v1 unit=check-coverage/default -->
```json
{
  "positive_triggers": [
    "Analyze unit, integration, and end-to-end coverage gaps for the refund feature.",
    "Map this feature's source branches to existing tests and identify missing cases.",
    "Review the three-layer test coverage for the authentication request."
  ],
  "negative_boundaries": [
    "Add the missing unit and integration tests now.",
    "Judge whether these individual tests are well written and non-flaky.",
    "Run the repository verification gate and record its evidence."
  ]
}
```
