'use strict';
// sd0x-migration-test target=safe-remove unit=safe-remove/default
const { defineRoutingContractTests } = require('../scripts/skill-routing-test');
defineRoutingContractTests({
  "target": "safe-remove",
  "targetPackage": "core",
  "unit": "safe-remove/default",
  "registry": [
    {
      "unit": "safe-remove/default",
      "routing": {
        "negative_boundaries": [
          "Do not run safe-remove; only execute deterministic repository verification.",
          "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
          "Only review the current code changes for correctness and defects."
        ],
        "positive_triggers": [
          "Apply the canonical safe-remove workflow and report its evidence.",
          "Help me run the safe-remove workflow for this repository.",
          "I need the canonical safe-remove procedure with its safety boundaries."
        ]
      }
    }
  ],
  "routing": {
    "positive_triggers": [
      "Apply the canonical safe-remove workflow and report its evidence.",
      "Help me run the safe-remove workflow for this repository.",
      "I need the canonical safe-remove procedure with its safety boundaries."
    ],
    "negative_boundaries": [
      "Do not run safe-remove; only execute deterministic repository verification.",
      "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
      "Only review the current code changes for correctness and defects."
    ]
  }
});
