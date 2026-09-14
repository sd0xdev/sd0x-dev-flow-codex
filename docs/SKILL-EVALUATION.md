# Controlled skill evaluations

This repository keeps deterministic routing-contract checks separate from model
behavior measurements. The former validate catalog consistency. The latter ask a
real Codex model to select a skill or complete a read-only fixture task, preserving
the raw CLI JSONL, response, elapsed time and reported token usage.

## Run a baseline

Use Node.js 24 and a Codex CLI supporting `exec --json --output-schema`, with the
project's existing `CODEX_HOME`. `prepare` snapshots the current source skills and
fixtures without invoking a model. `run` invokes the selected model and consumes
the existing account's model usage. Artifacts must be outside the repository.

```sh
CODEX_HOME="$PWD/.codex-dev-home" node scripts/skill-behavior-eval.js prepare --out /tmp/sd0x-eval-baseline
CODEX_HOME="$PWD/.codex-dev-home" node scripts/skill-behavior-eval.js run --out /tmp/sd0x-eval-baseline --model gpt-6-astra --concurrency 3
```

Use a fresh output directory for every experiment. Input hashes bind the suite,
fixtures, copied skill tree, catalog, response schema and harness. A changed input
requires a new prepared experiment. Each model runs in a separate temporary task
directory with the read-only sandbox and no repository mutation authorization.

The evaluator receives the user request and the supplied skill catalog, not the
grading rubric or expected answer. Routing cases do not execute the underlying
workflow. Task cases must inspect fixture files and return the requested answer.
The harness checks workspace integrity after execution. Inspect the raw tool trace
when interpreting an apparent task pass: a source citation or successful command
alone is not proof of the model's reasoning or every file access.

## Compare a candidate

After a supported skill change, prepare and run another directory using the same
suite, harness, model request, CLI version, concurrency and timeout. Then:

```sh
node scripts/skill-behavior-eval.js compare --baseline /tmp/sd0x-eval-baseline/report.json --candidate /tmp/sd0x-eval-candidate/report.json
```

The report separates routing success/error rate, fixture task success rate,
unnecessary skill selections, case duration, experiment wall time, actual CLI
input/output token usage and supplied prompt characters. Missing usage remains
`null` with coverage reported; characters are never converted into token claims.
The requested model is recorded; the CLI event stream may not attest the server's
resolved model identity. Total case time is not experiment wall time when cases
run concurrently.

These are controlled catalog experiments. The host may still supply its own base
instructions and installed metadata, so this is not a native registry activation
test. Keep the host environment stable between experiments. Small single runs are
exploratory observations, not statistically significant model rankings. Repeat
paired runs before generalizing results or accepting marginal improvements.

No evaluation result satisfies the configured-primary review or deterministic
verification gate. Read-only fixture success also does not establish implementation,
installation, activation, CI or release completion for a real user task.

## Initial pilot (2026-09-12)

Twenty cases cover twelve routing decisions and eight read-only fixture or skill
procedure questions. The model request was `gpt-6-astra`, concurrency three, with a
180-second per-case deadline. All six 20-case runs below produced valid terminal
results. Routing includes the requested mode; these are repeated observations of
the same small suite, not 120 independent tasks or coverage of all 86 skills.

| Run | Routing | Tasks | Input tokens | Output tokens | Mean case seconds |
| --- | --- | --- | --- | --- | --- |
| `baseline-expanded` | 12/12 | 8/8 | 663,707 | 1,933 | 10.67 |
| `candidate` | 11/12 | 8/8 | 777,519 | 2,307 | 12.12 |
| `baseline-repeat` | 12/12 | 8/8 | 688,862 | 1,911 | 12.90 |
| `candidate2` | 12/12 | 8/8 | 679,262 | 2,014 | 11.00 |
| `candidate2-repeat` | 12/12 | 8/8 | 742,951 | 2,211 | 11.29 |
| `baseline-counterbalance` | 12/12 | 8/8 | 708,241 | 2,019 | 11.33 |

The first candidate removed the `fast` mode name from discovery and split short
procedures across several references. It returned `quick` for the expected `fast`
mode, and extra file reads increased context use. That candidate was rejected.
Its run overlapped the expanded baseline for approximately thirteen seconds, so
that pair cannot support a latency comparison.

Candidate 2 retains explicit mode names, keeps simple procedures inline, and moves
only the long default review protocol into a linked reference. Seven descriptions
shrink from a catalog total of 15,348 to 14,751 characters. The two subsequent pairs
ran serially, first baseline then candidate, and then candidate then baseline.
Both versions passed all cases in both pairs. Combined candidate input tokens were
about 1.8% higher, while mean case duration was about 8.0% lower. Token savings are
not established; variation in selected skills and tool rounds dominates the small
catalog reduction. The bounded entrypoint revision is retained for clearer mode
selection and less irrelevant entrypoint text, with observed correctness retained;
it is not accepted as a proven token optimization. Broader implementation tasks,
unseen phrasing and native discovery require further evaluation before generalizing.

Raw responses, tool traces, usage and immutable prepared inputs are retained locally
under `/tmp/sd0x-skill-eval.9VKoPj/<run>/`. They are not distributed runtime state or
gate evidence. Report SHA-256 values allow the retained copies to be identified:

- `baseline-expanded/report.json`: `8579c6cabb68981412b694acec6f2570060955908e12a9678d131f55ebcf6ea0`.
- `candidate/report.json`: `fb7f35def0226186835c15e598bda260ebfc7c650400cd83e7a41238611a3462`.
- `baseline-repeat/report.json`: `6e4c2970da7bf247ba64044105feb2d851f29a0381817193270e00b7e32c370f`.
- `candidate2/report.json`: `4cb119f3dc54664397c3898dfd7fb0d107ed4571bbdd8c6805b2bbaf214df78e`.
- `candidate2-repeat/report.json`: `45640d67afac1cc9c66e613100e09f687a6f499c4407556abc1ecf03003d30cf`.
- `baseline-counterbalance/report.json`: `b401dddd57cabc42a5cc6facdce16e5221ceb1c86495318499c3e9a1a4a756f5`.

The final migration candidate also replaces prose “execute that protocol” with
“follow that protocol” and restores the verifier's literal allowlisted MCP call.
The static operation parser interpreted the former prose as a shell command and
cannot authenticate a bare tool name without its structured call. These transport
clarifications preserve the evaluated modes and permissions; the table reports
the measured candidate-2 drafts, not a new measurement of the final byte sequence.
The final verifier wording also retains the existing `continue-all` and
`no runtime gate write` contract terms. The strict review regression test follows
the explicitly linked default protocol instead of requiring its text inline.

## Delivery verification observation

On 2026-09-13 (Asia/Taipei), the source verifier completed `npm run check` in
1,756,804 ms: 1,170 tests passed, none failed, and three were skipped. After the
13 replacement requests were canonically applied, reviewed and sealed, it selected
and completed `npm run check:closure` in 454,342 ms. The new verification evidence
contains all 13 closure bindings to the earlier full verification; no `node --test`
command ran during this request-only check.

These are observed command durations of 29.3 and 7.6 minutes, excluding review,
sealing and eligibility-check overhead. They demonstrate removal of one full test
rerun from this delivery transaction, not a general performance guarantee or
equivalent test coverage without the prior proof. The final delivery overlay and
other non-request edits still require full verification. Logs are retained beside
the diagnostic reports as `verify-1-repair.log` and `verify-closure.log`; these
documentation claims do not grant a runtime gate pass.
