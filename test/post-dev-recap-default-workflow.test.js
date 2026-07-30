'use strict';
// sd0x-migration-supplemental-test target=post-dev-recap unit=post-dev-recap/default

const assert = require('node:assert/strict');
const test = require('node:test');
const { readActiveSkill } = require('../scripts/supplemental-active-skill');

test("post-dev-recap/default preserves its source workflow", () => {
  const payload = readActiveSkill("post-dev-recap", []);
  const skill = payload.skill;
  for (const anchor of ["Guided questions","Recap document","Result","Scope detection"]) assert.ok(skill.includes(anchor), anchor);
  for (const resource of payload.resources) {
    assert.equal(resource.present, true, resource.relative);
  }
  assert.doesNotMatch(skill, /allowed-tools:|AskUserQuestion|mcp__claude_ai_/);
});
