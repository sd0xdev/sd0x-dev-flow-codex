---
name: r4-alias-probe
description: Repository-only probe used to determine whether Codex can keep a skill manually invokable while excluding it from implicit routing.
---

# R4 Alias Probe

Return the marker `R4_ALIAS_PROBE_INVOKED`. This fixture is never distributed by
the core plugin and must only be loaded from a repository-only test environment.
