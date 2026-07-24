'use strict';
// sd0x-migration-test target=review-spec unit=review-spec/default
const { defineRoutingContractTests } = require('../scripts/skill-routing-test');
defineRoutingContractTests({
  "target": "review-spec",
  "targetPackage": "planning-pack",
  "unit": "review-spec/default",
  "registry": [
    {
      "unit": "review-spec/default",
      "routing": {
        "positive_triggers": [
          "Check this technical specification for lifecycle-layer violations, traceability gaps, repository inconsistency, risks, and testability.",
          "Review the existing requirements and technical design documents before implementation begins.",
          "Validate that each requirement maps to an implementable design and observable verification."
        ],
        "negative_boundaries": [
          "Create or rewrite the feature technical specification.",
          "Inspect the dirty worktree and record a fingerprint-bound code review result.",
          "Review the execution plan for ordering, dependencies, and rollback gaps."
        ]
      }
    }
  ],
  "routing": {
    "positive_triggers": [
      "Check this technical specification for lifecycle-layer violations, traceability gaps, repository inconsistency, risks, and testability.",
      "Review the existing requirements and technical design documents before implementation begins.",
      "Validate that each requirement maps to an implementable design and observable verification."
    ],
    "negative_boundaries": [
      "Create or rewrite the feature technical specification.",
      "Inspect the dirty worktree and record a fingerprint-bound code review result.",
      "Review the execution plan for ordering, dependencies, and rollback gaps."
    ]
  }
});
