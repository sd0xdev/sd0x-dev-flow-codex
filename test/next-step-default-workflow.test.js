'use strict';
// sd0x-migration-supplemental-test target=next-step unit=next-step/default

const assert = require('node:assert/strict');
const test = require('node:test');
const { readActiveSkill } = require('../scripts/supplemental-active-skill');

test("next-step/default preserves its source workflow", () => {
  const payload = readActiveSkill("next-step", ["references/progression-tables.md"]);
  const skill = payload.skill;
  for (const anchor of ["Evidence Collection","Feature and Request Evidence","Handoff Preview","Priority Order","Result","Work Classification"]) assert.ok(skill.includes(anchor), anchor);
  for (const resource of payload.resources) {
    assert.equal(resource.present, true, resource.relative);
  }
  assert.doesNotMatch(skill, /allowed-tools:|AskUserQuestion|mcp__claude_ai_/);
});
