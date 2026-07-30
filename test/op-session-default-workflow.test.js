'use strict';
// sd0x-migration-supplemental-test target=op-session unit=op-session/default

const assert = require('node:assert/strict');
const test = require('node:test');
const { readActiveSkill } = require('../scripts/supplemental-active-skill');

test("op-session/default preserves its source workflow", () => {
  const payload = readActiveSkill("op-session", []);
  const skill = payload.skill;
  for (const anchor of ["Readiness checks","Result","Supported setup guidance"]) assert.ok(skill.includes(anchor), anchor);
  for (const resource of payload.resources) {
    assert.equal(resource.present, true, resource.relative);
  }
  assert.doesNotMatch(skill, /allowed-tools:|AskUserQuestion|mcp__claude_ai_/);
});
