'use strict';
// sd0x-migration-test target=obsidian-cli unit=obsidian-cli/default
const { defineRoutingContractTests } = require('../scripts/skill-routing-test');
defineRoutingContractTests({
  "target": "obsidian-cli",
  "targetPackage": "core",
  "unit": "obsidian-cli/default",
  "registry": [
    {
      "unit": "obsidian-cli/default",
      "routing": {
        "negative_boundaries": [
          "Do not run obsidian-cli; only execute deterministic repository verification.",
          "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
          "Only review the current code changes for correctness and defects."
        ],
        "positive_triggers": [
          "Apply the canonical obsidian-cli workflow and report its evidence.",
          "Help me run the obsidian-cli workflow for this repository.",
          "I need the canonical obsidian-cli procedure with its safety boundaries."
        ]
      }
    }
  ],
  "routing": {
    "positive_triggers": [
      "Apply the canonical obsidian-cli workflow and report its evidence.",
      "Help me run the obsidian-cli workflow for this repository.",
      "I need the canonical obsidian-cli procedure with its safety boundaries."
    ],
    "negative_boundaries": [
      "Do not run obsidian-cli; only execute deterministic repository verification.",
      "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
      "Only review the current code changes for correctness and defects."
    ]
  }
});
