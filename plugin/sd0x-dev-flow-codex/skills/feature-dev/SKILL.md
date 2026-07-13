---
name: feature-dev
description: Implement a non-trivial feature end to end with scoped exploration, explicit acceptance criteria, incremental edits, independent review, and deterministic verification. Use when the user asks to build or extend behavior rather than make a tiny isolated edit.
---

# Develop a Feature

1. Inspect the concrete execution path and repository guidance before proposing architecture.
2. State scope, acceptance criteria, risks, and the smallest coherent implementation plan.
3. Implement incrementally, preserving existing conventions and unrelated user changes.
4. Add or update tests that prove behavior rather than implementation details.
5. Run `$sd0x-dev-flow-codex:review` until the configured primary subagent and independent Codex test perspective are clean.
6. Run `$sd0x-dev-flow-codex:verify`. If verification causes fixes, repeat review first.
7. Finish with changed behavior, evidence, and any genuine residual risk.
