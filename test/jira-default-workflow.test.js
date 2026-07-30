'use strict';
// sd0x-migration-supplemental-test target=jira unit=jira/default

const assert = require('node:assert/strict');
const test = require('node:test');
const { readActiveSkill } = require('../scripts/supplemental-active-skill');

test("jira/default preserves its source workflow", () => {
  const payload = readActiveSkill("jira", ["references/branch-policy.md","references/create-policy.md","references/transition-mapping.md"]);
  const skill = payload.skill;
  for (const anchor of ["Branch","Connector Mutation Marker","Create","Input Resolution","Result","Transition"]) assert.ok(skill.includes(anchor), anchor);
  for (const resource of payload.resources) {
    assert.equal(resource.present, true, resource.relative);
  }
  assert.doesNotMatch(skill, /allowed-tools:|AskUserQuestion|mcp__claude_ai_/);
});
