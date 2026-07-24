'use strict';
// sd0x-migration-test target=architecture unit=architecture/default
const { defineRoutingContractTests } = require('../scripts/skill-routing-test');
defineRoutingContractTests({
  "target": "architecture",
  "targetPackage": "planning-pack",
  "unit": "architecture/default",
  "registry": [
    {
      "unit": "architecture/default",
      "routing": {
        "positive_triggers": [
          "Create a 3-architecture.md component and data-flow design from the approved technical specification.",
          "Document component responsibilities, integration points, and architecture decisions for the billing feature.",
          "Update the existing feature architecture document after repository boundaries changed."
        ],
        "negative_boundaries": [
          "Analyze the product problem and write feature-wide requirements.",
          "Implement the approved architecture and modify production code.",
          "Write a feature-level technical specification with work breakdown and test strategy."
        ]
      }
    }
  ],
  "routing": {
    "positive_triggers": [
      "Create a 3-architecture.md component and data-flow design from the approved technical specification.",
      "Document component responsibilities, integration points, and architecture decisions for the billing feature.",
      "Update the existing feature architecture document after repository boundaries changed."
    ],
    "negative_boundaries": [
      "Analyze the product problem and write feature-wide requirements.",
      "Implement the approved architecture and modify production code.",
      "Write a feature-level technical specification with work breakdown and test strategy."
    ]
  }
});
