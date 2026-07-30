'use strict';
// sd0x-migration-test target=update-docs unit=update-docs/default
const { defineRoutingContractTests } = require('../scripts/skill-routing-test');
defineRoutingContractTests({
  "target": "update-docs",
  "targetPackage": "core",
  "unit": "update-docs/default",
  "registry": [
    {
      "unit": "update-docs/default",
      "routing": {
        "negative_boundaries": [
          "Do not run update-docs; only execute deterministic repository verification.",
          "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
          "Only review the current code changes for correctness and defects."
        ],
        "positive_triggers": [
          "Apply the canonical update-docs workflow and report its evidence.",
          "Help me run the update-docs workflow for this repository.",
          "I need the canonical update-docs procedure with its safety boundaries."
        ]
      }
    }
  ],
  "routing": {
    "positive_triggers": [
      "Apply the canonical update-docs workflow and report its evidence.",
      "Help me run the update-docs workflow for this repository.",
      "I need the canonical update-docs procedure with its safety boundaries."
    ],
    "negative_boundaries": [
      "Do not run update-docs; only execute deterministic repository verification.",
      "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
      "Only review the current code changes for correctness and defects."
    ]
  }
});
