'use strict';
// sd0x-migration-test target=doc-review unit=doc-review/default
const { defineRoutingContractTests } = require('../scripts/skill-routing-test');
defineRoutingContractTests({
  "target": "doc-review",
  "targetPackage": "quality-pack",
  "unit": "doc-review/default",
  "registry": [
    {
      "unit": "doc-review/default",
      "routing": {
        "negative_boundaries": [
          "Review the current code diff for implementation defects.",
          "Rewrite this guide to improve its structure and wording.",
          "Synchronize the English and Traditional Chinese README files."
        ],
        "positive_triggers": [
          "Check this migration guide for factual accuracy, missing prerequisites, and broken examples.",
          "Review the API documentation against the current implementation and report defects.",
          "Verify this runbook is complete and usable by its intended operator."
        ]
      }
    }
  ],
  "routing": {
    "positive_triggers": [
      "Check this migration guide for factual accuracy, missing prerequisites, and broken examples.",
      "Review the API documentation against the current implementation and report defects.",
      "Verify this runbook is complete and usable by its intended operator."
    ],
    "negative_boundaries": [
      "Review the current code diff for implementation defects.",
      "Rewrite this guide to improve its structure and wording.",
      "Synchronize the English and Traditional Chinese README files."
    ]
  }
});
