# Planning-Pack Handoff Specification

| Field | Value |
|---|---|
| Package | `planning-pack` |
| Canonical skill | `review-spec` |
| Unit | `review-spec/default` |
| Lifecycle dependency | Canonical requirements, technical-specification, and architecture document contracts |
| Runtime dependency | One optional independent read-only reviewer |
| External research | Optional, bounded to three official primary-source page fetches |
| Writes | None; review is response-only |
| Git authority | Read-only |
| Core review state | Never written or claimed |
| Core discovery | Forbidden |

A later separate-plugin repository must provide its own manifest, dependencies, lifecycle fixtures, installation tests, review/verification gates, and release authorization. It must keep spec review distinct from plan and code review.
