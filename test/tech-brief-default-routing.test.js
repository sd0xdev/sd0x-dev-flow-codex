'use strict';
// sd0x-migration-test target=tech-brief unit=tech-brief/default
const { defineRoutingContractTests } = require('../scripts/skill-routing-test');
defineRoutingContractTests({
  "target": "tech-brief",
  "targetPackage": "core",
  "unit": "tech-brief/default",
  "registry": [
    {
      "unit": "tech-brief/default",
      "routing": {
        "negative_boundaries": [
          "Do not run tech-brief; only execute deterministic repository verification.",
          "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
          "Only review the current code changes for correctness and defects."
        ],
        "positive_triggers": [
          "Apply the canonical tech-brief workflow and report its evidence.",
          "Help me run the tech-brief workflow for this repository.",
          "I need the canonical tech-brief procedure with its safety boundaries."
        ]
      }
    }
  ],
  "routing": {
    "positive_triggers": [
      "Apply the canonical tech-brief workflow and report its evidence.",
      "Help me run the tech-brief workflow for this repository.",
      "I need the canonical tech-brief procedure with its safety boundaries."
    ],
    "negative_boundaries": [
      "Do not run tech-brief; only execute deterministic repository verification.",
      "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
      "Only review the current code changes for correctness and defects."
    ]
  }
});
