'use strict';
// sd0x-migration-test target=smart-commit unit=smart-commit/default
const { defineRoutingContractTests } = require('../scripts/skill-routing-test');
defineRoutingContractTests({
  "target": "smart-commit",
  "targetPackage": "core",
  "unit": "smart-commit/default",
  "registry": [
    {
      "unit": "smart-commit/default",
      "routing": {
        "negative_boundaries": [
          "Do not run smart-commit; only execute deterministic repository verification.",
          "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
          "Only review the current code changes for correctness and defects."
        ],
        "positive_triggers": [
          "Apply the canonical smart-commit workflow and report its evidence.",
          "Help me run the smart-commit workflow for this repository.",
          "I need the canonical smart-commit procedure with its safety boundaries."
        ]
      }
    }
  ],
  "routing": {
    "positive_triggers": [
      "Apply the canonical smart-commit workflow and report its evidence.",
      "Help me run the smart-commit workflow for this repository.",
      "I need the canonical smart-commit procedure with its safety boundaries."
    ],
    "negative_boundaries": [
      "Do not run smart-commit; only execute deterministic repository verification.",
      "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
      "Only review the current code changes for correctness and defects."
    ]
  }
});
