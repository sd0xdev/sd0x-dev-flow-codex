'use strict';
// sd0x-migration-test target=request-tracking unit=request-tracking/default
const { defineRoutingContractTests } = require('../scripts/skill-routing-test');
defineRoutingContractTests({
  "target": "request-tracking",
  "targetPackage": "core",
  "unit": "request-tracking/default",
  "registry": [
    {
      "unit": "request-tracking/default",
      "routing": {
        "negative_boundaries": [
          "Create or update a date-prefixed execution request ticket.",
          "Scan only incomplete requests and show the operational work queue.",
          "Verify one request acceptance criteria and mark its completion status."
        ],
        "positive_triggers": [
          "Build a read-only cross-feature request portfolio report with status, priority, age, blockers, and parse errors.",
          "Show request health trends and broken dependency links without editing any tickets.",
          "Summarize all active and terminal request metadata for planning governance."
        ]
      }
    }
  ],
  "routing": {
    "positive_triggers": [
      "Build a read-only cross-feature request portfolio report with status, priority, age, blockers, and parse errors.",
      "Show request health trends and broken dependency links without editing any tickets.",
      "Summarize all active and terminal request metadata for planning governance."
    ],
    "negative_boundaries": [
      "Create or update a date-prefixed execution request ticket.",
      "Scan only incomplete requests and show the operational work queue.",
      "Verify one request acceptance criteria and mark its completion status."
    ]
  }
});
