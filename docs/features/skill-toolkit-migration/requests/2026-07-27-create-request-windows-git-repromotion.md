# Create-Request Windows Git Re-promotion

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-07-27
> **Implementation Base SHA**: `873ed3abab1d333762cd67fed36f212f1a9998b7`
> **Status**: Completed
> **Priority**: P0
> **Depends On**: [Latest durable completion](./2026-07-23-create-request-recovery-repromotion.md)
> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)

## Background

Native Windows CI proved that Node's `os.devNull` spelling is not accepted as the
global configuration sink by Git for Windows. The shipped create-request resolver
therefore cannot discover its repository on Windows. This replacement owns the
portable clean-Git environment revision and the exact core re-promotion.

## Requirements

- Use `NUL` only on Windows and retain `os.devNull` on POSIX for every executable
  clean-Git environment in the released create-request and repository audit paths.
- Keep ambient Git selectors closed and preserve the exact validator contract.
- Re-promote the changed create-request payload through current closure evidence.

## Scope

| Scope | Description |
|---|---|
| In | Windows Git null-device normalization, native CI regression, create-request candidate closure and re-promotion |
| Out | New request lifecycle states, migration-pack payload revisions, user-level Codex installation |

## Related Files

| File | Action | Description |
|---|---|---|
| `migration/candidates/create-request/scripts/request-tool.js` | Update | Select the platform-correct global Git configuration sink |
| `scripts/skill-migration-audit.js` | Update | Execute and validate the portable clean-Git environment |
| `scripts/generate-skill-manifest.js` | Update | Keep manifest Git reads portable and selector-closed |
| `test/skill-migration.test.js` | Update | Exercise request, audit, and manifest Git paths on native Windows |
| `.github/workflows/ci.yml` | Update | Require the native Windows regression to run without skipping |
| `migration/source-disposition.json` | Update | Route create-request through a new candidate-to-promotion revision |

## Acceptance Criteria

- [x] The create-request resolver uses `NUL` on Windows and `os.devNull` on POSIX without inheriting ambient Git selectors.
- [x] Migration audit and manifest Git reads use the same platform-normalized null device.
- [x] The authoritative candidate validator requires the exact portable create-request environment declaration.
- [x] Native Windows CI requires successful non-skipped request-tool, audit, and manifest Git execution.
- [x] Focused create-request, manifest, migration, runtime, and workflow checks pass on Node.js 24.
- [x] The exact candidate is ready for preflight, primary review, deterministic verification, closure, final audit, and re-promotion.

## Progress

| Phase | Status | Note |
|---|---|---|
| Analysis | Complete | Native Windows logs isolated unsupported descriptor chmod and the Git `os.devNull` incompatibility. |
| Development | Complete | Portable Git sinks, atomic Windows mode creation, and fail-closed CI assertions are implemented. Candidate payload `596828e542bda34def7ea0a331a6bddeacb58f297fed00f360b02d5eff258ff0`. |
| Testing | Complete | Focused Node.js 24 suites, YAML parsing, and local plugin reload passed. Preflight `be581ac9d47380fe8516cb93b692527893b7a5fffa44081992a86ead64954f2a`; native Windows confirmation remains a required CI gate. |
| Acceptance | Complete | All six ACs have implementation and regression evidence; durable closure is recorded and exact re-promotion remains pending. |

## References

- [Tech Spec](../2-tech-spec.md)
- [Latest durable completion](./2026-07-23-create-request-recovery-repromotion.md)
