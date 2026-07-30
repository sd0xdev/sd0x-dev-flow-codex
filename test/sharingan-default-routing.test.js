'use strict';
// sd0x-migration-test target=sharingan unit=sharingan/default
const { defineRoutingContractTests } = require('../scripts/skill-routing-test');
defineRoutingContractTests({
  "target": "sharingan",
  "targetPackage": "core",
  "unit": "sharingan/default",
  "registry": [
    {
      "unit": "sharingan/default",
      "routing": {
        "negative_boundaries": [
          "Do not run sharingan; only execute deterministic repository verification.",
          "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
          "Only review the current code changes for correctness and defects."
        ],
        "positive_triggers": [
          "Apply the canonical sharingan workflow and report its evidence.",
          "Help me run the sharingan workflow for this repository.",
          "I need the canonical sharingan procedure with its safety boundaries."
        ]
      }
    }
  ],
  "routing": {
    "positive_triggers": [
      "Apply the canonical sharingan workflow and report its evidence.",
      "Help me run the sharingan workflow for this repository.",
      "I need the canonical sharingan procedure with its safety boundaries."
    ],
    "negative_boundaries": [
      "Do not run sharingan; only execute deterministic repository verification.",
      "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
      "Only review the current code changes for correctness and defects."
    ]
  }
});
