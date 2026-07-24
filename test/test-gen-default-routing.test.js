'use strict';
// sd0x-migration-test target=test-gen unit=test-gen/default
const { defineRoutingContractTests } = require('../scripts/skill-routing-test');
defineRoutingContractTests({
  "target": "test-gen",
  "targetPackage": "development-pack",
  "unit": "test-gen/default",
  "registry": [
    {
      "unit": "test-gen/default",
      "routing": {
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
    }
  ],
  "routing": {
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
});
