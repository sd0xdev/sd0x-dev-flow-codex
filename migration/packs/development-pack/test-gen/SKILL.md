---
name: test-gen
description: "Route test-gen using exact migration registry [{\"unit\":\"test-gen/default\",\"routing\":{\"positive_triggers\":[\"Add focused regression tests for this uncovered parser behavior.\",\"Generate tests for the new refund service using the repository conventions.\",\"Write missing happy-path, error, and edge-case tests for this method.\"],\"negative_boundaries\":[\"Implement the refund service behavior before tests exist.\",\"Run the existing test suite and report its failures.\",\"Trace the root cause of the current parser regression without writing tests.\"]}}]."
---

# Generate Focused Tests

Add behavior-focused tests for an identified coverage gap using the repository's existing conventions and executable evidence.

## Protocol

1. Inspect the target behavior, public contract, callers, nearby tests, fixtures, and configured test commands.
2. State the uncovered behavior and select the narrowest appropriate test layer. Prefer observable outcomes over private implementation details.
3. Design cases for the successful path, meaningful errors, and boundary conditions that could regress. Avoid redundant cases that add no distinct proof.
4. Add tests in the repository's established location and style. Reuse safe helpers and isolate external state.
5. Start with the new tests directly, then continue with the nearest affected suite. Record the exact commands and exit statuses.
6. If the implementation itself is incorrect, stop and report the discrepancy instead of weakening expectations to fit current output.

## Result

Report the coverage gap, cases added, files changed, commands executed, results, and any remaining risk.

The compatibility source name `codex-test-gen` maps to this canonical owner and does not create another entrypoint.

## Pack handoff

This payload is development-pack-ready source material. It stays outside core discovery and is not published from this repository.

<!-- sd0x-routing-contract:v1 unit=test-gen/default -->
```json
{
  "positive_triggers": [
    "Add focused regression tests for this uncovered parser behavior.",
    "Generate tests for the new refund service using the repository conventions.",
    "Write missing happy-path, error, and edge-case tests for this method."
  ],
  "negative_boundaries": [
    "Implement the refund service behavior before tests exist.",
    "Run the existing test suite and report its failures.",
    "Trace the root cause of the current parser regression without writing tests."
  ]
}
```
