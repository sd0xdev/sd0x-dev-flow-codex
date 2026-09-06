---
name: op-session
description: "Diagnose existing 1Password CLI session readiness using non-secret metadata and explain supported interactive setup. Does not sign in or read secrets."
---

# 1Password Session Readiness

Diagnose whether the existing 1Password CLI installation can serve a later, separately authorized secret-consuming workflow. This skill is read-only: it never signs in, requests or captures a session token, writes a session file, changes an account, reads an item, launches the desktop application, or clears authentication state.

## Readiness checks

1. Resolve the existing 1Password executable through a fixed capability lookup and report its version without modifying PATH or installing software.
2. With fixed literal arguments and a bounded timeout, query account inventory metadata and current identity status. An explicitly supplied account selector must match one exact non-secret account identifier; ambiguous or absent selectors stop the check.
3. Distinguish unavailable CLI, no configured account, signed-out state, locked desktop integration, expired session, IPC failure, and version incompatibility. Do not infer readiness from process status alone when the bounded response reports an error.
4. Redact account emails, user identifiers, vault names, item references, tokens, environment values, and response bodies. Record only capability state, selected account fingerprint, authentication mode when the CLI reports it, duration, and bounded diagnostic category.

## Supported setup guidance

Explain the official interactive sign-in or desktop-integration steps the user may perform in their own terminal. Never emit a token-bearing command, shell wrapper, environment export, credential cache format, or copy-paste secret reference. Do not recommend storing session tokens on disk or passing them in process arguments.

After the user performs setup independently, a new readiness check may query current identity metadata again. Secret reads remain outside this skill and require their owning workflow to resolve an exact item and authorization boundary.

## Result

Return CLI availability and version, exact account-selection outcome, readiness category, authentication-mode evidence if non-secret, timeout or IPC evidence, and the smallest official remediation step. State clearly that no authentication or secret access was performed.

<!-- sd0x-routing-contract:v1 unit=op-session/default -->
```json
{
  "positive_triggers": [
    "Apply the canonical op-session workflow and report its evidence.",
    "Help me run the op-session workflow for this repository.",
    "I need the canonical op-session procedure with its safety boundaries."
  ],
  "negative_boundaries": [
    "Do not run op-session; only execute deterministic repository verification.",
    "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
    "Only review the current code changes for correctness and defects."
  ]
}
```
