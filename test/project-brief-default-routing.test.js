'use strict';
// sd0x-migration-test target=project-brief unit=project-brief/default
const { defineRoutingContractTests } = require('../scripts/skill-routing-test');
defineRoutingContractTests({
  "target": "project-brief",
  "targetPackage": "core",
  "unit": "project-brief/default",
  "registry": [
    {
      "unit": "project-brief/default",
      "routing": {
        "negative_boundaries": [
          "Do not run project-brief; only execute deterministic repository verification.",
          "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
          "Only review the current code changes for correctness and defects."
        ],
        "positive_triggers": [
          "Apply the canonical project-brief workflow and report its evidence.",
          "Help me run the project-brief workflow for this repository.",
          "I need the canonical project-brief procedure with its safety boundaries."
        ]
      }
    }
  ],
  "routing": {
    "positive_triggers": [
      "Apply the canonical project-brief workflow and report its evidence.",
      "Help me run the project-brief workflow for this repository.",
      "I need the canonical project-brief procedure with its safety boundaries."
    ],
    "negative_boundaries": [
      "Do not run project-brief; only execute deterministic repository verification.",
      "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
      "Only review the current code changes for correctness and defects."
    ]
  }
});
