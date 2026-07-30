'use strict';
// sd0x-migration-test target=smart-rebase unit=smart-rebase/default
const { defineRoutingContractTests } = require('../scripts/skill-routing-test');
defineRoutingContractTests({
  "target": "smart-rebase",
  "targetPackage": "core",
  "unit": "smart-rebase/default",
  "registry": [
    {
      "unit": "smart-rebase/default",
      "routing": {
        "negative_boundaries": [
          "Do not run smart-rebase; only execute deterministic repository verification.",
          "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
          "Only review the current code changes for correctness and defects."
        ],
        "positive_triggers": [
          "Apply the canonical smart-rebase workflow and report its evidence.",
          "Help me run the smart-rebase workflow for this repository.",
          "I need the canonical smart-rebase procedure with its safety boundaries."
        ]
      }
    }
  ],
  "routing": {
    "positive_triggers": [
      "Apply the canonical smart-rebase workflow and report its evidence.",
      "Help me run the smart-rebase workflow for this repository.",
      "I need the canonical smart-rebase procedure with its safety boundaries."
    ],
    "negative_boundaries": [
      "Do not run smart-rebase; only execute deterministic repository verification.",
      "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
      "Only review the current code changes for correctness and defects."
    ]
  }
});
