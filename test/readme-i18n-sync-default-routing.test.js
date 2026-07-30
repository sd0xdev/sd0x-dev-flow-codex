'use strict';
// sd0x-migration-test target=readme-i18n-sync unit=readme-i18n-sync/default
const { defineRoutingContractTests } = require('../scripts/skill-routing-test');
defineRoutingContractTests({
  "target": "readme-i18n-sync",
  "targetPackage": "core",
  "unit": "readme-i18n-sync/default",
  "registry": [
    {
      "unit": "readme-i18n-sync/default",
      "routing": {
        "negative_boundaries": [
          "Do not run readme-i18n-sync; only execute deterministic repository verification.",
          "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
          "Only review the current code changes for correctness and defects."
        ],
        "positive_triggers": [
          "Apply the canonical readme-i18n-sync workflow and report its evidence.",
          "Help me run the readme-i18n-sync workflow for this repository.",
          "I need the canonical readme-i18n-sync procedure with its safety boundaries."
        ]
      }
    }
  ],
  "routing": {
    "positive_triggers": [
      "Apply the canonical readme-i18n-sync workflow and report its evidence.",
      "Help me run the readme-i18n-sync workflow for this repository.",
      "I need the canonical readme-i18n-sync procedure with its safety boundaries."
    ],
    "negative_boundaries": [
      "Do not run readme-i18n-sync; only execute deterministic repository verification.",
      "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
      "Only review the current code changes for correctness and defects."
    ]
  }
});
