'use strict';
// sd0x-migration-test target=contract-decode unit=contract-decode/default
const { defineRoutingContractTests } = require('../scripts/skill-routing-test');
defineRoutingContractTests({
  "target": "contract-decode",
  "targetPackage": "core",
  "unit": "contract-decode/default",
  "registry": [
    {
      "unit": "contract-decode/default",
      "routing": {
        "negative_boundaries": [
          "Do not run contract-decode; only execute deterministic repository verification.",
          "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
          "Only review the current code changes for correctness and defects."
        ],
        "positive_triggers": [
          "Apply the canonical contract-decode workflow and report its evidence.",
          "Help me run the contract-decode workflow for this repository.",
          "I need the canonical contract-decode procedure with its safety boundaries."
        ]
      }
    }
  ],
  "routing": {
    "positive_triggers": [
      "Apply the canonical contract-decode workflow and report its evidence.",
      "Help me run the contract-decode workflow for this repository.",
      "I need the canonical contract-decode procedure with its safety boundaries."
    ],
    "negative_boundaries": [
      "Do not run contract-decode; only execute deterministic repository verification.",
      "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
      "Only review the current code changes for correctness and defects."
    ]
  }
});
