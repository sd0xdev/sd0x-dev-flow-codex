'use strict';
// sd0x-migration-semantics target=architecture-advice unit=architecture-advice/default
const { defineSemanticContractTests } = require('../scripts/research-contract-test');
defineSemanticContractTests({
  "target": "architecture-advice",
  "targetPackage": "research-pack",
  "unit": "architecture-advice/default",
  "required": [
    "Challenge the preferred option with the strongest counterexample",
    "Develop at least two credible options independently",
    "Keep repository and Git access read-only"
  ],
  "forbidden": []
});
