'use strict';
// sd0x-migration-test target=runbook unit=runbook/default
const { defineRoutingContractTests } = require('../scripts/skill-routing-test');
defineRoutingContractTests({
  "target": "runbook",
  "targetPackage": "core",
  "unit": "runbook/default",
  "registry": [
    {
      "unit": "runbook/default",
      "routing": {
        "negative_boundaries": [
          "Do not run runbook; only execute deterministic repository verification.",
          "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
          "Only review the current code changes for correctness and defects."
        ],
        "positive_triggers": [
          "Apply the canonical runbook workflow and report its evidence.",
          "Help me run the runbook workflow for this repository.",
          "I need the canonical runbook procedure with its safety boundaries."
        ]
      }
    }
  ],
  "routing": {
    "positive_triggers": [
      "Apply the canonical runbook workflow and report its evidence.",
      "Help me run the runbook workflow for this repository.",
      "I need the canonical runbook procedure with its safety boundaries."
    ],
    "negative_boundaries": [
      "Do not run runbook; only execute deterministic repository verification.",
      "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
      "Only review the current code changes for correctness and defects."
    ]
  }
});
