'use strict';
// sd0x-migration-test target=explain unit=explain/default
const { defineRoutingContractTests } = require('../scripts/skill-routing-test');
defineRoutingContractTests({
  "target": "explain",
  "targetPackage": "research-pack",
  "unit": "explain/default",
  "registry": [
    {
      "unit": "explain/default",
      "routing": {
        "positive_triggers": [
          "Explain how this parser function works at an intermediate depth.",
          "Give me a beginner-friendly explanation of the selected module.",
          "Walk through this algorithm line by line and cite the code."
        ],
        "negative_boundaries": [
          "Change the parser to support another format.",
          "Investigate an intermittent production failure and determine its root cause.",
          "Map the architecture and data flow of the entire subsystem."
        ]
      }
    }
  ],
  "routing": {
    "positive_triggers": [
      "Explain how this parser function works at an intermediate depth.",
      "Give me a beginner-friendly explanation of the selected module.",
      "Walk through this algorithm line by line and cite the code."
    ],
    "negative_boundaries": [
      "Change the parser to support another format.",
      "Investigate an intermittent production failure and determine its root cause.",
      "Map the architecture and data flow of the entire subsystem."
    ]
  }
});
