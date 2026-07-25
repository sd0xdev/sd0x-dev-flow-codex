'use strict';
// sd0x-migration-test target=risk-assess unit=risk-assess/default
const { defineRoutingContractTests } = require('../scripts/skill-routing-test');
defineRoutingContractTests({
  "target": "risk-assess",
  "targetPackage": "quality-pack",
  "unit": "risk-assess/default",
  "registry": [
    {
      "unit": "risk-assess/default",
      "routing": {
        "negative_boundaries": [
          "Audit the repository against a named external engineering standard.",
          "Find concrete security vulnerabilities in this change.",
          "Review code correctness and maintainability as a merge gate."
        ],
        "positive_triggers": [
          "Assess the release and operational risk of this database migration.",
          "Estimate this change's blast radius, reversibility, and required mitigations.",
          "Score the implementation risk of the current diff with evidence."
        ]
      }
    }
  ],
  "routing": {
    "positive_triggers": [
      "Assess the release and operational risk of this database migration.",
      "Estimate this change's blast radius, reversibility, and required mitigations.",
      "Score the implementation risk of the current diff with evidence."
    ],
    "negative_boundaries": [
      "Audit the repository against a named external engineering standard.",
      "Find concrete security vulnerabilities in this change.",
      "Review code correctness and maintainability as a merge gate."
    ]
  }
});
