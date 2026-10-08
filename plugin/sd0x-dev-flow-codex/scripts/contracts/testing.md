# Testing and acceptance evidence

Before judging test sufficiency, proposing an exception, or accepting a criterion, map each behavior and failure boundary to a test or explicitly recorded observation. Distinguish automated execution, manual observation, static inspection and untested inference. Record the exact command, subject, result and material environmental limits. A test that merely mirrors implementation text is not behavior evidence.

Choose unit, integration or end-to-end scope by the behavior and its dependencies. Include consequential negative cases: missing reads, wrong identity/version, stale evidence, ordering, malformed input, failed mutation and recovery. Avoid adding low-value tests for trivial reversible edits. Test-review remains advisory; it neither acts as the configured primary nor runs the deterministic verification gate on the parent's behalf.

A manual exception assessment must identify why automation is infeasible, provide reproducible manual evidence and residual risk, and obtain any genuinely required product authority. Security, data-integrity and regression obligations cannot be waived by a project setting. An exception is not a passing test, does not set an unverified AC to Complete, and never replaces deterministic verification. If evidence is missing, keep that criterion Pending or Inconclusive while completing independent checks.

Run focused behavior checks during implementation. Close required review before the deterministic verifier on the final fingerprint. Any fix reopens required gates. Do not infer passing verification from a prior fingerprint, static test names, coverage percentages or a completion summary.
