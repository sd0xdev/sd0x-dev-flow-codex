# Alias Registry Capability

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-07-10
> **Implementation Base SHA**: `0b24525489ee3be9413ebf0d81e140eeadcc3fe7`
> **Status**: Pending
> **Priority**: P0
> **Depends On**: [R3 — Promotion Evidence Ledger](./2026-07-10-promotion-evidence-ledger-r3.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

Compatibility aliases are safe only if Codex exposes a registry-level mechanism that permits manual invocation while excluding the alias from automatic routing. Prompt sampling alone cannot prove that invariant.

## Requirements

- Probe the repository-only Codex registry for an inspectable manual-only/exclusion mechanism.
- Record machine-readable evidence or lock the migration permanently to mapping-only aliases for this Codex version.
- Add candidate-audit fixtures for the selected policy；do not promote any domain skill.

## Scope

| Scope | Description |
|---|---|
| In | Registry metadata/API inspection、manual invocation test、negative auto-route regression、evidence file |
| Out | Creating aliases without registry proof、broad routing quality evaluation、live domain promotion |

## Related Files

| File | Action | Description |
|---|---|---|
| `migration/alias-capability.json` | New | Version-bound registry evidence index and decision |
| `migration/evidence/alias-registry-dump.json` | New | Normalized/redacted reproducible registry artifact |
| `test/skill-migration.test.js` | Update | Alias-policy validation fixtures |
| `migration/source-disposition.json` | Update | Apply one evidence-backed alias policy |

## Acceptance Criteria

- [ ] Evidence records Codex version、registry mechanism、test alias、manual invocation、auto-route exclusion、normalized dump path/hash、fixture manifest、plugin fingerprint、reproduce argv and timestamp；the redacted artifact retains candidate/exclusion fields、removes user/account data and is hash-verifiable.
- [ ] `manual-only` passes only when an inspectable registry flag/API excludes the alias from automatic candidates while manual invocation succeeds.
- [ ] Prompt sampling is retained only as a negative regression and cannot by itself upgrade the policy.
- [ ] If registry proof is absent or ambiguous, every compatibility alias remains `mapping-only` and no alias skill directory is created.
- [ ] Candidate audit rejects a `manual-only` alias policy whose dump/fixture is missing、stale for Codex/plugin version or hash-mismatched.
- [ ] Repository-only reload/new-task procedure proves the recorded behavior without changing user-level `CODEX_HOME`.
- [ ] Decision and rationale are reflected in the tech spec and disposition overlay without unresolved alternatives.
- [ ] `npm run check` plus fingerprint-bound review/verify gates pass.

## Progress

| Phase | Status | Note |
|---|---|---|
| Analysis | Done | Registry-level proof is the only pass criterion |
| Development | Pending | |
| Testing | Pending | |
| Acceptance | Pending | |

## References

- [Tech Spec](../2-tech-spec.md)
- [R3 — Promotion Evidence Ledger](./2026-07-10-promotion-evidence-ledger-r3.md)
