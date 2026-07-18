'use strict';
// sd0x-migration-test target=simplify unit=simplify/default
const { defineRoutingContractTests } = require('../scripts/skill-routing-test');
defineRoutingContractTests({
  "target": "simplify",
  "targetPackage": "development-pack",
  "unit": "simplify/default",
  "registry": [
    {
      "unit": "simplify/default",
      "routing": {
        "positive_triggers": [
          "Reduce duplication in this single helper without changing its behavior.",
          "Simplify this small function by flattening unnecessary nesting.",
          "Streamline the named code path with the smallest behavior-preserving edit."
        ],
        "negative_boundaries": [
          "Design a replacement architecture for the entire billing subsystem.",
          "Implement a new helper capability and expose it through the API.",
          "Refactor several modules around a new responsibility boundary."
        ]
      }
    }
  ],
  "routing": {
    "positive_triggers": [
      "Reduce duplication in this single helper without changing its behavior.",
      "Simplify this small function by flattening unnecessary nesting.",
      "Streamline the named code path with the smallest behavior-preserving edit."
    ],
    "negative_boundaries": [
      "Design a replacement architecture for the entire billing subsystem.",
      "Implement a new helper capability and expose it through the API.",
      "Refactor several modules around a new responsibility boundary."
    ]
  }
});
