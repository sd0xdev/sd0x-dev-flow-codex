'use strict';
// sd0x-migration-test target=post-dev-test unit=post-dev-test/default
const { defineRoutingContractTests } = require('../scripts/skill-routing-test');
defineRoutingContractTests({
  "target": "post-dev-test",
  "targetPackage": "development-pack",
  "unit": "post-dev-test/default",
  "registry": [
    {
      "unit": "post-dev-test/default",
      "routing": {
        "positive_triggers": [
          "Run the appropriate repository tests for the feature I just implemented.",
          "Test the completed API change with focused checks before broader suites.",
          "Validate this working-tree change with developer-facing test execution and exact failures."
        ],
        "negative_boundaries": [
          "Create missing tests for an untested parser behavior.",
          "Record the authoritative repository verification gate for this fingerprint.",
          "Run a risk-led deep investigation across every test layer and triage failures."
        ]
      }
    }
  ],
  "routing": {
    "positive_triggers": [
      "Run the appropriate repository tests for the feature I just implemented.",
      "Test the completed API change with focused checks before broader suites.",
      "Validate this working-tree change with developer-facing test execution and exact failures."
    ],
    "negative_boundaries": [
      "Create missing tests for an untested parser behavior.",
      "Record the authoritative repository verification gate for this fingerprint.",
      "Run a risk-led deep investigation across every test layer and triage failures."
    ]
  }
});
