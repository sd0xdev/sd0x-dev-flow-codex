'use strict';
// sd0x-migration-supplemental-test target=create-pr unit=create-pr/default

const assert = require('node:assert/strict');
const test = require('node:test');
const { readActiveSkill } = require('../scripts/supplemental-active-skill');

test("create-pr/default preserves its source workflow", () => {
  const payload = readActiveSkill("create-pr", []);
  const skill = payload.skill;
  for (const anchor of ["1. Gather Info (parallel)","2. Extract Ticket ID","3. Generate Title","4. Generate Body","4b. AI Content Sanitization","5. Pre-flight Checks + Mode Detection"]) assert.ok(skill.includes(anchor), anchor);
  for (const resource of payload.resources) {
    assert.equal(resource.present, true, resource.relative);
  }
  assert.doesNotMatch(skill, /allowed-tools:|AskUserQuestion|mcp__claude_ai_/);
});
