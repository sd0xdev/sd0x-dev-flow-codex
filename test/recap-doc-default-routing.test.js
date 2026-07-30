'use strict';
// sd0x-migration-test target=recap-doc unit=recap-doc/default
const { defineRoutingContractTests } = require('../scripts/skill-routing-test');
defineRoutingContractTests({
  "target": "recap-doc",
  "targetPackage": "core",
  "unit": "recap-doc/default",
  "registry": [
    {
      "unit": "recap-doc/default",
      "routing": {
        "negative_boundaries": [
          "Do not run recap-doc; only execute deterministic repository verification.",
          "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
          "Only review the current code changes for correctness and defects."
        ],
        "positive_triggers": [
          "Apply the canonical recap-doc workflow and report its evidence.",
          "Help me run the recap-doc workflow for this repository.",
          "I need the canonical recap-doc procedure with its safety boundaries."
        ]
      }
    }
  ],
  "routing": {
    "positive_triggers": [
      "Apply the canonical recap-doc workflow and report its evidence.",
      "Help me run the recap-doc workflow for this repository.",
      "I need the canonical recap-doc procedure with its safety boundaries."
    ],
    "negative_boundaries": [
      "Do not run recap-doc; only execute deterministic repository verification.",
      "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
      "Only review the current code changes for correctness and defects."
    ]
  }
});
