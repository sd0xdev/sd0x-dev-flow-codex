'use strict';
// sd0x-migration-test target=orchestrate unit=orchestrate/default
const { defineRoutingContractTests } = require('../scripts/skill-routing-test');
defineRoutingContractTests({
  "target": "orchestrate",
  "targetPackage": "core",
  "unit": "orchestrate/default",
  "registry": [
    {
      "unit": "orchestrate/default",
      "routing": {
        "negative_boundaries": [
          "Do not run orchestrate; only execute deterministic repository verification.",
          "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
          "Only review the current code changes for correctness and defects."
        ],
        "positive_triggers": [
          "Apply the canonical orchestrate workflow and report its evidence.",
          "Help me run the orchestrate workflow for this repository.",
          "I need the canonical orchestrate procedure with its safety boundaries."
        ]
      }
    }
  ],
  "routing": {
    "positive_triggers": [
      "Apply the canonical orchestrate workflow and report its evidence.",
      "Help me run the orchestrate workflow for this repository.",
      "I need the canonical orchestrate procedure with its safety boundaries."
    ],
    "negative_boundaries": [
      "Do not run orchestrate; only execute deterministic repository verification.",
      "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
      "Only review the current code changes for correctness and defects."
    ]
  }
});
