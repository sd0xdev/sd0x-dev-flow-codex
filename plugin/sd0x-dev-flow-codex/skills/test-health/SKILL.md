---
name: test-health
description: "Route test-health using exact migration registry [{\"unit\":\"test-health/default\",\"routing\":{\"negative_boundaries\":[\"Analyze coverage gaps for one specific feature request.\",\"Generate new tests for this uncovered behavior.\",\"Review these tests line by line for assertion quality and acceptance traceability.\"],\"positive_triggers\":[\"Analyze test artifacts and flaky patterns to produce a test-health report.\",\"Assess the overall health, reliability, speed, and maintainability of this test system.\",\"Measure test-layer balance, coverage evidence, and suite quality across the repository.\"]}}]."
---

# Assess Test-System Health

Measure the reliability, maintainability, speed, coverage evidence, and layer balance of a repository's test system.

## Protocol

1. Detect test frameworks, declared commands, project boundaries, fixtures, coverage tools, and CI execution paths.
2. Inventory unit, integration, end-to-end, contract, performance, and smoke tests using framework semantics rather than filenames alone.
3. Read available test and coverage artifacts; report format, tool, scope, timestamp, freshness, and parse limitations.
4. Inspect flaky-test signals, retries, sleeps, shared state, nondeterministic inputs, oversized fixtures, weak assertions, and slow suites.
5. Compare historical snapshots only when compatible evidence is supplied. Never invent trends from a single run.
6. Return health dimensions, confidence, high-risk weaknesses, and a prioritized improvement plan.

## Result

Report framework inventory, layer balance, artifact metrics, reliability and maintainability findings, trends if proven, and unknowns.

<!-- sd0x-routing-contract:v1 unit=test-health/default -->
```json
{
  "positive_triggers": [
    "Analyze test artifacts and flaky patterns to produce a test-health report.",
    "Assess the overall health, reliability, speed, and maintainability of this test system.",
    "Measure test-layer balance, coverage evidence, and suite quality across the repository."
  ],
  "negative_boundaries": [
    "Analyze coverage gaps for one specific feature request.",
    "Generate new tests for this uncovered behavior.",
    "Review these tests line by line for assertion quality and acceptance traceability."
  ]
}
```
