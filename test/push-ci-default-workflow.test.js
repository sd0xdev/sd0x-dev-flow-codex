'use strict';
// sd0x-migration-supplemental-test target=push-ci unit=push-ci/default

const assert = require('node:assert/strict');
const test = require('node:test');
const { readActiveSkill } = require('../scripts/supplemental-active-skill');

test("push-ci/default preserves its source workflow", () => {
  const payload = readActiveSkill("push-ci", []);
  const skill = payload.skill;
  for (const anchor of ["Execute and bind CI","Preflight","Push preview","Result"]) assert.ok(skill.includes(anchor), anchor);
  for (const resource of payload.resources) {
    assert.equal(resource.present, true, resource.relative);
  }
  assert.doesNotMatch(skill, /allowed-tools:|AskUserQuestion|mcp__claude_ai_/);
});
