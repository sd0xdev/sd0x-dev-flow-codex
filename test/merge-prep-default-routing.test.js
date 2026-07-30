'use strict';
// sd0x-migration-test target=merge-prep unit=merge-prep/default
const { defineRoutingContractTests } = require('../scripts/skill-routing-test');
defineRoutingContractTests({
  "target": "merge-prep",
  "targetPackage": "core",
  "unit": "merge-prep/default",
  "registry": [
    {
      "unit": "merge-prep/default",
      "routing": {
        "negative_boundaries": [
          "Do not run merge-prep; only execute deterministic repository verification.",
          "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
          "Only review the current code changes for correctness and defects."
        ],
        "positive_triggers": [
          "Apply the canonical merge-prep workflow and report its evidence.",
          "Help me run the merge-prep workflow for this repository.",
          "I need the canonical merge-prep procedure with its safety boundaries."
        ]
      }
    }
  ],
  "routing": {
    "positive_triggers": [
      "Apply the canonical merge-prep workflow and report its evidence.",
      "Help me run the merge-prep workflow for this repository.",
      "I need the canonical merge-prep procedure with its safety boundaries."
    ],
    "negative_boundaries": [
      "Do not run merge-prep; only execute deterministic repository verification.",
      "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
      "Only review the current code changes for correctness and defects."
    ]
  }
});
