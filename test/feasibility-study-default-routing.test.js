'use strict';
// sd0x-migration-test target=feasibility-study unit=feasibility-study/default
const { defineRoutingContractTests } = require('../scripts/skill-routing-test');
defineRoutingContractTests({
  "target": "feasibility-study",
  "targetPackage": "planning-pack",
  "unit": "feasibility-study/default",
  "registry": [
    {
      "unit": "feasibility-study/default",
      "routing": {
        "positive_triggers": [
          "Assess whether the proposed cache can be delivered within the stated technical and resource constraints.",
          "Compare credible implementation approaches with evidence, uncertainty, effort bands, and risk.",
          "Evaluate repository feasibility before committing to a technical design."
        ],
        "negative_boundaries": [
          "Decide whether the proposed feature is necessary for users or the business.",
          "Document the final component architecture and integration ownership.",
          "Write the implementation-ready technical specification and work breakdown."
        ]
      }
    }
  ],
  "routing": {
    "positive_triggers": [
      "Assess whether the proposed cache can be delivered within the stated technical and resource constraints.",
      "Compare credible implementation approaches with evidence, uncertainty, effort bands, and risk.",
      "Evaluate repository feasibility before committing to a technical design."
    ],
    "negative_boundaries": [
      "Decide whether the proposed feature is necessary for users or the business.",
      "Document the final component architecture and integration ownership.",
      "Write the implementation-ready technical specification and work breakdown."
    ]
  }
});
