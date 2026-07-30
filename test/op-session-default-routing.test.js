'use strict';
// sd0x-migration-test target=op-session unit=op-session/default
const { defineRoutingContractTests } = require('../scripts/skill-routing-test');
defineRoutingContractTests({
  "target": "op-session",
  "targetPackage": "core",
  "unit": "op-session/default",
  "registry": [
    {
      "unit": "op-session/default",
      "routing": {
        "negative_boundaries": [
          "Do not run op-session; only execute deterministic repository verification.",
          "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
          "Only review the current code changes for correctness and defects."
        ],
        "positive_triggers": [
          "Apply the canonical op-session workflow and report its evidence.",
          "Help me run the op-session workflow for this repository.",
          "I need the canonical op-session procedure with its safety boundaries."
        ]
      }
    }
  ],
  "routing": {
    "positive_triggers": [
      "Apply the canonical op-session workflow and report its evidence.",
      "Help me run the op-session workflow for this repository.",
      "I need the canonical op-session procedure with its safety boundaries."
    ],
    "negative_boundaries": [
      "Do not run op-session; only execute deterministic repository verification.",
      "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
      "Only review the current code changes for correctness and defects."
    ]
  }
});
