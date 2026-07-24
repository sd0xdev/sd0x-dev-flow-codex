'use strict';
// sd0x-migration-semantics target=explain unit=explain/default
const { defineSemanticContractTests } = require('../scripts/research-contract-test');
defineSemanticContractTests({
  "target": "explain",
  "targetPackage": "research-pack",
  "unit": "explain/default",
  "required": [
    "Check the explanation against tests and caller expectations",
    "Match beginner, intermediate, or expert depth to the request",
    "Read the complete relevant unit plus its callers, types, tests"
  ],
  "forbidden": []
});
