# Token Budget — Load Pull-Request Review

| Limit | Default | Hard cap |
|---|---|---|
| Loaded threads | 30 | 200 |
| Comments per thread | 20 | 20 |
| Comment body | 2,000 characters | 2,000 characters |
| Reply draft | 1,000 characters | 1,000 characters |

Unresolved threads precede resolved threads, current threads precede outdated threads, and newer activity precedes older activity. Stable thread identifiers break ties. Truncated bodies carry an explicit marker and digest. The summary reports total, unresolved, outdated, loaded, truncated, and degraded counts.

Optional seek-verdict work is selected by exact thread identifiers and remains serial unless the user explicitly requests bounded parallel analysis. A budget never changes mutation or gate authority.
