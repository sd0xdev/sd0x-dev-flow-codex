'use strict';
// sd0x-migration-supplemental-test target=project-brief unit=project-brief/default

const assert = require('node:assert/strict');
const test = require('node:test');
const { readActiveSkill } = require('../scripts/supplemental-active-skill');

test("project-brief/default preserves its source workflow", () => {
  const payload = readActiveSkill("project-brief", []);
  const skill = payload.skill;
  for (const anchor of ["Boundaries","Conversion","Source and destination","Write and verify"]) assert.ok(skill.includes(anchor), anchor);
  for (const resource of payload.resources) {
    assert.equal(resource.present, true, resource.relative);
  }
  assert.doesNotMatch(skill, /allowed-tools:|AskUserQuestion|mcp__claude_ai_/);
});
