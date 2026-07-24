'use strict';
// sd0x-migration-test target=architecture-advice unit=architecture-advice/default
const { defineRoutingContractTests } = require('../scripts/skill-routing-test');
defineRoutingContractTests({
  "target": "architecture-advice",
  "targetPackage": "research-pack",
  "unit": "architecture-advice/default",
  "registry": [
    {
      "unit": "architecture-advice/default",
      "routing": {
        "positive_triggers": [
          "Compare architecture options for introducing an event bus in this codebase.",
          "Give an independent architecture second opinion on this proposed caching design.",
          "Recommend a component boundary for the billing integration with repository evidence."
        ],
        "negative_boundaries": [
          "Create the feature 3-architecture.md lifecycle document.",
          "Implement the selected architecture in production code.",
          "Write an implementation-ready technical specification and task breakdown."
        ]
      }
    }
  ],
  "routing": {
    "positive_triggers": [
      "Compare architecture options for introducing an event bus in this codebase.",
      "Give an independent architecture second opinion on this proposed caching design.",
      "Recommend a component boundary for the billing integration with repository evidence."
    ],
    "negative_boundaries": [
      "Create the feature 3-architecture.md lifecycle document.",
      "Implement the selected architecture in production code.",
      "Write an implementation-ready technical specification and task breakdown."
    ]
  }
});
