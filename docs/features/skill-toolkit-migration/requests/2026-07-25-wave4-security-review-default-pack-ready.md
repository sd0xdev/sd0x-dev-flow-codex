# Wave 4 Security Review Default Pack Readiness

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-07-25
> **Implementation Base SHA**: `2631aaff15b4a829f54ac34c2365887b0cb3e0e1`
> **Status**: Candidate Complete
> **Priority**: P0
> **Depends On**: [R4 — Alias Registry Capability](./2026-07-10-skill-alias-capability-r4.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

`codex-security` and `security-review` source behavior is assigned to the canonical `security-review/default` owner. This ticket owns that exact promotion unit and its Codex-native delivery evidence.

## Requirements

- Preserve the bounded threat-driven security review workflow while replacing source-runtime assumptions with Codex-native tools, authority, and evidence contracts.
- Keep `security-review/default` as the only positive owner for its exact prompt contract.
- Keep `codex-security` mapping-only without discovered compatibility entrypoints.

## Scope

| Scope | Description |
|---|---|
| In | Audit and prepare the `security-review/default` payload, routing contract, and durable completion evidence. |
| Out | Other wave units, compatibility entrypoints, and publication of separate pack repositories |

## Related Files

| File | Action | Description |
|---|---|---|
| `migration/staging/codex-security/` | Read | Canonical source evidence |
| `migration/candidates/security-review/` | New | Audited Codex-native candidate |
| `migration/packs/quality-pack/security-review/` | New | Final quality-pack payload |
| `test/security-review-default-routing.test.js` | New | Trusted routing contract |
| `migration/source-disposition.json` | Update | Unit ownership and delivery evidence |

## Acceptance Criteria

- [x] Candidate preserves the complete threat-driven security review workflow and its meaningful failure boundaries.
- [x] Contract binds every assigned source name to this single canonical promotion unit.
- [x] Compatibility aliases remain mapping-only and add no discovered skill entrypoints.
- [x] Trusted routing tests distinguish positive prompts from adjacent skill boundaries.
- [x] Candidate preflight binds exact payload and behavioral-test identity.
- [x] Final pack destination and move-window comparison are fixed for the accepted candidate bytes.
- [x] R3 closure inputs identify this exact request, promotion unit, evidence kind, and final-fingerprint fields.

## Progress

| Phase | Status | Note |
|---|---|---|
| Analysis | Complete | Source ownership, mode boundary, and target package are fixed by the migration registry. |
| Development | Complete | Candidate payload `0a57f34593f1a57c43bf5f861ebc534683fac4b283bad36c24ff3aafb5098d3f` and its closed behavior contract are complete. |
| Testing | Complete | Preflight `6c2feb0613b15fb29471495a8336c72d7c5bda34b266e66ac6a9e72a32d1bab2` binds the candidate payload, routing tests, and disposition rows. |
| Acceptance | Candidate Complete | Candidate evidence is complete; final audit and durable R3 closure remain pending. |

## References

- Tech Spec: [Skill Toolkit Migration](../2-tech-spec.md)
