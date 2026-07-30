'use strict';
// sd0x-migration-supplemental-test target=load-pr-review unit=load-pr-review/default

const assert = require('node:assert/strict');
const test = require('node:test');
const { readActiveSkill } = require('../scripts/supplemental-active-skill');

test("load-pr-review/default preserves its source workflow", () => {
  const payload = readActiveSkill("load-pr-review", ["references/api-contract.md","references/token-budget.md","references/verdict-triage-prompt.md","references/writeback-guardrails.md"]);
  const skill = payload.skill;
  for (const anchor of ["Classify","Draft Replies","Fetch","Normalize","Result","Target Resolution"]) assert.ok(skill.includes(anchor), anchor);
  for (const resource of payload.resources) {
    assert.equal(resource.present, true, resource.relative);
  }
  assert.doesNotMatch(skill, /allowed-tools:|AskUserQuestion|mcp__claude_ai_/);
});
