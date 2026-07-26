'use strict';
// sd0x-migration-test target=review unit=review/branch
const { defineRoutingContractTests } = require('../scripts/skill-routing-test');
defineRoutingContractTests({
  "target": "review",
  "targetPackage": "core",
  "unit": "review/branch",
  "registry": [
    {
      "unit": "review/branch",
      "routing": {
        "negative_boundaries": [
          "Inspect only the current unstaged diff for a quick preliminary opinion.",
          "Review prose accuracy and links in the migration guide.",
          "Run the mandatory current-worktree gate for deterministic verification."
        ],
        "positive_triggers": [
          "Audit all commits on this feature branch against its merge base.",
          "Review every change introduced by the current branch before opening a pull request.",
          "Review the branch range from main through HEAD as one coherent change."
        ]
      }
    },
    {
      "unit": "review/deep",
      "routing": {
        "negative_boundaries": [
          "Check only whether the tests adequately cover the acceptance criteria.",
          "Give a fast changed-lines-only opinion without broader exploration.",
          "Scan the change exclusively for security vulnerabilities."
        ],
        "positive_triggers": [
          "Deeply inspect these changes, their callers, architecture, and hidden invariants.",
          "Perform an independent whole-codebase investigation around this diff before judging it.",
          "Review this complex change with broad repository exploration and surrounding tests."
        ]
      }
    },
    {
      "unit": "review/default",
      "routing": {
        "negative_boundaries": [
          "Assess project-wide maintainability and repository health without focusing on a diff.",
          "Create missing regression tests for this implementation.",
          "Summarize the pull request without judging correctness."
        ],
        "positive_triggers": [
          "Perform the standard fingerprint-bound code review before verification.",
          "Review the current dirty worktree and close the repository review gate.",
          "Run the required configured primary review for these changes."
        ]
      }
    },
    {
      "unit": "review/fast",
      "routing": {
        "negative_boundaries": [
          "Deeply investigate the architectural implications of this cross-cutting change.",
          "Review the complete feature branch commit range against main.",
          "Run local checks and inspect all affected dependencies before reviewing."
        ],
        "positive_triggers": [
          "Give me a quick diff-only review of the current changed lines.",
          "Inspect this small patch for obvious correctness issues without running checks.",
          "Provide a preliminary fast review before the full repository gate."
        ]
      }
    },
    {
      "unit": "review/full",
      "routing": {
        "negative_boundaries": [
          "Audit dependency freshness and advisories without reviewing application logic.",
          "Inspect only this documentation page for clarity and factual accuracy.",
          "Provide a quick diff-only review with no project checks."
        ],
        "positive_triggers": [
          "Complete a comprehensive review with read-only local checks and dependency context.",
          "Inspect this worktree thoroughly and include available build and lint evidence.",
          "Run the full change review, including affected integrations and repository checks."
        ]
      }
    }
  ],
  "routing": {
    "positive_triggers": [
      "Audit all commits on this feature branch against its merge base.",
      "Review every change introduced by the current branch before opening a pull request.",
      "Review the branch range from main through HEAD as one coherent change."
    ],
    "negative_boundaries": [
      "Inspect only the current unstaged diff for a quick preliminary opinion.",
      "Review prose accuracy and links in the migration guide.",
      "Run the mandatory current-worktree gate for deterministic verification."
    ]
  }
});
