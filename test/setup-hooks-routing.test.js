'use strict';
// sd0x-migration-test target=setup unit=setup/hooks
const { defineRoutingContractTests } = require('../scripts/skill-routing-test');
defineRoutingContractTests({
  "target": "setup",
  "targetPackage": "core",
  "unit": "setup/hooks",
  "registry": [
    {
      "unit": "setup/default",
      "routing": {
        "negative_boundaries": [
          "Do not run setup; only execute deterministic repository verification.",
          "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
          "Only review the current code changes for correctness and defects."
        ],
        "positive_triggers": [
          "Apply the canonical setup workflow and report its evidence.",
          "Help me run the setup workflow for this repository.",
          "I need the canonical setup procedure with its safety boundaries."
        ]
      }
    },
    {
      "unit": "setup/guidance",
      "routing": {
        "negative_boundaries": [
          "Do not run setup guidance mode; only execute deterministic repository verification.",
          "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
          "Only review the current code changes for correctness and defects."
        ],
        "positive_triggers": [
          "Apply the canonical setup guidance mode workflow and report its evidence.",
          "Help me run the setup guidance mode workflow for this repository.",
          "I need the canonical setup guidance mode procedure with its safety boundaries."
        ]
      }
    },
    {
      "unit": "setup/hooks",
      "routing": {
        "negative_boundaries": [
          "Do not run setup hooks mode; only execute deterministic repository verification.",
          "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
          "Only review the current code changes for correctness and defects."
        ],
        "positive_triggers": [
          "Apply the canonical setup hooks mode workflow and report its evidence.",
          "Help me run the setup hooks mode workflow for this repository.",
          "I need the canonical setup hooks mode procedure with its safety boundaries."
        ]
      }
    },
    {
      "unit": "setup/scripts",
      "routing": {
        "negative_boundaries": [
          "Do not run setup scripts mode; only execute deterministic repository verification.",
          "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
          "Only review the current code changes for correctness and defects."
        ],
        "positive_triggers": [
          "Apply the canonical setup scripts mode workflow and report its evidence.",
          "Help me run the setup scripts mode workflow for this repository.",
          "I need the canonical setup scripts mode procedure with its safety boundaries."
        ]
      }
    }
  ],
  "routing": {
    "positive_triggers": [
      "Apply the canonical setup hooks mode workflow and report its evidence.",
      "Help me run the setup hooks mode workflow for this repository.",
      "I need the canonical setup hooks mode procedure with its safety boundaries."
    ],
    "negative_boundaries": [
      "Do not run setup hooks mode; only execute deterministic repository verification.",
      "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
      "Only review the current code changes for correctness and defects."
    ]
  }
});
