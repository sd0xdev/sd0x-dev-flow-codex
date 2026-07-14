'use strict';
// sd0x-migration-test target=req-analyze unit=req-analyze/default
const { defineRoutingContractTests } = require('../scripts/skill-routing-test');
defineRoutingContractTests({
  "target": "req-analyze",
  "targetPackage": "core",
  "unit": "req-analyze/default",
  "registry": [
    {
      "unit": "req-analyze/default",
      "routing": {
        "positive_triggers": [
          "Analyze the requirements for the authentication feature before technical design.",
          "Create or refine the feature-level 1-requirements.md for payment-retries.",
          "Decompose this product need with a 5-Why trace, stakeholders, and prioritized requirements."
        ],
        "negative_boundaries": [
          "Compare implementation approaches and recommend the most feasible solution.",
          "Create date-prefixed execution request tickets from an existing technical specification.",
          "Design the system architecture and implementation plan for this feature."
        ]
      }
    }
  ],
  "routing": {
    "positive_triggers": [
      "Analyze the requirements for the authentication feature before technical design.",
      "Create or refine the feature-level 1-requirements.md for payment-retries.",
      "Decompose this product need with a 5-Why trace, stakeholders, and prioritized requirements."
    ],
    "negative_boundaries": [
      "Compare implementation approaches and recommend the most feasible solution.",
      "Create date-prefixed execution request tickets from an existing technical specification.",
      "Design the system architecture and implementation plan for this feature."
    ]
  }
});
