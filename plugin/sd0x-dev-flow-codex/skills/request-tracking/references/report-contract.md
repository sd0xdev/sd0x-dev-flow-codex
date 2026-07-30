# Request Portfolio Report Contract

| Field | Rule |
|---|---|
| Discovery | Direct Markdown children of each request and archived directory; no symlink traversal |
| Metadata precedence | Canonical blockquote fields before legacy table fields |
| Metadata window | Before the first level-two heading; legacy table limited to the first fifteen lines |
| Acceptance progress | Task boxes inside Acceptance Criteria only |
| Terminal labels | `Completed`, `Done`, `Superseded`; malformed terminal records remain errors |
| Candidate state | `Candidate Complete` remains active until durable closure evidence exists |
| Age | Valid created/filename date against current local date; no filesystem timestamps |
| Stale | Pending and older than thirty days |
| Links | Contained sibling Markdown targets with reciprocal supersession validation |
| Sort | Status group, priority, oldest creation date, canonical path |
| Error handling | Keep per-file errors visible and continue unrelated records |

The report does not read or write durable closure refs. Source metadata is a claim to validate structurally, not proof that implementation or gates passed.
