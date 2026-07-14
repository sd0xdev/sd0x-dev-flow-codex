# Planning-Pack Handoff Specification

| Field | Value |
|---|---|
| Package | `planning-pack` |
| Canonical skill | `request-tracking` |
| Unit | `request-tracking/default` |
| Request-format dependency | Date-prefixed request metadata, acceptance section, and reciprocal supersession contract |
| Writes | None; report is response-only |
| Git authority | None required |
| Closure evidence | Never read as permission and never mutated |
| Core discovery | Forbidden |

A later separate-plugin repository must provide its own manifest, dependencies, parser fixtures, installation tests, review/verification gates, and release authorization. It must keep portfolio reporting distinct from core request mutation.
