'use strict';
// sd0x-migration-semantics target=git-investigate unit=git-investigate/default
const { defineSemanticContractTests } = require('../scripts/research-contract-test');
defineSemanticContractTests({
  "target": "git-investigate",
  "targetPackage": "research-pack",
  "unit": "git-investigate/default",
  "required": [
    "Correlation with a commit is not proof of causation",
    "Never change the index, branch, worktree, references, remotes, or configuration",
    "follow line attribution, path history across renames"
  ],
  "forbidden": []
});
