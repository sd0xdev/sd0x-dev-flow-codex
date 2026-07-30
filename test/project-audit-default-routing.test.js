'use strict';
// sd0x-migration-test target=project-audit unit=project-audit/default
const { defineRoutingContractTests } = require('../scripts/skill-routing-test');
defineRoutingContractTests({
  "target": "project-audit",
  "targetPackage": "core",
  "unit": "project-audit/default",
  "registry": [
    {
      "unit": "project-audit/default",
      "routing": {
        "negative_boundaries": [
          "Assess only the security properties of this code change.",
          "Check whether this feature has enough unit and integration coverage.",
          "Review this branch specifically for pull-request readiness."
        ],
        "positive_triggers": [
          "Assess this repository's overall engineering and open-source health.",
          "Audit project robustness, maintainability, testing, documentation, and release readiness.",
          "Produce a scored repository health report with prioritized improvements."
        ]
      }
    }
  ],
  "routing": {
    "positive_triggers": [
      "Assess this repository's overall engineering and open-source health.",
      "Audit project robustness, maintainability, testing, documentation, and release readiness.",
      "Produce a scored repository health report with prioritized improvements."
    ],
    "negative_boundaries": [
      "Assess only the security properties of this code change.",
      "Check whether this feature has enough unit and integration coverage.",
      "Review this branch specifically for pull-request readiness."
    ]
  }
});
