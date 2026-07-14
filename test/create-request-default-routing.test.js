'use strict';
// sd0x-migration-test target=create-request unit=create-request/default
const { defineRoutingContractTests } = require('../scripts/skill-routing-test');
defineRoutingContractTests({
  "target": "create-request",
  "targetPackage": "core",
  "unit": "create-request/default",
  "registry": [
    {
      "unit": "create-request/default",
      "routing": {
        "positive_triggers": [
          "Create a date-prefixed execution request from the approved technical specification.",
          "Scan incomplete request tickets and show the stale work dashboard.",
          "Update this request ticket from implementation evidence and verify its acceptance criteria."
        ],
        "negative_boundaries": [
          "Analyze the feature-wide problem and write prioritized requirements.",
          "Design the system architecture, risks, work breakdown, and testing strategy.",
          "Implement the approved request and modify production code."
        ]
      }
    }
  ],
  "routing": {
    "positive_triggers": [
      "Create a date-prefixed execution request from the approved technical specification.",
      "Scan incomplete request tickets and show the stale work dashboard.",
      "Update this request ticket from implementation evidence and verify its acceptance criteria."
    ],
    "negative_boundaries": [
      "Analyze the feature-wide problem and write prioritized requirements.",
      "Design the system architecture, risks, work breakdown, and testing strategy.",
      "Implement the approved request and modify production code."
    ]
  }
});
