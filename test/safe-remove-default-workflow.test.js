'use strict';
// sd0x-migration-supplemental-test target=safe-remove unit=safe-remove/default

const assert = require('node:assert/strict');
const test = require('node:test');
const { readActiveSkill } = require('../scripts/supplemental-active-skill');

test("safe-remove/default preserves its source workflow", () => {
  const payload = readActiveSkill("safe-remove", []);
  const skill = payload.skill;
  for (const anchor of ["Apply and verify","Dependency discovery","Removal plan","Target identity"]) assert.ok(skill.includes(anchor), anchor);
  for (const resource of payload.resources) {
    assert.equal(resource.present, true, resource.relative);
  }
  assert.doesNotMatch(skill, /allowed-tools:|AskUserQuestion|mcp__claude_ai_/);
});
