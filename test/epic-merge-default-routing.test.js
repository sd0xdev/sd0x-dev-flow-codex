'use strict';
// sd0x-migration-test target=epic-merge unit=epic-merge/default
const { defineRoutingContractTests } = require('../scripts/skill-routing-test');
defineRoutingContractTests({
  "target": "epic-merge",
  "targetPackage": "core",
  "unit": "epic-merge/default",
  "registry": [
    {
      "unit": "epic-merge/default",
      "routing": {
        "negative_boundaries": [
          "Do not run epic-merge; only execute deterministic repository verification.",
          "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
          "Only review the current code changes for correctness and defects."
        ],
        "positive_triggers": [
          "Apply the canonical epic-merge workflow and report its evidence.",
          "Help me run the epic-merge workflow for this repository.",
          "I need the canonical epic-merge procedure with its safety boundaries."
        ]
      }
    }
  ],
  "routing": {
    "positive_triggers": [
      "Apply the canonical epic-merge workflow and report its evidence.",
      "Help me run the epic-merge workflow for this repository.",
      "I need the canonical epic-merge procedure with its safety boundaries."
    ],
    "negative_boundaries": [
      "Do not run epic-merge; only execute deterministic repository verification.",
      "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
      "Only review the current code changes for correctness and defects."
    ]
  }
});
