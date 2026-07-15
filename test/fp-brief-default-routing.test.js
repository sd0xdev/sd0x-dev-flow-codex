'use strict';
// sd0x-migration-test target=fp-brief unit=fp-brief/default
const { defineRoutingContractTests } = require('../scripts/skill-routing-test');
defineRoutingContractTests({
  "target": "fp-brief",
  "targetPackage": "research-pack",
  "unit": "fp-brief/default",
  "registry": [
    {
      "unit": "fp-brief/default",
      "routing": {
        "positive_triggers": [
          "Create a first-principles brief from this technical proposal.",
          "Decompose the assumptions behind our service migration decision.",
          "Turn these design notes into a reasoning chain with sensitivity analysis."
        ],
        "negative_boundaries": [
          "Implement the service migration described in the proposal.",
          "Perform a broad multi-source survey of service migration tools.",
          "Write a feature technical specification with implementation tasks."
        ]
      }
    }
  ],
  "routing": {
    "positive_triggers": [
      "Create a first-principles brief from this technical proposal.",
      "Decompose the assumptions behind our service migration decision.",
      "Turn these design notes into a reasoning chain with sensitivity analysis."
    ],
    "negative_boundaries": [
      "Implement the service migration described in the proposal.",
      "Perform a broad multi-source survey of service migration tools.",
      "Write a feature technical specification with implementation tasks."
    ]
  }
});
