'use strict';
// sd0x-migration-test target=verify unit=verify/default
const { defineRoutingContractTests } = require('../scripts/skill-routing-test');
defineRoutingContractTests({
  "target": "verify",
  "targetPackage": "core",
  "unit": "verify/default",
  "registry": [
    {
      "unit": "verify/default",
      "routing": {
        "negative_boundaries": [
          "Do not run verify; only execute deterministic repository verification.",
          "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
          "Only review the current code changes for correctness and defects."
        ],
        "positive_triggers": [
          "Apply the canonical verify workflow and report its evidence.",
          "Help me run the verify workflow for this repository.",
          "I need the canonical verify procedure with its safety boundaries."
        ]
      }
    },
    {
      "unit": "verify/fast",
      "routing": {
        "negative_boundaries": [
          "Do not run verify fast mode; only execute deterministic repository verification.",
          "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
          "Only review the current code changes for correctness and defects."
        ],
        "positive_triggers": [
          "Apply the canonical verify fast mode workflow and report its evidence.",
          "Help me run the verify fast mode workflow for this repository.",
          "I need the canonical verify fast mode procedure with its safety boundaries."
        ]
      }
    },
    {
      "unit": "verify/precommit",
      "routing": {
        "negative_boundaries": [
          "Do not run verify precommit mode; only execute deterministic repository verification.",
          "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
          "Only review the current code changes for correctness and defects."
        ],
        "positive_triggers": [
          "Apply the canonical verify precommit mode workflow and report its evidence.",
          "Help me run the verify precommit mode workflow for this repository.",
          "I need the canonical verify precommit mode procedure with its safety boundaries."
        ]
      }
    }
  ],
  "routing": {
    "positive_triggers": [
      "Apply the canonical verify workflow and report its evidence.",
      "Help me run the verify workflow for this repository.",
      "I need the canonical verify procedure with its safety boundaries."
    ],
    "negative_boundaries": [
      "Do not run verify; only execute deterministic repository verification.",
      "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
      "Only review the current code changes for correctness and defects."
    ]
  }
});
