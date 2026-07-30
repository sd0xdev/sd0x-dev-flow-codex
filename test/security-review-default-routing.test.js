'use strict';
// sd0x-migration-test target=security-review unit=security-review/default
const { defineRoutingContractTests } = require('../scripts/skill-routing-test');
defineRoutingContractTests({
  "target": "security-review",
  "targetPackage": "core",
  "unit": "security-review/default",
  "registry": [
    {
      "unit": "security-review/default",
      "routing": {
        "negative_boundaries": [
          "Assess general code quality and maintainability for merge readiness.",
          "Check current dependency advisories across the whole lockfile.",
          "Estimate release risk across compatibility, rollout, and operations."
        ],
        "positive_triggers": [
          "Perform a threat-driven security review of this authentication change.",
          "Review this API diff for authorization, injection, secrets, and data exposure risks.",
          "Security-audit the selected module and provide evidence-backed findings."
        ]
      }
    }
  ],
  "routing": {
    "positive_triggers": [
      "Perform a threat-driven security review of this authentication change.",
      "Review this API diff for authorization, injection, secrets, and data exposure risks.",
      "Security-audit the selected module and provide evidence-backed findings."
    ],
    "negative_boundaries": [
      "Assess general code quality and maintainability for merge readiness.",
      "Check current dependency advisories across the whole lockfile.",
      "Estimate release risk across compatibility, rollout, and operations."
    ]
  }
});
