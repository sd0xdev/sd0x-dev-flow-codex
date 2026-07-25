'use strict';
// sd0x-migration-test target=test-review unit=test-review/default
const { defineRoutingContractTests } = require('../scripts/skill-routing-test');
defineRoutingContractTests({
  "target": "test-review",
  "targetPackage": "quality-pack",
  "unit": "test-review/default",
  "registry": [
    {
      "unit": "test-review/default",
      "routing": {
        "negative_boundaries": [
          "Assess the health of every test suite and coverage artifact in the repository.",
          "Create the missing tests and modify the test files.",
          "Execute the deterministic repository verification gate."
        ],
        "positive_triggers": [
          "Check whether these tests sufficiently prove the refund behavior and acceptance criteria.",
          "Review the selected tests for weak assertions, missing boundaries, and flakiness.",
          "Trace this request's acceptance criteria to source branches and test evidence."
        ]
      }
    }
  ],
  "routing": {
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
});
