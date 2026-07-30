'use strict';
// sd0x-migration-supplemental-test target=recap-doc unit=recap-doc/default

const assert = require('node:assert/strict');
const test = require('node:test');
const { readActiveSkill } = require('../scripts/supplemental-active-skill');

test("recap-doc/default preserves its source workflow", () => {
  const payload = readActiveSkill("recap-doc", ["references/output-template.md","references/prompt-template.md","references/source-guide.md"]);
  const skill = payload.skill;
  for (const anchor of ["Destination and write","Evidence collection","Result","Scope contract","Synthesis"]) assert.ok(skill.includes(anchor), anchor);
  for (const resource of payload.resources) {
    assert.equal(resource.present, true, resource.relative);
  }
  assert.doesNotMatch(skill, /allowed-tools:|AskUserQuestion|mcp__claude_ai_/);
});
