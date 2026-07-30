'use strict';
// sd0x-migration-supplemental-test target=doc-refactor unit=doc-refactor/default

const assert = require('node:assert/strict');
const test = require('node:test');
const { readActiveSkill } = require('../scripts/supplemental-active-skill');

test("doc-refactor/default preserves its source workflow", () => {
  const payload = readActiveSkill("doc-refactor", []);
  const skill = payload.skill;
  for (const anchor of ["Agent Dispatch","Changes","Invocation Signals","Output","Refactoring Result","Scope Exclusions"]) assert.ok(skill.includes(anchor), anchor);
  for (const resource of payload.resources) {
    assert.equal(resource.present, true, resource.relative);
  }
  assert.doesNotMatch(skill, /allowed-tools:|AskUserQuestion|mcp__claude_ai_/);
});
