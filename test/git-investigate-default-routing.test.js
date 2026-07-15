'use strict';
// sd0x-migration-test target=git-investigate unit=git-investigate/default
const { defineRoutingContractTests } = require('../scripts/skill-routing-test');
defineRoutingContractTests({
  "target": "git-investigate",
  "targetPackage": "research-pack",
  "unit": "git-investigate/default",
  "registry": [
    {
      "unit": "git-investigate/default",
      "routing": {
        "positive_triggers": [
          "Find when this validation branch was introduced and why.",
          "Trace the history of this function across renames and cite the commits.",
          "Use Git archaeology to identify the change that caused this regression."
        ],
        "negative_boundaries": [
          "Commit the regression fix and push it.",
          "Explain only how the current function works without historical context.",
          "Map the architecture of the entire validation subsystem."
        ]
      }
    }
  ],
  "routing": {
    "positive_triggers": [
      "Find when this validation branch was introduced and why.",
      "Trace the history of this function across renames and cite the commits.",
      "Use Git archaeology to identify the change that caused this regression."
    ],
    "negative_boundaries": [
      "Commit the regression fix and push it.",
      "Explain only how the current function works without historical context.",
      "Map the architecture of the entire validation subsystem."
    ]
  }
});
