'use strict';
// sd0x-migration-test target=debug unit=debug/default
const { defineRoutingContractTests } = require('../scripts/skill-routing-test');
defineRoutingContractTests({
  "target": "debug",
  "targetPackage": "development-pack",
  "unit": "debug/default",
  "registry": [
    {
      "unit": "debug/default",
      "routing": {
        "positive_triggers": [
          "Analyze this supplied failing command and output, then trace the execution path that produced them.",
          "Diagnose the intermittent cache failure and report the evidenced root cause without editing code.",
          "Trace why the request returns stale data and identify the failing invariant."
        ],
        "negative_boundaries": [
          "Implement a new cache invalidation feature from the approved specification.",
          "Patch the cache regression and add a regression test.",
          "Review the current cache diff for correctness and test gaps."
        ]
      }
    }
  ],
  "routing": {
    "positive_triggers": [
      "Analyze this supplied failing command and output, then trace the execution path that produced them.",
      "Diagnose the intermittent cache failure and report the evidenced root cause without editing code.",
      "Trace why the request returns stale data and identify the failing invariant."
    ],
    "negative_boundaries": [
      "Implement a new cache invalidation feature from the approved specification.",
      "Patch the cache regression and add a regression test.",
      "Review the current cache diff for correctness and test gaps."
    ]
  }
});
