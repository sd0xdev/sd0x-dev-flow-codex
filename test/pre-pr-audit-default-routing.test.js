'use strict';
// sd0x-migration-test target=pre-pr-audit unit=pre-pr-audit/default
const { defineRoutingContractTests } = require('../scripts/skill-routing-test');
defineRoutingContractTests({
  "target": "pre-pr-audit",
  "targetPackage": "core",
  "unit": "pre-pr-audit/default",
  "registry": [
    {
      "unit": "pre-pr-audit/default",
      "routing": {
        "negative_boundaries": [
          "Create and publish the pull request for this branch.",
          "Prepare the branch for merge after all pull-request reviews pass.",
          "Summarize the existing pull request for reviewers."
        ],
        "positive_triggers": [
          "Audit this branch for pull-request readiness without publishing it.",
          "Check whether the current changes, tests, and commits are ready for a pull request.",
          "Perform the final local readiness audit before I create the pull request."
        ]
      }
    }
  ],
  "routing": {
    "positive_triggers": [
      "Audit this branch for pull-request readiness without publishing it.",
      "Check whether the current changes, tests, and commits are ready for a pull request.",
      "Perform the final local readiness audit before I create the pull request."
    ],
    "negative_boundaries": [
      "Create and publish the pull request for this branch.",
      "Prepare the branch for merge after all pull-request reviews pass.",
      "Summarize the existing pull request for reviewers."
    ]
  }
});
