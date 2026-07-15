'use strict';
// sd0x-migration-test target=deep-explore unit=deep-explore/default
const { defineRoutingContractTests } = require('../scripts/skill-routing-test');
defineRoutingContractTests({
  "target": "deep-explore",
  "targetPackage": "research-pack",
  "unit": "deep-explore/default",
  "registry": [
    {
      "unit": "deep-explore/default",
      "routing": {
        "positive_triggers": [
          "Deeply explore how authorization works across this repository.",
          "Map a large subsystem in multiple passes and identify hidden cross-cutting behavior.",
          "Perform a multi-wave codebase exploration with a completeness assessment."
        ],
        "negative_boundaries": [
          "Answer where one constant is defined.",
          "Implement the authorization changes after exploration.",
          "Research external standards and community practices for authorization."
        ]
      }
    }
  ],
  "routing": {
    "positive_triggers": [
      "Deeply explore how authorization works across this repository.",
      "Map a large subsystem in multiple passes and identify hidden cross-cutting behavior.",
      "Perform a multi-wave codebase exploration with a completeness assessment."
    ],
    "negative_boundaries": [
      "Answer where one constant is defined.",
      "Implement the authorization changes after exploration.",
      "Research external standards and community practices for authorization."
    ]
  }
});
