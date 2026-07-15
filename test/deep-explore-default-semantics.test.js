'use strict';
// sd0x-migration-semantics target=deep-explore unit=deep-explore/default
const { defineSemanticContractTests } = require('../scripts/research-contract-test');
defineSemanticContractTests({
  "target": "deep-explore",
  "targetPackage": "research-pack",
  "unit": "deep-explore/default",
  "required": [
    "Stop complete only when score is at least 80 and critical_open equals zero",
    "Wave three is allowed only for a cross-cutting critical gap, findings more than 70% concentrated in one subsystem, or a high-risk auth/security/migration domain",
    "Zero findings score 70",
    "score = round(100 × (0.7 × (1 - novelty_rate) + 0.3 × is_zero(critical_open)))"
  ],
  "forbidden": []
});
