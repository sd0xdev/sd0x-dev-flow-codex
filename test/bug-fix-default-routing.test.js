'use strict';
// sd0x-migration-test target=bug-fix unit=bug-fix/default
const { defineRoutingContractTests } = require('../scripts/skill-routing-test');
defineRoutingContractTests({
  "target": "bug-fix",
  "targetPackage": "core",
  "unit": "bug-fix/default",
  "registry": [
    {
      "unit": "bug-fix/default",
      "routing": {
        "positive_triggers": [
          "Correct the invoice rounding regression and add a test that proves the root cause.",
          "Fix the failing request parser after reproducing the error and tracing its execution path.",
          "Resolve this production behavior discrepancy with the narrowest tested code change."
        ],
        "negative_boundaries": [
          "Diagnose why the parser fails but do not change any files.",
          "Implement a new invoice discount feature from the approved specification.",
          "Review the current diff without modifying production code."
        ]
      }
    }
  ],
  "routing": {
    "positive_triggers": [
      "Correct the invoice rounding regression and add a test that proves the root cause.",
      "Fix the failing request parser after reproducing the error and tracing its execution path.",
      "Resolve this production behavior discrepancy with the narrowest tested code change."
    ],
    "negative_boundaries": [
      "Diagnose why the parser fails but do not change any files.",
      "Implement a new invoice discount feature from the approved specification.",
      "Review the current diff without modifying production code."
    ]
  }
});
