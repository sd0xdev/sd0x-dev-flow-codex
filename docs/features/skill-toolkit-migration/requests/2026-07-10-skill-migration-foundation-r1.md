# Source Snapshot and Manifest

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-07-10
> **Implementation Base SHA**: `0b24525489ee3be9413ebf0d81e140eeadcc3fe7`
> **Status**: In Progress
> **Priority**: P0
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

全量遷移需要先固定 primary Git tree 與兩個 ignored local-only skills，建立可重現的 composite 100/100 inventory；不能把 dirty sibling working tree 的 100 skills 誤稱為 pinned commit 內容。

## Requirements

- 只從 Git objects 匯入 primary 98-skill snapshot，另依 tech spec 的 exact path/size/hash 匯入 2-skill local overlay，建立 tracked shadow copy與 attribution。
- 對每個 source skill 記錄 closed disposition、promotion unit 與完整 raw-byte hashes。
- 只建立 inventory generator；validator、portable evidence ledger、registry capability experiment 分別由 R2/R3/R4 負責。

## Scope

| Scope | Description |
|---|---|
| In | Git-object primary mirror、exact-hash local overlay、license/NOTICE attribution、inventory generator、manifest schema/data |
| Out | Candidate validators、alias experiment、live skill promotion、external writes |

## Related Files

| File | Action | Description |
|---|---|---|
| `migration/source-inventory.generated.json` | New | Immutable source SHA、file hashes and totals |
| `migration/source-disposition.json` | New | Mutable 100-row planning/promotion overlay |
| `migration/staging/` | New | Pinned source `skills/` mirror；never distributed/discovered |
| `migration/staging/LICENSE.upstream` | New | Raw-byte upstream MIT attribution |
| `scripts/generate-skill-manifest.js` | New | Deterministic manifest generator |
| `scripts/initialize-skill-disposition.js` | New | One-time, no-overwrite planning seed initializer |
| `test/skill-manifest.test.js` | New | Counts、hash、schema、stable ordering |
| `package.json` | Update | Repository-local generation/check commands |
| `docs/features/skill-toolkit-migration/2-tech-spec.md` | Update | Record decisions and actual counts |

## Acceptance Criteria

- [x] Git-object enumeration reproduces primary 98/263/138/25 without working-tree files；the three whitelisted overlay paths match 2/3/1/0 and raw hashes，and the local source record preserves origin repo、relative acquisition path、observed HEAD/date；missing/mismatch blocks rather than silently repinning.
- [x] Inventory and disposition overlay each have exactly the same 100 unique source names；compose is lossless by `source_name`.
- [x] Every overlay row has closed disposition、derived target package、target/mode、alias policy、wave、routing owner/unit、rationale/license；sorted mode catalog is complete，while capabilities/operations may remain empty only before delivery.
- [x] Composed inventory proves exactly 100 skills、266 files、139 references、25 scripts；external dependencies have closed kind、raw-byte hash and stable unique consumers without changing totals.
- [x] `LICENSE.upstream` and any upstream NOTICE are copied raw-byte and their hashes bind every approved MIT status.
- [x] Generator output is byte-for-byte stable for the same tracked composite staging and never reads/overwrites the mutable disposition overlay.
- [x] Shadow staging is outside plugin manifest/local discovery paths; no live skill payload changes are made.
- [ ] Clean Git-tree + local-overlay fixtures, inventory/compose tests and fingerprint-bound review/verify gates pass.

## Progress

| Phase | Status | Note |
|---|---|---|
| Analysis | Done | Baseline: primary 98/263/138/25 + overlay 2/3/1/0 = 100/266/139/25 |
| Development | Done | Pinned snapshot、inventory、disposition seed、attribution and commands implemented |
| Testing | Done | 13 focused tests pass；tracked/source manifest checks are byte-stable |
| Acceptance | In Progress | Independent review and fingerprint-bound verification remain |

## References

- [Tech Spec](../2-tech-spec.md)
- Primary: `sd0x-dev-flow@f4187c53eb746b6f84eb1f413e7210bd506e6db9`
- Local overlay: exact three-file hash table in [Tech Spec §3.4](../2-tech-spec.md#34-source-manifest-contract)
