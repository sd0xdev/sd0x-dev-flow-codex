'use strict';
// sd0x-migration-test target=pr-comment unit=pr-comment/default
const { defineRoutingContractTests } = require('../scripts/skill-routing-test');
defineRoutingContractTests({
  "target": "pr-comment",
  "targetPackage": "core",
  "unit": "pr-comment/default",
  "registry": [
    {
      "unit": "pr-comment/default",
      "routing": {
        "negative_boundaries": [
          "Do not run pr-comment; only execute deterministic repository verification.",
          "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
          "Only review the current code changes for correctness and defects."
        ],
        "positive_triggers": [
          "Apply the canonical pr-comment workflow and report its evidence.",
          "Help me run the pr-comment workflow for this repository.",
          "I need the canonical pr-comment procedure with its safety boundaries."
        ]
      }
    }
  ],
  "routing": {
    "positive_triggers": [
      "Apply the canonical pr-comment workflow and report its evidence.",
      "Help me run the pr-comment workflow for this repository.",
      "I need the canonical pr-comment procedure with its safety boundaries."
    ],
    "negative_boundaries": [
      "Do not run pr-comment; only execute deterministic repository verification.",
      "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
      "Only review the current code changes for correctness and defects."
    ]
  }
});
