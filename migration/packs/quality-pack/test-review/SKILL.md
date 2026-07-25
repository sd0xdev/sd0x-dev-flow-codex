---
name: test-review
description: "Route test-review using exact migration registry [{\"unit\":\"test-review/default\",\"routing\":{\"negative_boundaries\":[\"Assess the health of every test suite and coverage artifact in the repository.\",\"Create the missing tests and modify the test files.\",\"Execute the deterministic repository verification gate.\"],\"positive_triggers\":[\"Check whether these tests sufficiently prove the refund behavior and acceptance criteria.\",\"Review the selected tests for weak assertions, missing boundaries, and flakiness.\",\"Trace this request's acceptance criteria to source branches and test evidence.\"]}}]."
---

# Review Tests

Judge whether selected tests prove the intended behavior and remain reliable and maintainable.

## Protocol

1. Resolve the source behavior, acceptance criteria, changed code, and test files under review.
2. Trace each important requirement and branch to concrete test setup, action, assertion, and failure signal.
3. Inspect happy paths, errors, boundaries, concurrency, persistence, integration seams, mocks, fixtures, cleanup, and isolation.
4. Identify assertions that can pass for the wrong reason, over-mocking, implementation coupling, nondeterminism, hidden order dependence, and missing negative cases.
5. Separate missing coverage from weak existing tests and cite exact source and test locations.
6. Return `SUFFICIENT` or `NEEDS ADDITIONS`, confidence, blocking gaps, and focused test recommendations.

## Result

Report acceptance traceability, quality dimensions, findings, missing cases, flakiness risks, and the sufficiency gate.

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
