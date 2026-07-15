'use strict';
// sd0x-migration-semantics target=code-investigate unit=code-investigate/default
const { defineSemanticContractTests } = require('../scripts/research-contract-test');
defineSemanticContractTests({
  "target": "code-investigate",
  "targetPackage": "research-pack",
  "unit": "code-investigate/default",
  "required": [
    "A configured Claude adapter receives the same neutral question and scope",
    "Native Codex develops Position A",
    "one model may not impersonate both positions"
  ],
  "forbidden": []
});
