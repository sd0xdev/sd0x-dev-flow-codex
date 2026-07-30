'use strict';
// sd0x-migration-supplemental-test target=smart-commit unit=smart-commit/default

const assert = require('node:assert/strict');
const test = require('node:test');
const { readActiveSkill } = require('../scripts/supplemental-active-skill');

test("smart-commit/default preserves its source workflow", () => {
  const payload = readActiveSkill("smart-commit", []);
  const skill = payload.skill;
  for (const anchor of ["Indexed subject","Mutation preview","Revalidation and result"]) assert.ok(skill.includes(anchor), anchor);
  for (const resource of payload.resources) {
    assert.equal(resource.present, true, resource.relative);
  }
  assert.doesNotMatch(skill, /allowed-tools:|AskUserQuestion|mcp__claude_ai_/);
});
