'use strict';
// sd0x-migration-test target=dev-security-audit unit=dev-security-audit/default
const { defineRoutingContractTests } = require('../scripts/skill-routing-test');
defineRoutingContractTests({
  "target": "dev-security-audit",
  "targetPackage": "core",
  "unit": "dev-security-audit/default",
  "registry": [
    {
      "unit": "dev-security-audit/default",
      "routing": {
        "negative_boundaries": [
          "Do not run dev-security-audit; only execute deterministic repository verification.",
          "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
          "Only review the current code changes for correctness and defects."
        ],
        "positive_triggers": [
          "Apply the canonical dev-security-audit workflow and report its evidence.",
          "Help me run the dev-security-audit workflow for this repository.",
          "I need the canonical dev-security-audit procedure with its safety boundaries."
        ]
      }
    }
  ],
  "routing": {
    "positive_triggers": [
      "Apply the canonical dev-security-audit workflow and report its evidence.",
      "Help me run the dev-security-audit workflow for this repository.",
      "I need the canonical dev-security-audit procedure with its safety boundaries."
    ],
    "negative_boundaries": [
      "Do not run dev-security-audit; only execute deterministic repository verification.",
      "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
      "Only review the current code changes for correctness and defects."
    ]
  }
});
