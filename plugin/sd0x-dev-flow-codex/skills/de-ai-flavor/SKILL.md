---
name: de-ai-flavor
description: "Remove generic writing filler and unsolicited self-attribution while preserving facts, technical meaning, quotations and the author’s voice."
---

# De-AI-Flavor Skill

## Invocation Signals
- Keywords: de-ai, remove AI traces, humanize document, de-ai-flavor, humanize

## Scope Exclusions
- Co-Authored-By in CHANGELOG (Git convention)
- Documents discussing AI technology (topic itself requires it)
- Quoting others' AI-related content
- Variable and function names in code

## Usage

```text
$sd0x-dev-flow-codex:de-ai-flavor docs/xxx.md           # Process specified file
$sd0x-dev-flow-codex:de-ai-flavor docs/                 # Process all .md in directory
$sd0x-dev-flow-codex:de-ai-flavor                       # Process .md in git diff
```

## Detection Rules

| Type              | Pattern                                             | Action  |
| ----------------- | --------------------------------------------------- | ------- |
| Unsolicited attribution | Tool self-attribution unrelated to the document’s facts | Remove |
| Boilerplate       | "Let me...", "First...then...", "In conclusion"      | Rewrite |
| Over-structuring  | One sentence per heading, too many #### levels       | Simplify|
| Service tone      | "Hope this helps", "If you have questions..."        | Remove  |
| Self-description  | "Next I will...", "I will proceed to..."             | Remove  |
| Iteration leaks   | "Round 1/Round 2/Round N"                            | Rewrite |

## Workflow

```text
Scan file -> Mark AI traces -> Remove/Rewrite/Simplify -> Output summary
```

## Verification

- Factual tool names, quotations, provenance and code identifiers preserved; unsolicited self-attribution removed
- Boilerplate rewritten to natural tone
- Structure not overly flat or nested

## Output Format

```markdown
## De-AI-Flavor Results

**File**: `docs/xxx.md`

| Line | Original              | Change                  | Reason           |
| ---- | --------------------- | ----------------------- | ---------------- |
| 15   | Let me explain...     | Removed                 | AI self-description |
| 32   | Claude suggests...    | Changed to "Suggest..." | Tool name        |

**Stats**: Removed 3 tool names | Rewrote 5 boilerplate | Simplified 2 structures
```

## Examples

```text
Input: $sd0x-dev-flow-codex:de-ai-flavor docs/tech-spec.md
Action: Scan -> Remove "Claude suggests" -> Rewrite "Let me explain" -> Output summary
```

```text
Input: This document feels very AI-generated, please clean it up
Action: Detect git diff -> Mark AI traces -> Batch process -> Output stats
```

<!-- sd0x-routing-contract:v1 unit=de-ai-flavor/default -->
```json
{
  "positive_triggers": [
    "Apply the canonical de-ai-flavor workflow and report its evidence.",
    "Help me run the de-ai-flavor workflow for this repository.",
    "I need the canonical de-ai-flavor procedure with its safety boundaries."
  ],
  "negative_boundaries": [
    "Do not run de-ai-flavor; only execute deterministic repository verification.",
    "Only assess test coverage, acceptance criteria, flakiness, and verification gaps.",
    "Only review the current code changes for correctness and defects."
  ]
}
```
