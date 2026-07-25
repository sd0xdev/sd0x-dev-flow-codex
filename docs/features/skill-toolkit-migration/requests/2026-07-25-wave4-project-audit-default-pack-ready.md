# Wave 4 Project Audit Default Pack Readiness

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-07-25
> **Implementation Base SHA**: `2631aaff15b4a829f54ac34c2365887b0cb3e0e1`
> **Status**: Candidate Complete
> **Priority**: P0
> **Depends On**: [R4 — Alias Registry Capability](./2026-07-10-skill-alias-capability-r4.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

`project-audit` source behavior is assigned to the canonical `project-audit/default` owner. This ticket owns that exact promotion unit and its Codex-native delivery evidence.

## Requirements

- Preserve the bounded repository health assessment workflow while replacing source-runtime assumptions with Codex-native tools, authority, and evidence contracts.
- Keep `project-audit/default` as the only positive owner for its exact prompt contract.

## Scope

| Scope | Description |
|---|---|
| In | Audit and prepare the `project-audit/default` payload, routing contract, and durable completion evidence. |
| Out | Other wave units, compatibility entrypoints, and publication of separate pack repositories |

## Related Files

| File | Action | Description |
|---|---|---|
| `migration/staging/project-audit/` | Read | Canonical source evidence |
| `migration/candidates/project-audit/` | New | Audited Codex-native candidate |
| `migration/packs/quality-pack/project-audit/` | New | Final quality-pack payload |
| `test/project-audit-default-routing.test.js` | New | Trusted routing contract |
| `migration/source-disposition.json` | Update | Unit ownership and delivery evidence |

## Acceptance Criteria

- [x] Candidate preserves the complete repository health assessment workflow and its meaningful failure boundaries.
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
| Development | Complete | Candidate payload `f2a1712b414f5a7de9904cad99997d449777635e8bc1d9daac652bae9260b2c3` and its closed behavior contract are complete. |
| Testing | Complete | Preflight `57fae5158de7a112bd302e94bab7a540ce7d6a434d665a07e9357571d06134dc` binds the candidate payload, routing tests, and disposition rows. |
| Acceptance | Candidate Complete | Candidate evidence is complete; final audit and durable R3 closure remain pending. |

## References

- Tech Spec: [Skill Toolkit Migration](../2-tech-spec.md)
