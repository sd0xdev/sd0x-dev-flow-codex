'use strict';
// sd0x-migration-test target=zh-tw unit=zh-tw/default
const { defineRoutingContractTests } = require('../scripts/skill-routing-test');
defineRoutingContractTests({
  "target": "zh-tw",
  "targetPackage": "core",
  "unit": "zh-tw/default",
  "registry": [
    {
      "unit": "zh-tw/default",
      "routing": {
        "negative_boundaries": [
          "Do not run zh-tw; only execute deterministic repository verification.",
          "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
          "Only review the current code changes for correctness and defects."
        ],
        "positive_triggers": [
          "Apply the canonical zh-tw workflow and report its evidence.",
          "Help me run the zh-tw workflow for this repository.",
          "I need the canonical zh-tw procedure with its safety boundaries."
        ]
      }
    }
  ],
  "routing": {
    "positive_triggers": [
      "Apply the canonical zh-tw workflow and report its evidence.",
      "Help me run the zh-tw workflow for this repository.",
      "I need the canonical zh-tw procedure with its safety boundaries."
    ],
    "negative_boundaries": [
      "Do not run zh-tw; only execute deterministic repository verification.",
      "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
      "Only review the current code changes for correctness and defects."
    ]
  }
});
