'use strict';
// sd0x-migration-test target=necessity-audit unit=necessity-audit/default
const { defineRoutingContractTests } = require('../scripts/skill-routing-test');
defineRoutingContractTests({
  "target": "necessity-audit",
  "targetPackage": "planning-pack",
  "unit": "necessity-audit/default",
  "registry": [
    {
      "unit": "necessity-audit/default",
      "routing": {
        "positive_triggers": [
          "Audit whether the proposed multi-tenant configuration is necessary now or is speculative over-design.",
          "Challenge each requirement and abstraction against user value, status quo, and cheaper alternatives.",
          "Identify removable scope and explicit stop criteria before feasibility or design begins."
        ],
        "negative_boundaries": [
          "Compare technical implementation approaches by feasibility, effort, and risk.",
          "Implement the approved simplifications and modify production code.",
          "Review whether the existing plan is internally coherent and complete."
        ]
      }
    }
  ],
  "routing": {
    "positive_triggers": [
      "Audit whether the proposed multi-tenant configuration is necessary now or is speculative over-design.",
      "Challenge each requirement and abstraction against user value, status quo, and cheaper alternatives.",
      "Identify removable scope and explicit stop criteria before feasibility or design begins."
    ],
    "negative_boundaries": [
      "Compare technical implementation approaches by feasibility, effort, and risk.",
      "Implement the approved simplifications and modify production code.",
      "Review whether the existing plan is internally coherent and complete."
    ]
  }
});
