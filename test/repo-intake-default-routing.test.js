'use strict';
// sd0x-migration-test target=repo-intake unit=repo-intake/default
const { defineRoutingContractTests } = require('../scripts/skill-routing-test');
defineRoutingContractTests({
  "target": "repo-intake",
  "targetPackage": "core",
  "unit": "repo-intake/default",
  "registry": [
    {
      "unit": "repo-intake/default",
      "routing": {
        "negative_boundaries": [
          "Do not run repo-intake; only execute deterministic repository verification.",
          "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
          "Only review the current code changes for correctness and defects."
        ],
        "positive_triggers": [
          "Apply the canonical repo-intake workflow and report its evidence.",
          "Help me run the repo-intake workflow for this repository.",
          "I need the canonical repo-intake procedure with its safety boundaries."
        ]
      }
    }
  ],
  "routing": {
    "positive_triggers": [
      "Apply the canonical repo-intake workflow and report its evidence.",
      "Help me run the repo-intake workflow for this repository.",
      "I need the canonical repo-intake procedure with its safety boundaries."
    ],
    "negative_boundaries": [
      "Do not run repo-intake; only execute deterministic repository verification.",
      "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
      "Only review the current code changes for correctness and defects."
    ]
  }
});
