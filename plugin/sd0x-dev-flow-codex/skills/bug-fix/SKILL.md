---
name: bug-fix
description: Diagnose and fix a bug through reproduction, execution-path tracing, minimal root-cause correction, regression coverage, independent review, and deterministic verification. Use for errors, regressions, failing tests, or behavior discrepancies.
---

# Fix a Bug

1. Reproduce or establish concrete failing evidence. Do not patch from the symptom alone.
2. Trace the actual execution path and state the root cause in falsifiable terms.
3. Make the narrowest correction that restores the intended invariant.
4. Add a regression test that fails before the fix and passes after it when feasible.
5. Run `$sd0x-dev-flow-codex:review`, resolve findings, then run `$sd0x-dev-flow-codex:verify`.
6. Report the root cause, behavior change, and executed evidence.

