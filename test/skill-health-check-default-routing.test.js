'use strict';
// sd0x-migration-test target=skill-health-check unit=skill-health-check/default
const { defineRoutingContractTests } = require('../scripts/skill-routing-test');
defineRoutingContractTests({
  "target": "skill-health-check",
  "targetPackage": "core",
  "unit": "skill-health-check/default",
  "registry": [
    {
      "unit": "skill-health-check/default",
      "routing": {
        "negative_boundaries": [
          "Do not run skill-health-check; only execute deterministic repository verification.",
          "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
          "Only review the current code changes for correctness and defects."
        ],
        "positive_triggers": [
          "Apply the canonical skill-health-check workflow and report its evidence.",
          "Help me run the skill-health-check workflow for this repository.",
          "I need the canonical skill-health-check procedure with its safety boundaries."
        ]
      }
    }
  ],
  "routing": {
    "positive_triggers": [
      "Apply the canonical skill-health-check workflow and report its evidence.",
      "Help me run the skill-health-check workflow for this repository.",
      "I need the canonical skill-health-check procedure with its safety boundaries."
    ],
    "negative_boundaries": [
      "Do not run skill-health-check; only execute deterministic repository verification.",
      "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
      "Only review the current code changes for correctness and defects."
    ]
  }
});
