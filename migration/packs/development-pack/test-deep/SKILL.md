---
name: test-deep
description: "Route test-deep using exact migration registry [{\"unit\":\"test-deep/default\",\"routing\":{\"positive_triggers\":[\"Build a risk-led test matrix for this cross-service change and execute it progressively.\",\"Investigate these test failures across unit, integration, and end-to-end layers.\",\"Run deep context-aware testing for this change and triage every unresolved failure.\"],\"negative_boundaries\":[\"Generate a missing unit test for one known function.\",\"Record the authoritative repository verification gate for this fingerprint.\",\"Run only the focused tests for the feature I just implemented.\"]}}]."
---

# Deep Test Investigation

Build and carry out a risk-led test strategy across affected layers, then triage every unresolved failure with reproducible evidence.

## Protocol

1. Inspect the change surface, dependency graph, test configuration, package scripts, and existing coverage.
2. Build a compact risk matrix covering changed behavior, shared boundaries, failure modes, persistence, concurrency, and external seams that are actually in scope.
3. Select tests from the risk matrix. Start with the fastest discriminating checks, then progress through broader unit, integration, and end-to-end layers.
4. Record every command, exit status, selected scope, skipped layer, and concise failure signature. Redact secrets before retaining or summarizing output.
5. Triage failures into code regression, test defect, environment gap, flaky behavior, or inconclusive evidence. Validate classifications against repository evidence.
6. Retry only when it distinguishes flakiness from determinism. Do not alter production files or claim the authoritative verification gate.
7. Stop when each material risk has passing evidence, a reproducible failure, or an explicit untested gap.

## Result

Return the risk matrix, selection rationale, per-layer results, failure triage, unresolved gaps, and recommended next bounded action.

## Pack handoff

This payload is development-pack-ready source material. It stays outside core discovery and is not published from this repository.

<!-- sd0x-routing-contract:v1 unit=test-deep/default -->
```json
{
  "positive_triggers": [
    "Build a risk-led test matrix for this cross-service change and execute it progressively.",
    "Investigate these test failures across unit, integration, and end-to-end layers.",
    "Run deep context-aware testing for this change and triage every unresolved failure."
  ],
  "negative_boundaries": [
    "Generate a missing unit test for one known function.",
    "Record the authoritative repository verification gate for this fingerprint.",
    "Run only the focused tests for the feature I just implemented."
  ]
}
```
