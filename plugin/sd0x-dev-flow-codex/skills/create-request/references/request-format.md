# Request Ticket Format

Use this reference for create and update modes.

## Template

```markdown
# {Title}

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: {YYYY-MM-DD}
> **Implementation Base SHA**: `{40-character Git SHA}`
> **Status**: Pending
> **Priority**: {P0|P1|P2}
> **Depends On**: [Title](./request.md) <!-- omit when none -->
> **Superseded By**: [Replacement](./replacement.md) <!-- required only on Superseded tickets -->
> **Supersedes**: [Previous](./previous.md) <!-- required on the replacement ticket -->
> **Tech Spec**: [Title](../2-tech-spec.md) <!-- canonical filename may vary -->
> **Requirements**: [Title](../1-requirements.md) <!-- omit when absent -->

## Background

{Why this single task is needed.}

## Requirements

- {Required behavior}

## Scope

| Scope | Description |
|---|---|
| In | {Owned concern} |
| Out | {Explicitly excluded work} |

## Related Files

| File | Action | Description |
|---|---|---|
| `path/to/file` | New/Update/Read | {Role in this request} |

## Acceptance Criteria

- [ ] {Observable behavior with deterministic evidence}

## Progress

| Phase | Status | Note |
|---|---|---|
| Analysis | Pending | |
| Development | Pending | |
| Testing | Pending | |
| Acceptance | Pending | |

## References

- [Tech Spec](../2-tech-spec.md)
```

## Invariants

- Location: `docs/features/<feature>/requests/YYYY-MM-DD-<slug>.md`.
- One ticket owns one concern layer and no more than eight ACs.
- `Implementation Base SHA` is required for new tickets. Never invent a base for a
  legacy ticket; ask for an exact base or keep completion inconclusive.
- Canonical lifecycle: `Pending -> In Progress -> Candidate Complete -> Completed`.
- `Candidate Complete` means all ACs appear satisfied but durable closure-grade
  evidence is not recorded.
- `Superseded` is terminal only when the old ticket has `Superseded By`, the
  replacement has `Supersedes`, both links name contained sibling request files,
  and they point to each other.
- Quality gates may be ACs only when the target repository actually defines them.
- Related paths are repo-relative and must not escape through `..` or symlinks.

## Cross-links

- A request links to the canonical tech spec and to requirements when present.
- The tech spec links to every active request. Add or repair that link during create.
- Sibling dependencies use relative links and must remain acyclic.
- Never add a link to a document that does not exist.

## Evidence rules

- A commit is relevant only when it changes a listed implementation/test path after
  the implementation base; docs-only commits are not implementation evidence.
- A checked AC names its evidence in the Progress note or verifier result.
- Parser or verifier uncertainty is visible; it never becomes completion.
- Heuristic and batch updates stop at `Candidate Complete`.
