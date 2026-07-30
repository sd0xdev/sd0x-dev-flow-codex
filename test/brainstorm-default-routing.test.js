'use strict';
// sd0x-migration-test target=brainstorm unit=brainstorm/default
const { defineRoutingContractTests } = require('../scripts/skill-routing-test');
defineRoutingContractTests({
  "target": "brainstorm",
  "targetPackage": "core",
  "unit": "brainstorm/default",
  "registry": [
    {
      "unit": "brainstorm/default",
      "routing": {
        "negative_boundaries": [
          "Explain this function line by line.",
          "Implement the selected offline synchronization design.",
          "Research the full market landscape with a multi-source evidence report."
        ],
        "positive_triggers": [
          "Brainstorm competing designs for offline synchronization and challenge each one.",
          "Explore solution options adversarially until they converge or clearly diverge.",
          "Stress-test our proposed migration strategy with independent positions."
        ]
      }
    }
  ],
  "routing": {
    "positive_triggers": [
      "Brainstorm competing designs for offline synchronization and challenge each one.",
      "Explore solution options adversarially until they converge or clearly diverge.",
      "Stress-test our proposed migration strategy with independent positions."
    ],
    "negative_boundaries": [
      "Explain this function line by line.",
      "Implement the selected offline synchronization design.",
      "Research the full market landscape with a multi-source evidence report."
    ]
  }
});
