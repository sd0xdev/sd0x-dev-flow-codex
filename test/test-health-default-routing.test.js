'use strict';
// sd0x-migration-test target=test-health unit=test-health/default
const { defineRoutingContractTests } = require('../scripts/skill-routing-test');
defineRoutingContractTests({
  "target": "test-health",
  "targetPackage": "quality-pack",
  "unit": "test-health/default",
  "registry": [
    {
      "unit": "test-health/default",
      "routing": {
        "negative_boundaries": [
          "Analyze coverage gaps for one specific feature request.",
          "Generate new tests for this uncovered behavior.",
          "Review these tests line by line for assertion quality and acceptance traceability."
        ],
        "positive_triggers": [
          "Analyze test artifacts and flaky patterns to produce a test-health report.",
          "Assess the overall health, reliability, speed, and maintainability of this test system.",
          "Measure test-layer balance, coverage evidence, and suite quality across the repository."
        ]
      }
    }
  ],
  "routing": {
    "positive_triggers": [
      "Analyze test artifacts and flaky patterns to produce a test-health report.",
      "Assess the overall health, reliability, speed, and maintainability of this test system.",
      "Measure test-layer balance, coverage evidence, and suite quality across the repository."
    ],
    "negative_boundaries": [
      "Analyze coverage gaps for one specific feature request.",
      "Generate new tests for this uncovered behavior.",
      "Review these tests line by line for assertion quality and acceptance traceability."
    ]
  }
});
