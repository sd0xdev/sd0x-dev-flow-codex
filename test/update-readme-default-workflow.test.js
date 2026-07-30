'use strict';
// sd0x-migration-supplemental-test target=update-readme unit=update-readme/default

const assert = require('node:assert/strict');
const test = require('node:test');
const { readActiveSkill } = require('../scripts/supplemental-active-skill');

test("update-readme/default preserves its source workflow", () => {
  const payload = readActiveSkill("update-readme", []);
  const skill = payload.skill;
  for (const anchor of ["Catalog sources","Deterministic rendering","Write and validation"]) assert.ok(skill.includes(anchor), anchor);
  for (const resource of payload.resources) {
    assert.equal(resource.present, true, resource.relative);
  }
  assert.doesNotMatch(skill, /allowed-tools:|AskUserQuestion|mcp__claude_ai_/);
});
