'use strict';
// sd0x-migration-supplemental-test target=de-ai-flavor unit=de-ai-flavor/default

const assert = require('node:assert/strict');
const test = require('node:test');
const { readActiveSkill } = require('../scripts/supplemental-active-skill');

test("de-ai-flavor/default preserves its source workflow", () => {
  const payload = readActiveSkill("de-ai-flavor", []);
  const skill = payload.skill;
  for (const anchor of ["De-AI-Flavor Results","Detection Rules","Invocation Signals","Output Format","Scope Exclusions","Usage"]) assert.ok(skill.includes(anchor), anchor);
  for (const resource of payload.resources) {
    assert.equal(resource.present, true, resource.relative);
  }
  assert.doesNotMatch(skill, /allowed-tools:|AskUserQuestion|mcp__claude_ai_/);
});
