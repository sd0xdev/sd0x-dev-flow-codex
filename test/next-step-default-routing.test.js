'use strict';
// sd0x-migration-test target=next-step unit=next-step/default
const { defineRoutingContractTests } = require('../scripts/skill-routing-test');
defineRoutingContractTests({
  "target": "next-step",
  "targetPackage": "core",
  "unit": "next-step/default",
  "registry": [
    {
      "unit": "next-step/default",
      "routing": {
        "negative_boundaries": [
          "Do not run next-step; only execute deterministic repository verification.",
          "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
          "Only review the current code changes for correctness and defects."
        ],
        "positive_triggers": [
          "Apply the canonical next-step workflow and report its evidence.",
          "Help me run the next-step workflow for this repository.",
          "I need the canonical next-step procedure with its safety boundaries."
        ]
      }
    }
  ],
  "routing": {
    "positive_triggers": [
      "Apply the canonical next-step workflow and report its evidence.",
      "Help me run the next-step workflow for this repository.",
      "I need the canonical next-step procedure with its safety boundaries."
    ],
    "negative_boundaries": [
      "Do not run next-step; only execute deterministic repository verification.",
      "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
      "Only review the current code changes for correctness and defects."
    ]
  }
});
