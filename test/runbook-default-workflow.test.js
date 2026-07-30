'use strict';
// sd0x-migration-supplemental-test target=runbook unit=runbook/default

const assert = require('node:assert/strict');
const test = require('node:test');
const { readActiveSkill } = require('../scripts/supplemental-active-skill');

test("runbook/default preserves its source workflow", () => {
  const payload = readActiveSkill("runbook", []);
  const skill = payload.skill;
  for (const anchor of ["Bound scope","Check mode and result","Evidence model","Write transaction"]) assert.ok(skill.includes(anchor), anchor);
  for (const resource of payload.resources) {
    assert.equal(resource.present, true, resource.relative);
  }
  assert.doesNotMatch(skill, /allowed-tools:|AskUserQuestion|mcp__claude_ai_/);
});
