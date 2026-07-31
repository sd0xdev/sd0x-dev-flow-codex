# Deep-Research Origin Identity Re-promotion

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-07-31
> **Implementation Base SHA**: `ebdca0cdb9fec4187bae7782aad6d2c04b5467fd`
> **Status**: Completed
> **Priority**: P0
> **Depends On**: [Wave 2 Deep Research Formal Plugin Promotion](./2026-07-28-wave2-deep-research-default-formal-promotion.md), [Formal Plugin Delivery Model](./2026-07-28-formal-plugin-delivery-model.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

The promoted `deep-research/default` payload required a signed identity registry for
every web source but shipped no production signer or registry adapter. Ordinary
official, secondary, and community web evidence therefore could not contribute to
the advertised mixed-source workflow. This replacement owner adds a conservative
HTTPS-origin identity path and re-promotes the changed payload without rewriting the
prior closure or promotion evidence.

## Requirements

- Derive publisher-level independence only from an already redirect-resolved,
  canonical HTTPS source URL and its exact origin.
- Preserve signed exact-source bindings as the optional authority for author-level
  community independence.
- Keep unresolved redirects, non-HTTPS sources, identity mismatches, and path-derived
  author guesses outside cross-verification.

## Scope

| Scope | Description |
|---|---|
| In | `deep-research/default` identity derivation, canonicalization, tests, payload manifest, closure and promotion revision |
| Out | Live URL fetching, external identity services, other research skills, and review-gate authority |

## Related Files

| File | Action | Description |
|---|---|---|
| `plugin/sd0x-dev-flow-codex/skills/deep-research/` | Update | Final origin-aware research payload after promotion |
| `migration/candidates/deep-research/` | New | Exact candidate revision before promotion |
| `scripts/research-contract-test.js` | Update | Official, secondary, community, and signed-binding regressions |
| `scripts/research-validators/deep-research.js` | Update | Trusted candidate validator mirror |
| `test/deep-research-default-semantics.test.js` | Read | Formal semantic contract entrypoint |
| `migration/source-disposition.json` | Update | Replacement owner and candidate-to-promotion lifecycle |

## Acceptance Criteria

- [x] Redirect-resolved canonical HTTPS sources derive exact-origin publisher identity without an external signer.
- [x] Canonicalization removes fragments and tracking parameters while preserving the order of remaining query parameters.
- [x] Official, authoritative-secondary, and community evidence can use the production origin identity path.
- [x] A signed community binding takes author-level precedence only when it contains a valid author; a signed null-author record preserves origin fallback.
- [x] Hostname suffixes and URL path segments never become organization or author identity.
- [x] Focused semantic, fingerprint, and migration checks pass with exact candidate and preflight identities ready for closure and promotion.

## Progress

| Phase | Status | Note |
|---|---|---|
| Analysis | Complete | The missing production identity path and conservative origin-level fallback were defined. |
| Development | Complete | Candidate payload `1596f1e2ad823b776ca1c13dd2ddb55d817a8372b76612aa7bda1d21a6841054` implements the conservative origin identity and signed-author fallback contract. |
| Testing | Complete | Semantic, canonicalization, routing, fingerprint-portability, and candidate checks pass. Preflight `71b3aa8a9e0db13e4aa6c7879e90dc36bc09b8bc0d92fd1a7543f6268a327e5f`. Final audit `624e6a3bd6295f1325928ff0aa5c855930e0dcdf88e22226a914c833d56b9d26` passed. |
| Acceptance | Complete | Independent AC verification is Complete/High; runtime-owned closure evidence binds this Completed owner. |

## References

- [Tech Spec](../2-tech-spec.md)
- [Prior formal promotion](./2026-07-28-wave2-deep-research-default-formal-promotion.md)
