'use strict';
// sd0x-migration-test target=test-deep unit=test-deep/default
const { defineRoutingContractTests } = require('../scripts/skill-routing-test');
defineRoutingContractTests({
  "target": "test-deep",
  "targetPackage": "development-pack",
  "unit": "test-deep/default",
  "registry": [
    {
      "unit": "test-deep/default",
      "routing": {
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
    }
  ],
  "routing": {
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
});
