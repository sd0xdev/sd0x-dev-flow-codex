---
name: post-dev-test
description: "Route post-dev-test using exact migration registry [{\"unit\":\"post-dev-test/default\",\"routing\":{\"positive_triggers\":[\"Run the appropriate repository tests for the feature I just implemented.\",\"Test the completed API change with focused checks before broader suites.\",\"Validate this working-tree change with developer-facing test execution and exact failures.\"],\"negative_boundaries\":[\"Create missing tests for an untested parser behavior.\",\"Record the authoritative repository verification gate for this fingerprint.\",\"Run a risk-led deep investigation across every test layer and triage failures.\"]}}]."
---

# Test Completed Development Work

Select repository-native tests after an implementation change and collect their results. The result is developer feedback and does not record the formal verification gate.

## Protocol

1. Inspect the changed paths, repository guidance, package scripts, test configuration, and neighboring tests.
2. Map changed behavior to the smallest relevant test targets. Escalate when configuration, shared infrastructure, or cross-boundary behavior broadens risk.
3. Begin with focused tests using the repository's declared commands and environment. Preserve exact command, exit status, and concise failure output.
4. If focused checks pass, continue with the next proportionate layer or suite. Do not silently substitute an unrelated command when the configured one is unavailable.
5. Classify failures as implementation regressions, test defects, environment gaps, or inconclusive evidence. Do not mutate production code as part of this workflow.
6. Report passed coverage, failures, skipped layers, and the next bounded action. Formal completion still requires the repository's review and verify workflow.

## Pack handoff

This payload is development-pack-ready source material. It stays outside core discovery and is not published from this repository.

<!-- sd0x-routing-contract:v1 unit=post-dev-test/default -->
```json
{
  "positive_triggers": [
    "Run the appropriate repository tests for the feature I just implemented.",
    "Test the completed API change with focused checks before broader suites.",
    "Validate this working-tree change with developer-facing test execution and exact failures."
  ],
  "negative_boundaries": [
    "Create missing tests for an untested parser behavior.",
    "Record the authoritative repository verification gate for this fingerprint.",
    "Run a risk-led deep investigation across every test layer and triage failures."
  ]
}
```
