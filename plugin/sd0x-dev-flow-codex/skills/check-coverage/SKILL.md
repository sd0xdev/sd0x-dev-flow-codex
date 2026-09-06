---
name: check-coverage
description: "Map a feature’s behaviors and failure boundaries to existing unit, integration and end-to-end tests. Produces an evidence-backed gap analysis without editing tests."
---

# Analyze Test Coverage

Assess unit, integration and end-to-end coverage for the requested feature without modifying tests. Derive important flows, invariants, failure behavior and boundaries from its specification and source.

Map existing assertions, fixtures and mocks to the behaviors they prove, including meaningful concurrency, persistence and external integration seams. Filenames and aggregate percentages are hints, not coverage proof.

Consult coverage artifacts only when their tool, time and scope support the assessment; never fabricate percentages. Rank uncovered behaviors as critical, major or minor and propose the smallest meaningful tests that close them.

Return feature scope, behavior-to-test evidence, missing coverage and priorities. Choose the inspection order and report format to fit the feature.

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
