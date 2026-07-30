'use strict';
// sd0x-migration-supplemental-test target=pr-comment unit=pr-comment/default

const assert = require('node:assert/strict');
const test = require('node:test');
const { readActiveSkill } = require('../scripts/supplemental-active-skill');

test("pr-comment/default preserves its source workflow", () => {
  const payload = readActiveSkill("pr-comment", ["references/api-and-guardrails.md"]);
  const skill = payload.skill;
  for (const anchor of ["Comment contract","Prepare","Result","Submit and verify"]) assert.ok(skill.includes(anchor), anchor);
  for (const resource of payload.resources) {
    assert.equal(resource.present, true, resource.relative);
  }
  assert.doesNotMatch(skill, /allowed-tools:|AskUserQuestion|mcp__claude_ai_/);
});
