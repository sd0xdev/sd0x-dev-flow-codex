'use strict';
// sd0x-migration-test target=deep-research unit=deep-research/default
const { defineRoutingContractTests } = require('../scripts/skill-routing-test');
defineRoutingContractTests({
  "target": "deep-research",
  "targetPackage": "research-pack",
  "unit": "deep-research/default",
  "registry": [
    {
      "unit": "deep-research/default",
      "routing": {
        "positive_triggers": [
          "Compare database migration strategies using official sources, repository constraints, and real-world evidence.",
          "Conduct deep research on this technical decision from multiple independent source types.",
          "Research the current landscape and produce a claim registry with conflicts and confidence."
        ],
        "negative_boundaries": [
          "Answer a narrow repository question using one file.",
          "Implement the recommended database migration strategy.",
          "Trace only the internal execution path without external research."
        ]
      }
    }
  ],
  "routing": {
    "positive_triggers": [
      "Compare database migration strategies using official sources, repository constraints, and real-world evidence.",
      "Conduct deep research on this technical decision from multiple independent source types.",
      "Research the current landscape and produce a claim registry with conflicts and confidence."
    ],
    "negative_boundaries": [
      "Answer a narrow repository question using one file.",
      "Implement the recommended database migration strategy.",
      "Trace only the internal execution path without external research."
    ]
  }
});
