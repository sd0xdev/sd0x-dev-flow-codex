---
name: doctor
description: Diagnose the sd0x Dev Flow Codex plugin installation, runtime files, state location, and current completion gates. Use when hooks do not fire, skills are missing, setup seems broken, or the user asks for plugin status.
---

# Diagnose the Plugin

Resolve this skill's installed directory from the current `SKILL.md`, then run:

```bash
node "<this-skill-directory>/scripts/doctor.js"
```

If runtime files pass but hooks do not execute, tell the user to open `/hooks` and trust the current plugin hook hash. Do not claim hooks are active solely because the files exist.

