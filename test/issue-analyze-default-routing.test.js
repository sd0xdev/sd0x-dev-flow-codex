'use strict';
// sd0x-migration-test target=issue-analyze unit=issue-analyze/default
const { defineRoutingContractTests } = require('../scripts/skill-routing-test');
defineRoutingContractTests({
  "target": "issue-analyze",
  "targetPackage": "research-pack",
  "unit": "issue-analyze/default",
  "registry": [
    {
      "unit": "issue-analyze/default",
      "routing": {
        "positive_triggers": [
          "Analyze this bug report and determine the most likely affected code path.",
          "Classify this issue, investigate repository evidence, and recommend next steps.",
          "Triage this review finding with an independent severity verdict."
        ],
        "negative_boundaries": [
          "Fix the reported bug in production code.",
          "Post the triage result to the issue tracker.",
          "Survey industry-wide solutions without focusing on this repository issue."
        ]
      }
    }
  ],
  "routing": {
    "positive_triggers": [
      "Analyze this bug report and determine the most likely affected code path.",
      "Classify this issue, investigate repository evidence, and recommend next steps.",
      "Triage this review finding with an independent severity verdict."
    ],
    "negative_boundaries": [
      "Fix the reported bug in production code.",
      "Post the triage result to the issue tracker.",
      "Survey industry-wide solutions without focusing on this repository issue."
    ]
  }
});
