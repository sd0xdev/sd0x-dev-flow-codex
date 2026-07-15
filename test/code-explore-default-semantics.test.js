'use strict';
// sd0x-migration-semantics target=code-explore unit=code-explore/default
const { defineSemanticContractTests } = require('../scripts/research-contract-test');
defineSemanticContractTests({
  "target": "code-explore",
  "targetPackage": "research-pack",
  "unit": "code-explore/default",
  "required": [
    "Record file and symbol evidence at every material hop",
    "Start breadth-first",
    "Stop after the requested architecture, execution flow, and data flow can be explained"
  ],
  "forbidden": []
});
