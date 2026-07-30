'use strict';
// sd0x-migration-test target=recap-ask unit=recap-ask/default
const { defineRoutingContractTests } = require('../scripts/skill-routing-test');
defineRoutingContractTests({
  "target": "recap-ask",
  "targetPackage": "core",
  "unit": "recap-ask/default",
  "registry": [
    {
      "unit": "recap-ask/default",
      "routing": {
        "negative_boundaries": [
          "Do not run recap-ask; only execute deterministic repository verification.",
          "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
          "Only review the current code changes for correctness and defects."
        ],
        "positive_triggers": [
          "Apply the canonical recap-ask workflow and report its evidence.",
          "Help me run the recap-ask workflow for this repository.",
          "I need the canonical recap-ask procedure with its safety boundaries."
        ]
      }
    }
  ],
  "routing": {
    "positive_triggers": [
      "Apply the canonical recap-ask workflow and report its evidence.",
      "Help me run the recap-ask workflow for this repository.",
      "I need the canonical recap-ask procedure with its safety boundaries."
    ],
    "negative_boundaries": [
      "Do not run recap-ask; only execute deterministic repository verification.",
      "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
      "Only review the current code changes for correctness and defects."
    ]
  }
});
