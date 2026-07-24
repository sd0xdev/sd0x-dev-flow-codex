'use strict';
// sd0x-migration-semantics target=seek-verdict unit=seek-verdict/default
const { defineSemanticContractTests } = require('../scripts/research-contract-test');
defineSemanticContractTests({
  "target": "seek-verdict",
  "targetPackage": "research-pack",
  "unit": "seek-verdict/default",
  "required": [
    "A P0/P1 candidate binds `finding_key + fingerprint + dismissal_evidence_hash`",
    "Counter persistence is limited to Git metadata or the .sd0x directory",
    "confidence ≥ 0.95 and 4 independent evidence",
    "one model may not impersonate both roles"
  ],
  "forbidden": []
});
