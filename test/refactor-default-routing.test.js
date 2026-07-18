'use strict';
// sd0x-migration-test target=refactor unit=refactor/default
const { defineRoutingContractTests } = require('../scripts/skill-routing-test');
defineRoutingContractTests({
  "target": "refactor",
  "targetPackage": "development-pack",
  "unit": "refactor/default",
  "registry": [
    {
      "unit": "refactor/default",
      "routing": {
        "positive_triggers": [
          "Refactor the billing module structure while preserving all external behavior.",
          "Restructure these related files around one responsibility with baseline and regression checks.",
          "Transform this implementation to remove coupling without adding features."
        ],
        "negative_boundaries": [
          "Fix the incorrect billing result and add a regression test.",
          "Implement a new billing workflow from the approved specification.",
          "Simplify this one small function by removing incidental nesting."
        ]
      }
    }
  ],
  "routing": {
    "positive_triggers": [
      "Refactor the billing module structure while preserving all external behavior.",
      "Restructure these related files around one responsibility with baseline and regression checks.",
      "Transform this implementation to remove coupling without adding features."
    ],
    "negative_boundaries": [
      "Fix the incorrect billing result and add a regression test.",
      "Implement a new billing workflow from the approved specification.",
      "Simplify this one small function by removing incidental nesting."
    ]
  }
});
