'use strict';
// sd0x-migration-supplemental-test target=ui-first-principles unit=ui-first-principles/default

const assert = require('node:assert/strict');
const test = require('node:test');
const { readActiveSkill } = require('../scripts/supplemental-active-skill');

test("ui-first-principles/default preserves its source workflow", () => {
  const payload = readActiveSkill("ui-first-principles", []);
  const skill = payload.skill;
  for (const anchor of ["Anti-pattern and gap review","Handoff","Input contract","Jobs and principles"]) assert.ok(skill.includes(anchor), anchor);
  for (const resource of payload.resources) {
    assert.equal(resource.present, true, resource.relative);
  }
  assert.doesNotMatch(skill, /allowed-tools:|AskUserQuestion|mcp__claude_ai_/);
});
