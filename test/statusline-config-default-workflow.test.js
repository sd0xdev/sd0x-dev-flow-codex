'use strict';
// sd0x-migration-supplemental-test target=statusline-config unit=statusline-config/default

const assert = require('node:assert/strict');
const test = require('node:test');
const { readActiveSkill } = require('../scripts/supplemental-active-skill');

test("statusline-config/default preserves its source workflow", () => {
  const payload = readActiveSkill("statusline-config", []);
  const skill = payload.skill;
  for (const anchor of ["Boundaries","Capability evidence","Result states"]) assert.ok(skill.includes(anchor), anchor);
  for (const resource of payload.resources) {
    assert.equal(resource.present, true, resource.relative);
  }
  assert.doesNotMatch(skill, /allowed-tools:|AskUserQuestion|mcp__claude_ai_/);
});
