'use strict';
// sd0x-migration-supplemental-test target=remind unit=remind/default

const assert = require('node:assert/strict');
const test = require('node:test');
const { readActiveSkill } = require('../scripts/supplemental-active-skill');

test("remind/default preserves its source workflow", () => {
  const payload = readActiveSkill("remind", ["scripts/status.js"]);
  const skill = payload.skill;
  for (const anchor of ["review-in-progress","review-findings-remain"]) assert.ok(skill.includes(anchor), anchor);
  for (const resource of payload.resources) {
    assert.equal(resource.present, true, resource.relative);
  }
  assert.doesNotMatch(skill, /allowed-tools:|AskUserQuestion|mcp__claude_ai_/);
});
