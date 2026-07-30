'use strict';
// sd0x-migration-test target=jira unit=jira/default
const { defineRoutingContractTests } = require('../scripts/skill-routing-test');
defineRoutingContractTests({
  "target": "jira",
  "targetPackage": "core",
  "unit": "jira/default",
  "registry": [
    {
      "unit": "jira/default",
      "routing": {
        "negative_boundaries": [
          "Do not run jira; only execute deterministic repository verification.",
          "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
          "Only review the current code changes for correctness and defects."
        ],
        "positive_triggers": [
          "Apply the canonical jira workflow and report its evidence.",
          "Help me run the jira workflow for this repository.",
          "I need the canonical jira procedure with its safety boundaries."
        ]
      }
    }
  ],
  "routing": {
    "positive_triggers": [
      "Apply the canonical jira workflow and report its evidence.",
      "Help me run the jira workflow for this repository.",
      "I need the canonical jira procedure with its safety boundaries."
    ],
    "negative_boundaries": [
      "Do not run jira; only execute deterministic repository verification.",
      "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
      "Only review the current code changes for correctness and defects."
    ]
  }
});
