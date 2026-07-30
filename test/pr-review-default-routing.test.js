'use strict';
// sd0x-migration-test target=pr-review unit=pr-review/default
const { defineRoutingContractTests } = require('../scripts/skill-routing-test');
defineRoutingContractTests({
  "target": "pr-review",
  "targetPackage": "core",
  "unit": "pr-review/default",
  "registry": [
    {
      "unit": "pr-review/default",
      "routing": {
        "negative_boundaries": [
          "Do not run pr-review; only execute deterministic repository verification.",
          "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
          "Only review the current code changes for correctness and defects."
        ],
        "positive_triggers": [
          "Apply the canonical pr-review workflow and report its evidence.",
          "Help me run the pr-review workflow for this repository.",
          "I need the canonical pr-review procedure with its safety boundaries."
        ]
      }
    }
  ],
  "routing": {
    "positive_triggers": [
      "Apply the canonical pr-review workflow and report its evidence.",
      "Help me run the pr-review workflow for this repository.",
      "I need the canonical pr-review procedure with its safety boundaries."
    ],
    "negative_boundaries": [
      "Do not run pr-review; only execute deterministic repository verification.",
      "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
      "Only review the current code changes for correctness and defects."
    ]
  }
});
