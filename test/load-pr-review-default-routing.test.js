'use strict';
// sd0x-migration-test target=load-pr-review unit=load-pr-review/default
const { defineRoutingContractTests } = require('../scripts/skill-routing-test');
defineRoutingContractTests({
  "target": "load-pr-review",
  "targetPackage": "core",
  "unit": "load-pr-review/default",
  "registry": [
    {
      "unit": "load-pr-review/default",
      "routing": {
        "negative_boundaries": [
          "Do not run load-pr-review; only execute deterministic repository verification.",
          "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
          "Only review the current code changes for correctness and defects."
        ],
        "positive_triggers": [
          "Apply the canonical load-pr-review workflow and report its evidence.",
          "Help me run the load-pr-review workflow for this repository.",
          "I need the canonical load-pr-review procedure with its safety boundaries."
        ]
      }
    }
  ],
  "routing": {
    "positive_triggers": [
      "Apply the canonical load-pr-review workflow and report its evidence.",
      "Help me run the load-pr-review workflow for this repository.",
      "I need the canonical load-pr-review procedure with its safety boundaries."
    ],
    "negative_boundaries": [
      "Do not run load-pr-review; only execute deterministic repository verification.",
      "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
      "Only review the current code changes for correctness and defects."
    ]
  }
});
