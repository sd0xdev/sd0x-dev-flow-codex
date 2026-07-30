'use strict';
// sd0x-migration-supplemental-test target=bump-version unit=bump-version/default

const assert = require('node:assert/strict');
const test = require('node:test');
const { readActiveSkill } = require('../scripts/supplemental-active-skill');

test("bump-version/default preserves its source workflow", () => {
  const payload = readActiveSkill("bump-version", []);
  const skill = payload.skill;
  for (const anchor of ["Prohibited","Step 1: Read Current Versions","Step 2: Determine New Version","Step 3: Update All Files","Step 4: Report","Version Bump"]) assert.ok(skill.includes(anchor), anchor);
  for (const resource of payload.resources) {
    assert.equal(resource.present, true, resource.relative);
  }
  assert.doesNotMatch(skill, /allowed-tools:|AskUserQuestion|mcp__claude_ai_/);
});
