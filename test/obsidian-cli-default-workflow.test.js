'use strict';
// sd0x-migration-supplemental-test target=obsidian-cli unit=obsidian-cli/default

const assert = require('node:assert/strict');
const test = require('node:test');
const { readActiveSkill } = require('../scripts/supplemental-active-skill');

test("obsidian-cli/default preserves its source workflow", () => {
  const payload = readActiveSkill("obsidian-cli", ["references/integration-patterns.md","references/troubleshooting.md"]);
  const skill = payload.skill;
  for (const anchor of ["Invocation signals","Mutation plan","Read-only preflight","Result","Revalidation and execution"]) assert.ok(skill.includes(anchor), anchor);
  for (const resource of payload.resources) {
    assert.equal(resource.present, true, resource.relative);
  }
  assert.doesNotMatch(skill, /allowed-tools:|AskUserQuestion|mcp__claude_ai_/);
});
