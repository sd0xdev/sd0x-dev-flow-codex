'use strict';
// sd0x-migration-test target=remind unit=remind/default
const { defineRoutingContractTests } = require('../scripts/skill-routing-test');
defineRoutingContractTests({
  "target": "remind",
  "targetPackage": "core",
  "unit": "remind/default",
  "registry": [
    {
      "unit": "remind/default",
      "routing": {
        "negative_boundaries": [
          "Do not run remind; only execute deterministic repository verification.",
          "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
          "Only review the current code changes for correctness and defects."
        ],
        "positive_triggers": [
          "Apply the canonical remind workflow and report its evidence.",
          "Help me run the remind workflow for this repository.",
          "I need the canonical remind procedure with its safety boundaries."
        ]
      }
    }
  ],
  "routing": {
    "positive_triggers": [
      "Apply the canonical remind workflow and report its evidence.",
      "Help me run the remind workflow for this repository.",
      "I need the canonical remind procedure with its safety boundaries."
    ],
    "negative_boundaries": [
      "Do not run remind; only execute deterministic repository verification.",
      "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
      "Only review the current code changes for correctness and defects."
    ]
  }
});
