'use strict';
// sd0x-migration-supplemental-test target=contract-decode unit=contract-decode/default

const assert = require('node:assert/strict');
const test = require('node:test');
const { readActiveSkill } = require('../scripts/supplemental-active-skill');

test("contract-decode/default preserves its source workflow", () => {
  const payload = readActiveSkill("contract-decode", ["references/apis.md"]);
  const skill = payload.skill;
  for (const anchor of ["Ambiguous Candidates","Contract Decode Report","Input Parsing","Invocation Signals","Output Format","Raw Data"]) assert.ok(skill.includes(anchor), anchor);
  for (const resource of payload.resources) {
    assert.equal(resource.present, true, resource.relative);
  }
  assert.doesNotMatch(skill, /allowed-tools:|AskUserQuestion|mcp__claude_ai_/);
});
