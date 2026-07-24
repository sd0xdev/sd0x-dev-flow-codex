'use strict';
// sd0x-migration-test target=seek-verdict unit=seek-verdict/default
const { defineRoutingContractTests } = require('../scripts/skill-routing-test');
defineRoutingContractTests({
  "target": "seek-verdict",
  "targetPackage": "research-pack",
  "unit": "seek-verdict/default",
  "registry": [
    {
      "unit": "seek-verdict/default",
      "routing": {
        "positive_triggers": [
          "Get an independent verdict on whether this review finding is valid.",
          "Seek a blind second opinion on this suspected security issue.",
          "Verify whether dismissing this defect is justified using fresh context."
        ],
        "negative_boundaries": [
          "Fix the defect after assessing it.",
          "Post the verdict to the pull request.",
          "Run the primary code review for the entire dirty worktree."
        ]
      }
    }
  ],
  "routing": {
    "positive_triggers": [
      "Get an independent verdict on whether this review finding is valid.",
      "Seek a blind second opinion on this suspected security issue.",
      "Verify whether dismissing this defect is justified using fresh context."
    ],
    "negative_boundaries": [
      "Fix the defect after assessing it.",
      "Post the verdict to the pull request.",
      "Run the primary code review for the entire dirty worktree."
    ]
  }
});
