'use strict';
// sd0x-migration-test target=git-profile unit=git-profile/default
const { defineRoutingContractTests } = require('../scripts/skill-routing-test');
defineRoutingContractTests({
  "target": "git-profile",
  "targetPackage": "core",
  "unit": "git-profile/default",
  "registry": [
    {
      "unit": "git-profile/default",
      "routing": {
        "negative_boundaries": [
          "Do not run git-profile; only execute deterministic repository verification.",
          "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
          "Only review the current code changes for correctness and defects."
        ],
        "positive_triggers": [
          "Apply the canonical git-profile workflow and report its evidence.",
          "Help me run the git-profile workflow for this repository.",
          "I need the canonical git-profile procedure with its safety boundaries."
        ]
      }
    }
  ],
  "routing": {
    "positive_triggers": [
      "Apply the canonical git-profile workflow and report its evidence.",
      "Help me run the git-profile workflow for this repository.",
      "I need the canonical git-profile procedure with its safety boundaries."
    ],
    "negative_boundaries": [
      "Do not run git-profile; only execute deterministic repository verification.",
      "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
      "Only review the current code changes for correctness and defects."
    ]
  }
});
