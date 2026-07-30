'use strict';
// sd0x-migration-test target=pr-summary unit=pr-summary/default
const { defineRoutingContractTests } = require('../scripts/skill-routing-test');
defineRoutingContractTests({
  "target": "pr-summary",
  "targetPackage": "core",
  "unit": "pr-summary/default",
  "registry": [
    {
      "unit": "pr-summary/default",
      "routing": {
        "negative_boundaries": [
          "Do not run pr-summary; only execute deterministic repository verification.",
          "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
          "Only review the current code changes for correctness and defects."
        ],
        "positive_triggers": [
          "Apply the canonical pr-summary workflow and report its evidence.",
          "Help me run the pr-summary workflow for this repository.",
          "I need the canonical pr-summary procedure with its safety boundaries."
        ]
      }
    }
  ],
  "routing": {
    "positive_triggers": [
      "Apply the canonical pr-summary workflow and report its evidence.",
      "Help me run the pr-summary workflow for this repository.",
      "I need the canonical pr-summary procedure with its safety boundaries."
    ],
    "negative_boundaries": [
      "Do not run pr-summary; only execute deterministic repository verification.",
      "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
      "Only review the current code changes for correctness and defects."
    ]
  }
});
