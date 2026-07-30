'use strict';
// sd0x-migration-supplemental-test target=smart-rebase unit=smart-rebase/default

const assert = require('node:assert/strict');
const test = require('node:test');
const { readActiveSkill } = require('../scripts/supplemental-active-skill');

test("smart-rebase/default preserves its source workflow", () => {
  const payload = readActiveSkill("smart-rebase", []);
  const skill = payload.skill;
  for (const anchor of ["Read-only analysis","Recovery and preview","Revalidation and execution"]) assert.ok(skill.includes(anchor), anchor);
  for (const resource of payload.resources) {
    assert.equal(resource.present, true, resource.relative);
  }
  assert.doesNotMatch(skill, /allowed-tools:|AskUserQuestion|mcp__claude_ai_/);
});
