'use strict';
// sd0x-migration-test target=code-investigate unit=code-investigate/default
const { defineRoutingContractTests } = require('../scripts/skill-routing-test');
defineRoutingContractTests({
  "target": "code-investigate",
  "targetPackage": "research-pack",
  "unit": "code-investigate/default",
  "registry": [
    {
      "unit": "code-investigate/default",
      "routing": {
        "positive_triggers": [
          "Ask Claude and Codex to independently confirm why this cache path differs in production.",
          "Get independent Claude and Codex confirmation of this parser root cause.",
          "Investigate this retry mechanism with separate Claude and Codex evidence."
        ],
        "negative_boundaries": [
          "Determine why this cache invalidation path behaves differently in production.",
          "Implement the cache invalidation fix now.",
          "Map the entire service architecture and all data flows."
        ]
      }
    }
  ],
  "routing": {
    "positive_triggers": [
      "Ask Claude and Codex to independently confirm why this cache path differs in production.",
      "Get independent Claude and Codex confirmation of this parser root cause.",
      "Investigate this retry mechanism with separate Claude and Codex evidence."
    ],
    "negative_boundaries": [
      "Determine why this cache invalidation path behaves differently in production.",
      "Implement the cache invalidation fix now.",
      "Map the entire service architecture and all data flows."
    ]
  }
});
