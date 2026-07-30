'use strict';
// sd0x-migration-supplemental-test target=pr-summary unit=pr-summary/default

const assert = require('node:assert/strict');
const test = require('node:test');
const { readActiveSkill } = require('../scripts/supplemental-active-skill');

test("pr-summary/default preserves its source workflow", () => {
  const payload = readActiveSkill("pr-summary", []);
  const skill = payload.skill;
  for (const anchor of ["Collection","Filters","Result"]) assert.ok(skill.includes(anchor), anchor);
  for (const resource of payload.resources) {
    assert.equal(resource.present, true, resource.relative);
  }
  assert.doesNotMatch(skill, /allowed-tools:|AskUserQuestion|mcp__claude_ai_/);
});
