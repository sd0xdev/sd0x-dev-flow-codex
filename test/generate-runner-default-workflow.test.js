'use strict';
// sd0x-migration-supplemental-test target=generate-runner unit=generate-runner/default

const assert = require('node:assert/strict');
const test = require('node:test');
const { readActiveSkill } = require('../scripts/supplemental-active-skill');

test("generate-runner/default preserves its source workflow", () => {
  const payload = readActiveSkill("generate-runner", ["references/templates.md"]);
  const skill = payload.skill;
  for (const anchor of ["Detection","Existing File","Generated Runtime Contract","Plan","Result","Verification"]) assert.ok(skill.includes(anchor), anchor);
  for (const resource of payload.resources) {
    assert.equal(resource.present, true, resource.relative);
  }
  assert.doesNotMatch(skill, /allowed-tools:|AskUserQuestion|mcp__claude_ai_/);
});
