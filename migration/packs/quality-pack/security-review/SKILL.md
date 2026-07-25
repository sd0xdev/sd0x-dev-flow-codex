---
name: security-review
description: "Route security-review using exact migration registry [{\"unit\":\"security-review/default\",\"routing\":{\"negative_boundaries\":[\"Assess general code quality and maintainability for merge readiness.\",\"Check current dependency advisories across the whole lockfile.\",\"Estimate release risk across compatibility, rollout, and operations.\"],\"positive_triggers\":[\"Perform a threat-driven security review of this authentication change.\",\"Review this API diff for authorization, injection, secrets, and data exposure risks.\",\"Security-audit the selected module and provide evidence-backed findings.\"]}}]."
---

# Review Security

This skill provides a threat-driven, read-only security review of a bounded implementation or change.

## Protocol

1. Establish assets, trust boundaries, actors, data classifications, entrypoints, dependencies, and attacker capabilities.
2. Trace authentication, authorization, validation, output encoding, secrets, cryptography, logging, storage, network calls, and failure handling.
3. Inspect changed code and reachable callers rather than pattern matching isolated lines.
4. Check current authoritative advisories when dependency or platform risk matters; cite lookup time and sources.
5. Validate exploit preconditions safely. Do not execute destructive payloads, access real credentials, or expose secret values.
6. Classify findings by likelihood, impact, affected asset, evidence, remediation, and regression protection.

## Result

Report the threat model, inspected surface, findings by severity, positive controls, unknowns, and security gate.

<!-- sd0x-routing-contract:v1 unit=security-review/default -->
```json
{
  "positive_triggers": [
    "Perform a threat-driven security review of this authentication change.",
    "Review this API diff for authorization, injection, secrets, and data exposure risks.",
    "Security-audit the selected module and provide evidence-backed findings."
  ],
  "negative_boundaries": [
    "Assess general code quality and maintainability for merge readiness.",
    "Check current dependency advisories across the whole lockfile.",
    "Estimate release risk across compatibility, rollout, and operations."
  ]
}
```
