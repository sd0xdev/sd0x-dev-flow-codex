'use strict';
// sd0x-migration-test target=de-ai-flavor unit=de-ai-flavor/default
const { defineRoutingContractTests } = require('../scripts/skill-routing-test');
defineRoutingContractTests({
  "target": "de-ai-flavor",
  "targetPackage": "core",
  "unit": "de-ai-flavor/default",
  "registry": [
    {
      "unit": "de-ai-flavor/default",
      "routing": {
        "negative_boundaries": [
          "Do not run de-ai-flavor; only execute deterministic repository verification.",
          "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
          "Only review the current code changes for correctness and defects."
        ],
        "positive_triggers": [
          "Apply the canonical de-ai-flavor workflow and report its evidence.",
          "Help me run the de-ai-flavor workflow for this repository.",
          "I need the canonical de-ai-flavor procedure with its safety boundaries."
        ]
      }
    }
  ],
  "routing": {
    "positive_triggers": [
      "Apply the canonical de-ai-flavor workflow and report its evidence.",
      "Help me run the de-ai-flavor workflow for this repository.",
      "I need the canonical de-ai-flavor procedure with its safety boundaries."
    ],
    "negative_boundaries": [
      "Do not run de-ai-flavor; only execute deterministic repository verification.",
      "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
      "Only review the current code changes for correctness and defects."
    ]
  }
});
