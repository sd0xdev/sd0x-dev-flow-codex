'use strict';
// sd0x-migration-test target=doctor unit=doctor/claude
const { defineRoutingContractTests } = require('../scripts/skill-routing-test');
defineRoutingContractTests({
  "target": "doctor",
  "targetPackage": "core",
  "unit": "doctor/claude",
  "registry": [
    {
      "unit": "doctor/claude",
      "routing": {
        "negative_boundaries": [
          "Do not run doctor claude mode; only execute deterministic repository verification.",
          "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
          "Only review the current code changes for correctness and defects."
        ],
        "positive_triggers": [
          "Apply the canonical doctor claude mode workflow and report its evidence.",
          "Help me run the doctor claude mode workflow for this repository.",
          "I need the canonical doctor claude mode procedure with its safety boundaries."
        ]
      }
    }
  ],
  "routing": {
    "positive_triggers": [
      "Apply the canonical doctor claude mode workflow and report its evidence.",
      "Help me run the doctor claude mode workflow for this repository.",
      "I need the canonical doctor claude mode procedure with its safety boundaries."
    ],
    "negative_boundaries": [
      "Do not run doctor claude mode; only execute deterministic repository verification.",
      "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
      "Only review the current code changes for correctness and defects."
    ]
  }
});
