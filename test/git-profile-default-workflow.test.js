'use strict';
// sd0x-migration-supplemental-test target=git-profile unit=git-profile/default

const assert = require('node:assert/strict');
const test = require('node:test');
const { readActiveSkill } = require('../scripts/supplemental-active-skill');

test("git-profile/default preserves its source workflow", () => {
  const payload = readActiveSkill("git-profile", []);
  const skill = payload.skill;
  for (const anchor of ["Discover","Doctor","List","Remove Profile","Result","Safety Rules"]) assert.ok(skill.includes(anchor), anchor);
  for (const resource of payload.resources) {
    assert.equal(resource.present, true, resource.relative);
  }
  assert.doesNotMatch(skill, /allowed-tools:|AskUserQuestion|mcp__claude_ai_/);
});
