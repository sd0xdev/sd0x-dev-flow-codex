'use strict';
// sd0x-migration-test target=post-dev-recap unit=post-dev-recap/default
const { defineRoutingContractTests } = require('../scripts/skill-routing-test');
defineRoutingContractTests({
  "target": "post-dev-recap",
  "targetPackage": "core",
  "unit": "post-dev-recap/default",
  "registry": [
    {
      "unit": "post-dev-recap/default",
      "routing": {
        "negative_boundaries": [
          "Do not run post-dev-recap; only execute deterministic repository verification.",
          "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
          "Only review the current code changes for correctness and defects."
        ],
        "positive_triggers": [
          "Apply the canonical post-dev-recap workflow and report its evidence.",
          "Help me run the post-dev-recap workflow for this repository.",
          "I need the canonical post-dev-recap procedure with its safety boundaries."
        ]
      }
    }
  ],
  "routing": {
    "positive_triggers": [
      "Apply the canonical post-dev-recap workflow and report its evidence.",
      "Help me run the post-dev-recap workflow for this repository.",
      "I need the canonical post-dev-recap procedure with its safety boundaries."
    ],
    "negative_boundaries": [
      "Do not run post-dev-recap; only execute deterministic repository verification.",
      "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
      "Only review the current code changes for correctness and defects."
    ]
  }
});
