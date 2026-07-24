'use strict';
// sd0x-migration-test target=plan-review unit=plan-review/default
const { defineRoutingContractTests } = require('../scripts/skill-routing-test');
defineRoutingContractTests({
  "target": "plan-review",
  "targetPackage": "planning-pack",
  "unit": "plan-review/default",
  "registry": [
    {
      "unit": "plan-review/default",
      "routing": {
        "positive_triggers": [
          "Critique this implementation plan for missing steps, dependency errors, risks, and weak verification.",
          "Review the proposed execution sequence before work begins and return actionable findings.",
          "Stress-test the rollback, validation, and decision points in this plan."
        ],
        "negative_boundaries": [
          "Generate the final component architecture document for the feature.",
          "Inspect the dirty worktree and record the fingerprint-bound code review gate.",
          "Judge whether an existing lifecycle specification is correct and internally consistent."
        ]
      }
    }
  ],
  "routing": {
    "positive_triggers": [
      "Critique this implementation plan for missing steps, dependency errors, risks, and weak verification.",
      "Review the proposed execution sequence before work begins and return actionable findings.",
      "Stress-test the rollback, validation, and decision points in this plan."
    ],
    "negative_boundaries": [
      "Generate the final component architecture document for the feature.",
      "Inspect the dirty worktree and record the fingerprint-bound code review gate.",
      "Judge whether an existing lifecycle specification is correct and internally consistent."
    ]
  }
});
