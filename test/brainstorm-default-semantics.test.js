'use strict';
// sd0x-migration-semantics target=brainstorm unit=brainstorm/default
const { defineSemanticContractTests } = require('../scripts/research-contract-test');
defineSemanticContractTests({
  "target": "brainstorm",
  "targetPackage": "research-pack",
  "unit": "brainstorm/default",
  "required": [
    "Apply precedence `divergent → conditional → pure → pareto`",
    "Conduct at most five attack/rebuttal rounds",
    "Every attack record is `{attack_id, target_claim_id, novelty_key, argument, evidence_refs[], proposed_by, validity}`",
    "one model may not impersonate both positions"
  ],
  "forbidden": [
    "at most three rounds"
  ]
});
