'use strict';
// sd0x-migration-test target=code-explore unit=code-explore/default
const { defineRoutingContractTests } = require('../scripts/skill-routing-test');
defineRoutingContractTests({
  "target": "code-explore",
  "targetPackage": "core",
  "unit": "code-explore/default",
  "registry": [
    {
      "unit": "code-explore/default",
      "routing": {
        "negative_boundaries": [
          "Change the request handler to add invoice retries.",
          "Find the commit that introduced this exact regression.",
          "Give a quick answer about where one configuration constant is defined."
        ],
        "positive_triggers": [
          "Map the architecture and execution flow for the authentication subsystem.",
          "Show how a request travels from the HTTP handler to persistence.",
          "Trace the data flow for invoice creation and identify the key files."
        ]
      }
    }
  ],
  "routing": {
    "positive_triggers": [
      "Map the architecture and execution flow for the authentication subsystem.",
      "Show how a request travels from the HTTP handler to persistence.",
      "Trace the data flow for invoice creation and identify the key files."
    ],
    "negative_boundaries": [
      "Change the request handler to add invoice retries.",
      "Find the commit that introduced this exact regression.",
      "Give a quick answer about where one configuration constant is defined."
    ]
  }
});
