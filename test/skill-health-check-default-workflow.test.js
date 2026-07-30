'use strict';
// sd0x-migration-supplemental-test target=skill-health-check unit=skill-health-check/default

const assert = require('node:assert/strict');
const test = require('node:test');
const { readActiveSkill } = require('../scripts/supplemental-active-skill');

test("skill-health-check/default preserves its source workflow", () => {
  const payload = readActiveSkill("skill-health-check", []);
  const skill = payload.skill;
  for (const anchor of ["Checks","Scope and inventory","Scoring and result"]) assert.ok(skill.includes(anchor), anchor);
  for (const resource of payload.resources) {
    assert.equal(resource.present, true, resource.relative);
  }
  assert.doesNotMatch(skill, /allowed-tools:|AskUserQuestion|mcp__claude_ai_/);
});
