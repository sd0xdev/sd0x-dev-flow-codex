'use strict';
// sd0x-migration-test target=create-pr unit=create-pr/default
const { defineRoutingContractTests } = require('../scripts/skill-routing-test');
defineRoutingContractTests({
  "target": "create-pr",
  "targetPackage": "core",
  "unit": "create-pr/default",
  "registry": [
    {
      "unit": "create-pr/default",
      "routing": {
        "negative_boundaries": [
          "Do not run create-pr; only execute deterministic repository verification.",
          "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
          "Only review the current code changes for correctness and defects."
        ],
        "positive_triggers": [
          "Apply the canonical create-pr workflow and report its evidence.",
          "Help me run the create-pr workflow for this repository.",
          "I need the canonical create-pr procedure with its safety boundaries."
        ]
      }
    }
  ],
  "routing": {
    "positive_triggers": [
      "Apply the canonical create-pr workflow and report its evidence.",
      "Help me run the create-pr workflow for this repository.",
      "I need the canonical create-pr procedure with its safety boundaries."
    ],
    "negative_boundaries": [
      "Do not run create-pr; only execute deterministic repository verification.",
      "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
      "Only review the current code changes for correctness and defects."
    ]
  }
});
