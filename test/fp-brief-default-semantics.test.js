'use strict';
// sd0x-migration-semantics target=fp-brief unit=fp-brief/default
const { defineSemanticContractTests } = require('../scripts/research-contract-test');
defineSemanticContractTests({
  "target": "fp-brief",
  "targetPackage": "research-pack",
  "unit": "fp-brief/default",
  "required": [
    "Build an assumptions register",
    "Construct the reasoning chain from premises to conclusion",
    "Test decision sensitivity"
  ],
  "forbidden": []
});
