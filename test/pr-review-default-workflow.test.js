'use strict';
// sd0x-migration-supplemental-test target=pr-review unit=pr-review/default

const assert = require('node:assert/strict');
const test = require('node:test');
const { readActiveSkill } = require('../scripts/supplemental-active-skill');

test("pr-review/default preserves its source workflow", () => {
  const payload = readActiveSkill("pr-review", []);
  const skill = payload.skill;
  for (const anchor of ["Result","Review passes","Scope"]) assert.ok(skill.includes(anchor), anchor);
  for (const resource of payload.resources) {
    assert.equal(resource.present, true, resource.relative);
  }
  assert.doesNotMatch(skill, /allowed-tools:|AskUserQuestion|mcp__claude_ai_/);
});
