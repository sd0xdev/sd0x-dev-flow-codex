'use strict';
// sd0x-migration-supplemental-test target=tech-brief unit=tech-brief/default

const assert = require('node:assert/strict');
const test = require('node:test');
const { readActiveSkill } = require('../scripts/supplemental-active-skill');

test("tech-brief/default preserves its source workflow", () => {
  const payload = readActiveSkill("tech-brief", []);
  const skill = payload.skill;
  for (const anchor of ["Brief structure","Sources and provenance","Write and verify"]) assert.ok(skill.includes(anchor), anchor);
  for (const resource of payload.resources) {
    assert.equal(resource.present, true, resource.relative);
  }
  assert.doesNotMatch(skill, /allowed-tools:|AskUserQuestion|mcp__claude_ai_/);
});
