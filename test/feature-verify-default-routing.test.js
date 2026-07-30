'use strict';
// sd0x-migration-test target=feature-verify unit=feature-verify/default
const { defineRoutingContractTests } = require('../scripts/skill-routing-test');
defineRoutingContractTests({
  "target": "feature-verify",
  "targetPackage": "core",
  "unit": "feature-verify/default",
  "registry": [
    {
      "unit": "feature-verify/default",
      "routing": {
        "negative_boundaries": [
          "Do not run feature-verify; only execute deterministic repository verification.",
          "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
          "Only review the current code changes for correctness and defects."
        ],
        "positive_triggers": [
          "Apply the canonical feature-verify workflow and report its evidence.",
          "Help me run the feature-verify workflow for this repository.",
          "I need the canonical feature-verify procedure with its safety boundaries."
        ]
      }
    }
  ],
  "routing": {
    "positive_triggers": [
      "Apply the canonical feature-verify workflow and report its evidence.",
      "Help me run the feature-verify workflow for this repository.",
      "I need the canonical feature-verify procedure with its safety boundaries."
    ],
    "negative_boundaries": [
      "Do not run feature-verify; only execute deterministic repository verification.",
      "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
      "Only review the current code changes for correctness and defects."
    ]
  }
});
