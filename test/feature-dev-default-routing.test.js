'use strict';
// sd0x-migration-test target=feature-dev unit=feature-dev/default
const { defineRoutingContractTests } = require('../scripts/skill-routing-test');
defineRoutingContractTests({
  "target": "feature-dev",
  "targetPackage": "core",
  "unit": "feature-dev/default",
  "registry": [
    {
      "unit": "feature-dev/default",
      "routing": {
        "positive_triggers": [
          "Build the approved notification preference feature end to end.",
          "Extend the billing API with the specified refund behavior and tests.",
          "Implement this non-trivial capability from the technical specification."
        ],
        "negative_boundaries": [
          "Diagnose the failing refund test without implementing a correction.",
          "Generate focused tests for the existing billing behavior only.",
          "Review the notification preference diff without changing it."
        ]
      }
    }
  ],
  "routing": {
    "positive_triggers": [
      "Build the approved notification preference feature end to end.",
      "Extend the billing API with the specified refund behavior and tests.",
      "Implement this non-trivial capability from the technical specification."
    ],
    "negative_boundaries": [
      "Diagnose the failing refund test without implementing a correction.",
      "Generate focused tests for the existing billing behavior only.",
      "Review the notification preference diff without changing it."
    ]
  }
});
