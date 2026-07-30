'use strict';
// sd0x-migration-test target=update-readme unit=update-readme/default
const { defineRoutingContractTests } = require('../scripts/skill-routing-test');
defineRoutingContractTests({
  "target": "update-readme",
  "targetPackage": "core",
  "unit": "update-readme/default",
  "registry": [
    {
      "unit": "update-readme/default",
      "routing": {
        "negative_boundaries": [
          "Do not run update-readme; only execute deterministic repository verification.",
          "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
          "Only review the current code changes for correctness and defects."
        ],
        "positive_triggers": [
          "Apply the canonical update-readme workflow and report its evidence.",
          "Help me run the update-readme workflow for this repository.",
          "I need the canonical update-readme procedure with its safety boundaries."
        ]
      }
    }
  ],
  "routing": {
    "positive_triggers": [
      "Apply the canonical update-readme workflow and report its evidence.",
      "Help me run the update-readme workflow for this repository.",
      "I need the canonical update-readme procedure with its safety boundaries."
    ],
    "negative_boundaries": [
      "Do not run update-readme; only execute deterministic repository verification.",
      "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
      "Only review the current code changes for correctness and defects."
    ]
  }
});
