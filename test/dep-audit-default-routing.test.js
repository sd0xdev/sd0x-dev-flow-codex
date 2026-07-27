'use strict';
// sd0x-migration-test target=dep-audit unit=dep-audit/default
const { defineRoutingContractTests } = require('../scripts/skill-routing-test');
defineRoutingContractTests({
  "target": "dep-audit",
  "targetPackage": "quality-pack",
  "unit": "dep-audit/default",
  "registry": [
    {
      "unit": "dep-audit/default",
      "routing": {
        "negative_boundaries": [
          "Bump the package version for the next release.",
          "Implement the recommended dependency upgrades and regenerate lockfiles.",
          "Review application code correctness without focusing on dependencies."
        ],
        "positive_triggers": [
          "Audit all locked dependencies for current advisories and maintenance risk.",
          "Inspect this repository's dependency graph for vulnerable or abandoned packages.",
          "Review manifest and lockfile health without changing package versions."
        ]
      }
    }
  ],
  "routing": {
    "positive_triggers": [
      "Audit all locked dependencies for current advisories and maintenance risk.",
      "Inspect this repository's dependency graph for vulnerable or abandoned packages.",
      "Review manifest and lockfile health without changing package versions."
    ],
    "negative_boundaries": [
      "Bump the package version for the next release.",
      "Implement the recommended dependency upgrades and regenerate lockfiles.",
      "Review application code correctness without focusing on dependencies."
    ]
  }
});
