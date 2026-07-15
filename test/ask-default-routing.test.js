'use strict';
// sd0x-migration-test target=ask unit=ask/default
const { defineRoutingContractTests } = require('../scripts/skill-routing-test');
defineRoutingContractTests({
  "target": "ask",
  "targetPackage": "research-pack",
  "unit": "ask/default",
  "registry": [
    {
      "unit": "ask/default",
      "routing": {
        "positive_triggers": [
          "Answer what changed recently in this repository and cite the relevant commits.",
          "Explain where the current feature stores its configuration using repository evidence.",
          "Tell me which project rule applies to this file and show the source."
        ],
        "negative_boundaries": [
          "Implement the configuration change in the repository.",
          "Perform a comprehensive multi-source study of competing frameworks.",
          "Trace the complete execution path across the whole application."
        ]
      }
    }
  ],
  "routing": {
    "positive_triggers": [
      "Answer what changed recently in this repository and cite the relevant commits.",
      "Explain where the current feature stores its configuration using repository evidence.",
      "Tell me which project rule applies to this file and show the source."
    ],
    "negative_boundaries": [
      "Implement the configuration change in the repository.",
      "Perform a comprehensive multi-source study of competing frameworks.",
      "Trace the complete execution path across the whole application."
    ]
  }
});
