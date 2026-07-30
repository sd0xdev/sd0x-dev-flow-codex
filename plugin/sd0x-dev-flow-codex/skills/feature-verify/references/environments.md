# Environment Configuration

Project-specific runtime configuration belongs in the untracked `.sd0x/feature-verify.json` file or may be supplied explicitly for the current task. This distributed reference is a schema guide and contains no active endpoint or credential.

## Required Environment Fields

| Field | Meaning |
|---|---|
| name | test, staging, or explicitly selected production environment |
| base_url | Absolute HTTPS origin with no embedded credential |
| deployment_identity | Expected immutable version, commit, or artifact digest |
| health_path | Allowlisted read-only health path |
| endpoints | Exact normalized method and path allowlist |
| limits | Connect timeout, total timeout, request bytes, response bytes, and retry count |

Each endpoint entry records method, normalized path template, read-only rationale, accepted status classes, response fields permitted in evidence, and whether an authoritative contract documents a query-style POST. Wildcard hosts, schemes, ports, traversal, userinfo, and method overrides are invalid.

## Authentication

Configuration may name a connected credential profile but never contains a credential value. Authentication headers, cookies, tokens, and signed URLs are excluded from reports and digests. An unavailable profile causes the corresponding probe to remain unexecuted.

## Logs and Metrics

Log and metric sources name a read-only connected capability, exact dataset or namespace, bounded query window, permitted fields, and result-size limit. Query text is treated as data and cannot select an executable or arbitrary command.

## Reachability

Reachability uses at most three health reads with the configured bounds. A successful HTTP response, an authentication response, a transport failure, and a timeout are recorded separately. Endpoint probing remains fail-closed when this configuration or the endpoint allowlist is absent.
