'use strict';
// sd0x-migration-test target=watch-ci unit=watch-ci/default
const { defineRoutingContractTests } = require('../scripts/skill-routing-test');
defineRoutingContractTests({
  "target": "watch-ci",
  "targetPackage": "core",
  "unit": "watch-ci/default",
  "registry": [
    {
      "unit": "watch-ci/default",
      "routing": {
        "negative_boundaries": [
          "Do not run watch-ci; only execute deterministic repository verification.",
          "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
          "Only review the current code changes for correctness and defects."
        ],
        "positive_triggers": [
          "Apply the canonical watch-ci workflow and report its evidence.",
          "Help me run the watch-ci workflow for this repository.",
          "I need the canonical watch-ci procedure with its safety boundaries."
        ]
      }
    }
  ],
  "routing": {
    "positive_triggers": [
      "Apply the canonical watch-ci workflow and report its evidence.",
      "Help me run the watch-ci workflow for this repository.",
      "I need the canonical watch-ci procedure with its safety boundaries."
    ],
    "negative_boundaries": [
      "Do not run watch-ci; only execute deterministic repository verification.",
      "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
      "Only review the current code changes for correctness and defects."
    ]
  }
});
