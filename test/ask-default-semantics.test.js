'use strict';
// sd0x-migration-semantics target=ask unit=ask/default
const { defineSemanticContractTests } = require('../scripts/research-contract-test');
defineSemanticContractTests({
  "target": "ask",
  "targetPackage": "research-pack",
  "unit": "ask/default",
  "required": [
    "Before returning evidence, replace every high-confidence credential value with exact [REDACTED]",
    "Never read `.env`, `credentials.*`, `*secret*`",
    "Reject absolute paths, traversal, symlink escapes"
  ],
  "forbidden": []
});
