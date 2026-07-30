'use strict';
// sd0x-migration-supplemental-test target=setup unit=setup/scripts

const assert = require('node:assert/strict');
const test = require('node:test');
const { readActiveSkill } = require('../scripts/supplemental-active-skill');

test("setup/scripts preserves its source workflow", () => {
  const payload = readActiveSkill("setup", ["scripts/setup.js"]);
  const skill = payload.skill;
  for (const anchor of ["--scripts","bundled runtime entrypoints"]) assert.ok(skill.includes(anchor), anchor);
  for (const resource of payload.resources) {
    assert.equal(resource.present, true, resource.relative);
  }
  assert.doesNotMatch(skill, /allowed-tools:|AskUserQuestion|mcp__claude_ai_/);
});
