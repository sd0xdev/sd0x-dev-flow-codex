'use strict';
// sd0x-migration-test target=portfolio unit=portfolio/default
const { defineRoutingContractTests } = require('../scripts/skill-routing-test');
defineRoutingContractTests({
  "target": "portfolio",
  "targetPackage": "core",
  "unit": "portfolio/default",
  "registry": [
    {
      "unit": "portfolio/default",
      "routing": {
        "negative_boundaries": [
          "Do not run portfolio; only execute deterministic repository verification.",
          "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
          "Only review the current code changes for correctness and defects."
        ],
        "positive_triggers": [
          "Apply the canonical portfolio workflow and report its evidence.",
          "Help me run the portfolio workflow for this repository.",
          "I need the canonical portfolio procedure with its safety boundaries."
        ]
      }
    }
  ],
  "routing": {
    "positive_triggers": [
      "Apply the canonical portfolio workflow and report its evidence.",
      "Help me run the portfolio workflow for this repository.",
      "I need the canonical portfolio procedure with its safety boundaries."
    ],
    "negative_boundaries": [
      "Do not run portfolio; only execute deterministic repository verification.",
      "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
      "Only review the current code changes for correctness and defects."
    ]
  }
});
