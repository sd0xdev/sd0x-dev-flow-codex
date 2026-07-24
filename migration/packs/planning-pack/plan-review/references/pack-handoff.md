# Planning-Pack Handoff Specification

| Field | Value |
|---|---|
| Package | `planning-pack` |
| Canonical skill | `plan-review` |
| Unit | `plan-review/default` |
| Runtime dependency | One optional independent read-only reviewer |
| Writes | None; critique is response-only |
| Git authority | Read-only |
| Core review state | Never read or written as completion evidence |
| Core discovery | Forbidden |

A later separate-plugin repository must provide its own manifest, dependencies, installation tests, review/verification gates, and release authorization. Its readiness verdict must remain distinct from the core worktree review gate.
