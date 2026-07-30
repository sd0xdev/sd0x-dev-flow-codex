# Orchestrate Plan Schema

The plan is a closed data object. It never embeds the user's prose, a worker prompt,
an executable, a command, or a gate result. `intent` has exactly the
`user-objective` type and a `sha256` field containing 64 lowercase hexadecimal characters.
The done definition record has the `evidence-report` type and selects one or more
closed outputs: `sources`, `findings`, `gaps`, and `follow-up`. Stop conditions are selected only
from `repository-drift`, `budget-exhausted`, `scope-escape`, and
`authority-required`.

Each step has a unique identifier, a closed kind and target, dependencies, a typed
task, typed evidence, a typed rationale, a typed completion criterion, and mutation
classification. A task type is fixed by the step kind: evidence-inspection,
evidence-convergence, or follow-up-proposal. Every task also selects one closed
operation, one concern, one or more canonical selectors, and required outputs.
Inspection operations are locate, trace, compare, and assess; convergence operations
are merge, contrast, and prioritize; a proposal uses describe-change. Concerns are
behavior, compatibility, correctness, coverage, dependencies, maintainability,
performance, and security. A fanout task cannot request the follow-up output because
fanout results contain evidence observations and gaps only.

Evidence is one of:

- repository-path with an existing bounded UTF-8 repository file, no symlink in any
  component, no credential filename or protected metadata path, and an optional
  positive line. Before dispatch the validator binds ancestor and file identities,
  opens no-follow, verifies lstat/fstat identities and timestamps before and after
  reading, redacts high-confidence secrets with a bounded linear scan that consumes
  labeled quoted values through their terminator or EOF and unquoted values through
  the line boundary, and replaces the path with captured
  redacted bytes and their digest;
- `step-output` with a canonical step identifier;
- `capability-state` with a canonical capability identifier.

A rationale is `repository-signal` with an evidence index or `user-objective`
with a null index. A completion criterion is `evidence-count` with a bounded
minimum, `converged-evidence`, or `proposal-only`. These fields contain no free
text, so repository paths remain data and review/verification results cannot be
represented.

Allowed kinds are read-only fanout, read-only canonical-skill handoff, evidence
convergence, and proposed mutation. A proposed mutation is never executed.
Dependencies must name earlier steps and remain acyclic. Every step-output record names
an earlier producer also listed in the dependency array; self, undeclared, and future outputs
are invalid. Dependent steps cannot share a parallel group. The validator computes
topological execution waves, bounds fanout workers in each wave, and rejects a graph
whose actual depth exceeds the declared wave maximum. Unknown fields, enum values, evidence types,
identities, paths, roles, or skills fail closed.

The validator requires the caller-computed objective digest as a separate argument
and compares it with the plan. Its output constructs every fanout message
deterministically from validated records. No caller-authored worker question may be
added after validation.

Each completed read-only step returns a schema-v1 result envelope containing its step,
objective, plan, task, and result digests; source references; closed observations; and
closed gaps. Sources must match the captured redacted source or upstream-result digest.
Observations use confirmed, match, mismatch, missing, or risk plus a closed concern and
canonical selector, and each observation must use its task's exact concern and one of
that task's selectors. Gaps use only the documented gap enum. The validator accepts these
envelopes only for fanout steps in the current admissible wave, after every dependency
has a valid envelope and the typed completion criterion is satisfied. It renders a
dependent fanout only after the prior wave completes; no upstream free text can enter a
later dispatch.
