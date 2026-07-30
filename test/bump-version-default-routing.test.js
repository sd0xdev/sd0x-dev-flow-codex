'use strict';
// sd0x-migration-test target=bump-version unit=bump-version/default
const { defineRoutingContractTests } = require('../scripts/skill-routing-test');
defineRoutingContractTests({
  "target": "bump-version",
  "targetPackage": "core",
  "unit": "bump-version/default",
  "registry": [
    {
      "unit": "bump-version/default",
      "routing": {
        "negative_boundaries": [
          "Do not run bump-version; only execute deterministic repository verification.",
          "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
          "Only review the current code changes for correctness and defects."
        ],
        "positive_triggers": [
          "Apply the canonical bump-version workflow and report its evidence.",
          "Help me run the bump-version workflow for this repository.",
          "I need the canonical bump-version procedure with its safety boundaries."
        ]
      }
    }
  ],
  "routing": {
    "positive_triggers": [
      "Apply the canonical bump-version workflow and report its evidence.",
      "Help me run the bump-version workflow for this repository.",
      "I need the canonical bump-version procedure with its safety boundaries."
    ],
    "negative_boundaries": [
      "Do not run bump-version; only execute deterministic repository verification.",
      "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
      "Only review the current code changes for correctness and defects."
    ]
  }
});
