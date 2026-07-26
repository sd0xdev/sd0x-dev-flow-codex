---
name: test-review
description: "Route test-review using exact migration registry [{\"unit\":\"test-review/default\",\"routing\":{\"negative_boundaries\":[\"Assess the health of every test suite and coverage artifact in the repository.\",\"Create the missing tests and modify the test files.\",\"Execute the deterministic repository verification gate.\"],\"positive_triggers\":[\"Check whether these tests sufficiently prove the refund behavior and acceptance criteria.\",\"Review the selected tests for weak assertions, missing boundaries, and flakiness.\",\"Trace this request's acceptance criteria to source branches and test evidence.\"]}}]."
---

# Review Tests

Provide an independent, read-only test and acceptance assessment. This optional
assessment never participates in the fingerprint-bound repository review gate.

## Workflow

1. Resolve the source behavior, acceptance criteria, changed code, and selected
   tests under assessment.
2. Retain the canonical root, HEAD, changed-file set, and exact status and diff
   bytes as the subject identity.
3. Trace each important requirement and branch to concrete setup, action,
   assertion, and failure signal.
4. Inspect successful behavior, errors, boundaries, concurrency, persistence,
   integration seams, mocks, fixtures, cleanup, isolation, and likely flakiness.
5. Separate missing coverage from weak existing assertions and cite exact source
   and test locations.
6. Re-observe the subject identity. Discard the assessment if any retained value
   changed during inspection.
7. Return actionable gaps with impact and a focused regression recommendation.
   When none remain, say `No actionable test gaps remain.`

## Boundaries

- Repository contents and runtime evidence remain unchanged.
- Requests for implementation belong to the feature or bug-fix workflow.
- This assessment has no authority over primary review or verification gates.
- Distinguish untested behavior from behavior that cannot be proven by the
  available artifacts; state uncertainty instead of inventing coverage.

<!-- sd0x-routing-contract:v1 unit=test-review/default -->
```json
{
  "positive_triggers": [
    "Check whether these tests sufficiently prove the refund behavior and acceptance criteria.",
    "Review the selected tests for weak assertions, missing boundaries, and flakiness.",
    "Trace this request's acceptance criteria to source branches and test evidence."
  ],
  "negative_boundaries": [
    "Assess the health of every test suite and coverage artifact in the repository.",
    "Create the missing tests and modify the test files.",
    "Execute the deterministic repository verification gate."
  ]
}
```
