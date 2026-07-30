'use strict';
// sd0x-migration-supplemental-test target=verify unit=verify/precommit

const assert = require('node:assert/strict');
const test = require('node:test');
const { readActiveSkill } = require('../scripts/supplemental-active-skill');

test("verify/precommit preserves its source workflow", () => {
  const payload = readActiveSkill("verify", ["scripts/verify.js"]);
  const skill = payload.skill;
  for (const anchor of ["Precommit is non-gating","lint:fix","→","build","test","continue-all"]) assert.ok(skill.includes(anchor), anchor);
  for (const resource of payload.resources) {
    assert.equal(resource.present, true, resource.relative);
  }
  assert.doesNotMatch(skill, /allowed-tools:|AskUserQuestion|mcp__claude_ai_/);
});
