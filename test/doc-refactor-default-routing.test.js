'use strict';
// sd0x-migration-test target=doc-refactor unit=doc-refactor/default
const { defineRoutingContractTests } = require('../scripts/skill-routing-test');
defineRoutingContractTests({
  "target": "doc-refactor",
  "targetPackage": "core",
  "unit": "doc-refactor/default",
  "registry": [
    {
      "unit": "doc-refactor/default",
      "routing": {
        "negative_boundaries": [
          "Do not run doc-refactor; only execute deterministic repository verification.",
          "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
          "Only review the current code changes for correctness and defects."
        ],
        "positive_triggers": [
          "Apply the canonical doc-refactor workflow and report its evidence.",
          "Help me run the doc-refactor workflow for this repository.",
          "I need the canonical doc-refactor procedure with its safety boundaries."
        ]
      }
    }
  ],
  "routing": {
    "positive_triggers": [
      "Apply the canonical doc-refactor workflow and report its evidence.",
      "Help me run the doc-refactor workflow for this repository.",
      "I need the canonical doc-refactor procedure with its safety boundaries."
    ],
    "negative_boundaries": [
      "Do not run doc-refactor; only execute deterministic repository verification.",
      "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
      "Only review the current code changes for correctness and defects."
    ]
  }
});
