'use strict';
// sd0x-migration-test target=generate-runner unit=generate-runner/default
const { defineRoutingContractTests } = require('../scripts/skill-routing-test');
defineRoutingContractTests({
  "target": "generate-runner",
  "targetPackage": "core",
  "unit": "generate-runner/default",
  "registry": [
    {
      "unit": "generate-runner/default",
      "routing": {
        "negative_boundaries": [
          "Do not run generate-runner; only execute deterministic repository verification.",
          "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
          "Only review the current code changes for correctness and defects."
        ],
        "positive_triggers": [
          "Apply the canonical generate-runner workflow and report its evidence.",
          "Help me run the generate-runner workflow for this repository.",
          "I need the canonical generate-runner procedure with its safety boundaries."
        ]
      }
    }
  ],
  "routing": {
    "positive_triggers": [
      "Apply the canonical generate-runner workflow and report its evidence.",
      "Help me run the generate-runner workflow for this repository.",
      "I need the canonical generate-runner procedure with its safety boundaries."
    ],
    "negative_boundaries": [
      "Do not run generate-runner; only execute deterministic repository verification.",
      "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
      "Only review the current code changes for correctness and defects."
    ]
  }
});
