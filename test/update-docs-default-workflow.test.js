'use strict';
// sd0x-migration-supplemental-test target=update-docs unit=update-docs/default

const assert = require('node:assert/strict');
const test = require('node:test');
const { readActiveSkill } = require('../scripts/supplemental-active-skill');

test("update-docs/default preserves its source workflow", () => {
  const payload = readActiveSkill("update-docs", []);
  const skill = payload.skill;
  for (const anchor of ["Auto-Trigger","Changes Made","Doc Update Report","Invocation Signals","Output","Safety Valve"]) assert.ok(skill.includes(anchor), anchor);
  for (const resource of payload.resources) {
    assert.equal(resource.present, true, resource.relative);
  }
  assert.doesNotMatch(skill, /allowed-tools:|AskUserQuestion|mcp__claude_ai_/);
});
