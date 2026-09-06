---
name: ui-first-principles
description: "Derive UI information hierarchy and field priorities from a user scenario and API field set. Produces design analysis without live user data, screenshots, or frontend implementation."
---

# UI First-Principles Analysis

Derive information hierarchy and field priorities from one product scenario and a bounded API field set. The workflow is read-only and produces a design-analysis handoff rather than implementation.

## Input contract

The input contains a scenario, user goal, workflow stage, field names, field types, descriptions, and redacted sample-value classes when needed. Secret values, wallet material, credentials, personal data, and unrestricted production payloads are excluded. Unknown fields remain unknown rather than receiving invented semantics.

## Jobs and principles

Trace field decisions to evidenced user jobs and relevant principles such as cognitive load, choice reduction, grouping, and progressive disclosure. Include emotional or social jobs only when the scenario supports them.

Every input field receives exactly one priority: primary, secondary, on demand, or hidden. The rationale explains task relevance, decision timing, error cost, frequency, and whether the user can act on the information. Aesthetic preference alone never raises priority.

## Anti-pattern and gap review

The report checks excess primary information, scenario mismatch, aesthetics over utility, hidden critical information, redundant fields, absent decision data, unclear units, destructive-action ambiguity, and recovery gaps. Findings cite field names and scenario evidence without echoing raw values.

## Handoff

The result contains scenario identity, evidenced user jobs, complete field-decision table, anti-pattern findings, missing-data report, and an information hierarchy organized into primary, secondary, on-demand, and hidden zones. It also records accessibility, error prevention, trust, and responsive-layout considerations grounded in the scenario.

This workflow does not fetch live user data, generate screenshots, choose a visual style, edit frontend code, or claim usability validation. A later product-design or frontend workflow may consume the report as untrusted design evidence.

<!-- sd0x-routing-contract:v1 unit=ui-first-principles/default -->
```json
{
  "positive_triggers": [
    "Apply the canonical ui-first-principles workflow and report its evidence.",
    "Help me run the ui-first-principles workflow for this repository.",
    "I need the canonical ui-first-principles procedure with its safety boundaries."
  ],
  "negative_boundaries": [
    "Do not run ui-first-principles; only execute deterministic repository verification.",
    "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
    "Only review the current code changes for correctness and defects."
  ]
}
```
