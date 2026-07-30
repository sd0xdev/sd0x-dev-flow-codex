'use strict';
// sd0x-migration-supplemental-test target=watch-ci unit=watch-ci/default

const assert = require('node:assert/strict');
const test = require('node:test');
const { readActiveSkill } = require('../scripts/supplemental-active-skill');

test("watch-ci/default preserves its source workflow", () => {
  const payload = readActiveSkill("watch-ci", []);
  const skill = payload.skill;
  for (const anchor of ["Discovery and monitoring","Subject identity","Verdict"]) assert.ok(skill.includes(anchor), anchor);
  for (const resource of payload.resources) {
    assert.equal(resource.present, true, resource.relative);
  }
  assert.doesNotMatch(skill, /allowed-tools:|AskUserQuestion|mcp__claude_ai_/);
});
