'use strict';
// sd0x-migration-supplemental-test target=repo-intake unit=repo-intake/default

const assert = require('node:assert/strict');
const test = require('node:test');
const { readActiveSkill } = require('../scripts/supplemental-active-skill');

test("repo-intake/default preserves its source workflow", () => {
  const payload = readActiveSkill("repo-intake", []);
  const skill = payload.skill;
  for (const anchor of ["Evidence collection","Intake scope","Project map","Verification and boundaries"]) assert.ok(skill.includes(anchor), anchor);
  for (const resource of payload.resources) {
    assert.equal(resource.present, true, resource.relative);
  }
  assert.doesNotMatch(skill, /allowed-tools:|AskUserQuestion|mcp__claude_ai_/);
});
