'use strict';
// sd0x-migration-supplemental-test target=epic-merge unit=epic-merge/default

const assert = require('node:assert/strict');
const test = require('node:test');
const { readActiveSkill } = require('../scripts/supplemental-active-skill');

test("epic-merge/default preserves its source workflow", () => {
  const payload = readActiveSkill("epic-merge", []);
  const skill = payload.skill;
  for (const anchor of ["Cleanup","Failure and Resume","Final Verification","Phase 0 — Immutable Analysis","Phase 1 — Recovery Evidence","Phase 2 — Sequential Iterations"]) assert.ok(skill.includes(anchor), anchor);
  for (const resource of payload.resources) {
    assert.equal(resource.present, true, resource.relative);
  }
  assert.doesNotMatch(skill, /allowed-tools:|AskUserQuestion|mcp__claude_ai_/);
});
