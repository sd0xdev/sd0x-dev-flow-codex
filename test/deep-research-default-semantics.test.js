'use strict';
// sd0x-migration-semantics target=deep-research unit=deep-research/default
const { defineSemanticContractTests } = require('../scripts/research-contract-test');
defineSemanticContractTests({
  "target": "deep-research",
  "targetPackage": "research-pack",
  "unit": "deep-research/default",
  "required": [
    "Evidence is `{source_id, publisher_id, author_id, identity_binding_hash, independence_key, source_type, agent_role, locator, content_hash, relation, weight}`",
    "Low is one inline shard, at most three fetched sources",
    "Record a redacted trace `{dispatch_id, role, scope_hash, prompt_template_hash, input_artifact_hashes[], started_at, completed_at, evidence_count}`",
    "Unknown, unverified, or mismatched declared identity is unresolved and contributes no cross-verification",
    "net_score = max(0, support - refute)"
  ],
  "forbidden": []
});
