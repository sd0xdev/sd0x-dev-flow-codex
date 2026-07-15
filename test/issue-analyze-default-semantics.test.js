'use strict';
// sd0x-migration-semantics target=issue-analyze unit=issue-analyze/default
const { defineSemanticContractTests } = require('../scripts/research-contract-test');
defineSemanticContractTests({
  "target": "issue-analyze",
  "targetPackage": "research-pack",
  "unit": "issue-analyze/default",
  "required": [
    "A Claude-origin finding goes to native Codex",
    "Human review is mandatory before dismissing a credible P0 or P1 finding",
    "a native-Codex finding goes to the configured Claude adapter"
  ],
  "forbidden": []
});
