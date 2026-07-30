'use strict';
// sd0x-migration-test target=push-ci unit=push-ci/default
const { defineRoutingContractTests } = require('../scripts/skill-routing-test');
defineRoutingContractTests({
  "target": "push-ci",
  "targetPackage": "core",
  "unit": "push-ci/default",
  "registry": [
    {
      "unit": "push-ci/default",
      "routing": {
        "negative_boundaries": [
          "Do not run push-ci; only execute deterministic repository verification.",
          "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
          "Only review the current code changes for correctness and defects."
        ],
        "positive_triggers": [
          "Apply the canonical push-ci workflow and report its evidence.",
          "Help me run the push-ci workflow for this repository.",
          "I need the canonical push-ci procedure with its safety boundaries."
        ]
      }
    }
  ],
  "routing": {
    "positive_triggers": [
      "Apply the canonical push-ci workflow and report its evidence.",
      "Help me run the push-ci workflow for this repository.",
      "I need the canonical push-ci procedure with its safety boundaries."
    ],
    "negative_boundaries": [
      "Do not run push-ci; only execute deterministic repository verification.",
      "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
      "Only review the current code changes for correctness and defects."
    ]
  }
});
