'use strict';
// sd0x-migration-test target=statusline-config unit=statusline-config/default
const { defineRoutingContractTests } = require('../scripts/skill-routing-test');
defineRoutingContractTests({
  "target": "statusline-config",
  "targetPackage": "core",
  "unit": "statusline-config/default",
  "registry": [
    {
      "unit": "statusline-config/default",
      "routing": {
        "negative_boundaries": [
          "Do not run statusline-config; only execute deterministic repository verification.",
          "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
          "Only review the current code changes for correctness and defects."
        ],
        "positive_triggers": [
          "Apply the canonical statusline-config workflow and report its evidence.",
          "Help me run the statusline-config workflow for this repository.",
          "I need the canonical statusline-config procedure with its safety boundaries."
        ]
      }
    }
  ],
  "routing": {
    "positive_triggers": [
      "Apply the canonical statusline-config workflow and report its evidence.",
      "Help me run the statusline-config workflow for this repository.",
      "I need the canonical statusline-config procedure with its safety boundaries."
    ],
    "negative_boundaries": [
      "Do not run statusline-config; only execute deterministic repository verification.",
      "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
      "Only review the current code changes for correctness and defects."
    ]
  }
});
