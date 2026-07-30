'use strict';
// sd0x-migration-supplemental-test target=recap-ask unit=recap-ask/default

const assert = require('node:assert/strict');
const test = require('node:test');
const { readActiveSkill } = require('../scripts/supplemental-active-skill');

test("recap-ask/default preserves its source workflow", () => {
  const payload = readActiveSkill("recap-ask", ["references/qa-prompt.md"]);
  const skill = payload.skill;
  for (const anchor of ["Context boundary","Continuation and result","Evidence use"]) assert.ok(skill.includes(anchor), anchor);
  for (const resource of payload.resources) {
    assert.equal(resource.present, true, resource.relative);
  }
  assert.doesNotMatch(skill, /allowed-tools:|AskUserQuestion|mcp__claude_ai_/);
});
