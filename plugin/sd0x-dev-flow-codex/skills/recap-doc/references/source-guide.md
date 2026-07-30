# Recap Source Collection Guide

## Stage 1: scope

Validate the closed scope record before reading repository content. The source class determines whether evidence compares the worktree with head or compares exact base and head object IDs. Paths never widen beyond the scope except for an explicitly linked approved specification or request.

## Stage 2: repository evidence

For every scoped path, collect bounded commit subjects, diff statistics, changed hunks, and current-file excerpts through fixed read-only Git and filesystem calls. Cap history, per-file diff bytes, total bytes, and elapsed time. Deleted, binary, renamed, missing, and truncated files remain distinct evidence states.

Brief, normal, and deep select at most five, ten, and fifteen paths by total changed lines, then change-class priority and bytewise path order. Documentation, tests, configuration, and source remain in the recap table even when excerpts focus on implementation logic.

## Stage 3: specification evidence

Only an exact contained feature-document path from the scope may provide specification and acceptance evidence. Map work items and acceptance criteria to changed paths without inferring completion. Missing, stale, or contradictory documents produce drift rows and blind spots.

## Missing evidence

Every unavailable source has a named marker. Empty sections retain the required heading and explain the gap. No commit, path, line number, decision, or acceptance result is fabricated.
