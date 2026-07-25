'use strict';
// sd0x-migration-test target=check-coverage unit=check-coverage/default
const { defineRoutingContractTests } = require('../scripts/skill-routing-test');
defineRoutingContractTests({
  "target": "check-coverage",
  "targetPackage": "quality-pack",
  "unit": "check-coverage/default",
  "registry": [
    {
      "unit": "check-coverage/default",
      "routing": {
        "negative_boundaries": [
          "Add the missing unit and integration tests now.",
          "Judge whether these individual tests are well written and non-flaky.",
          "Run the repository verification gate and record its evidence."
        ],
        "positive_triggers": [
          "Analyze unit, integration, and end-to-end coverage gaps for the refund feature.",
          "Map this feature's source branches to existing tests and identify missing cases.",
          "Review the three-layer test coverage for the authentication request."
        ]
      }
    }
  ],
  "routing": {
    "positive_triggers": [
      "Analyze unit, integration, and end-to-end coverage gaps for the refund feature.",
      "Map this feature's source branches to existing tests and identify missing cases.",
      "Review the three-layer test coverage for the authentication request."
    ],
    "negative_boundaries": [
      "Add the missing unit and integration tests now.",
      "Judge whether these individual tests are well written and non-flaky.",
      "Run the repository verification gate and record its evidence."
    ]
  }
});
