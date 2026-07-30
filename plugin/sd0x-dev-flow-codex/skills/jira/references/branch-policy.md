# Branch Policy — Jira Issue to Branch Name

## Issue Type to Branch Prefix

| Jira issue type | Prefix |
|---|---|
| Bug | `fix` |
| Story | `feat` |
| Task | `feat` |
| Sub-task | `feat` |
| Documentation | `docs` |
| Other | `feat` |

An explicit type override accepts only `feat`, `fix`, `docs`, or `refactor`.

## Slug Algorithm

Lowercase the summary, retain ASCII letters, digits, spaces, and hyphens, trim the result, collapse spaces to one hyphen, collapse repeated hyphens, remove leading and trailing hyphens, and cap the slug at 40 characters. An empty slug is an error.

The initial name consists of prefix, issue key, and slug separated by one slash and hyphens. Collision suffixes begin at 2 and increase deterministically. Validate the final name with the version-control ref-format checker before preview or creation.

## Collision Evidence

Read local branch names with a direct fixed argv call. When an origin remote is configured, query only the exact candidate ref with a second fixed argv call. A missing origin produces local-only evidence. A remote lookup failure is a warning and prevents claiming remote uniqueness.

The creation preview is bound to repository root, current HEAD object ID, issue summary digest, chosen prefix, final branch name, and collision evidence. Execution revalidates every bound field and creates only the previewed local branch.
