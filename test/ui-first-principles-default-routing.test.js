'use strict';
// sd0x-migration-test target=ui-first-principles unit=ui-first-principles/default
const { defineRoutingContractTests } = require('../scripts/skill-routing-test');
defineRoutingContractTests({
  "target": "ui-first-principles",
  "targetPackage": "core",
  "unit": "ui-first-principles/default",
  "registry": [
    {
      "unit": "ui-first-principles/default",
      "routing": {
        "negative_boundaries": [
          "Do not run ui-first-principles; only execute deterministic repository verification.",
          "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
          "Only review the current code changes for correctness and defects."
        ],
        "positive_triggers": [
          "Apply the canonical ui-first-principles workflow and report its evidence.",
          "Help me run the ui-first-principles workflow for this repository.",
          "I need the canonical ui-first-principles procedure with its safety boundaries."
        ]
      }
    }
  ],
  "routing": {
    "positive_triggers": [
      "Apply the canonical ui-first-principles workflow and report its evidence.",
      "Help me run the ui-first-principles workflow for this repository.",
      "I need the canonical ui-first-principles procedure with its safety boundaries."
    ],
    "negative_boundaries": [
      "Do not run ui-first-principles; only execute deterministic repository verification.",
      "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
      "Only review the current code changes for correctness and defects."
    ]
  }
});
