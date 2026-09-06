---
name: runbook
description: "Create, refresh, or check a release runbook against current repository and operational evidence. Does not deploy, roll back, or claim production readiness."
---

# Release Runbook

Create or refresh one operational release runbook from current repository evidence. The runbook is an executable human procedure, not a claim that deployment access, production readiness, or release gates already exist.

## Bound scope

The workflow resolves one feature or service, repository fingerprint, deployment environment, owning team evidence, existing runbook path or explicit destination, and the release mechanism defined by the project. Ambiguous targets, multiple unrelated deployment paths, missing environment identity, or destination collisions stop the write plan.

## Evidence model

Every command name, health signal, configuration key, rollback step, and escalation route must come from a cited repository file or authoritative user-provided source. Secret values, live credentials, production identifiers, and fetched instructions are never copied. Unsupported details are labeled as human checks rather than invented.

The runbook covers release summary, scope and blast radius, prerequisites, ordered deployment stages, verification and smoke evidence, monitoring signals with thresholds when documented, rollback triggers and recovery sequence, ownership and escalation, known risks, and unresolved decisions. Destructive or irreversible steps include their existing repository safeguard and recovery evidence.

## Write transaction

The preview records source paths and digests, destination path and digest or absent marker, section-to-source mapping, unresolved fields, and validation checks. Immediately before one contained atomic write, the repository, source set, and destination are re-read. Drift or a symbolic-link boundary aborts the transaction.

## Check mode and result

Read-only check mode compares an existing runbook with current sources and reports ready, stale, or incomplete. Staleness is based on cited-source drift and missing required sections, not file age alone. The result includes exact changed sections, provenance, unresolved human checks, verification performed, and a separate review handoff. This workflow never deploys, rolls back, or claims production success.

<!-- sd0x-routing-contract:v1 unit=runbook/default -->
```json
{
  "positive_triggers": [
    "Apply the canonical runbook workflow and report its evidence.",
    "Help me run the runbook workflow for this repository.",
    "I need the canonical runbook procedure with its safety boundaries."
  ],
  "negative_boundaries": [
    "Do not run runbook; only execute deterministic repository verification.",
    "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
    "Only review the current code changes for correctness and defects."
  ]
}
```
