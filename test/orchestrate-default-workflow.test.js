'use strict';
// sd0x-migration-supplemental-test target=orchestrate unit=orchestrate/default

const assert = require('node:assert/strict');
const test = require('node:test');
const { readActiveSkill } = require('../scripts/supplemental-active-skill');

test("orchestrate/default preserves its source workflow", () => {
  const payload = readActiveSkill("orchestrate", ["references/admission-allowlist.json","references/execution-policy.md","references/plan-schema.md","references/planner-prompt.md","scripts/plan-context.js","scripts/run-verify.js","scripts/validate-plan.js"]);
  const skill = payload.skill;
  for (const anchor of ["Admission and baseline","Optional read-only evidence fanout","Planning","Result"]) assert.ok(skill.includes(anchor), anchor);
  for (const resource of payload.resources) {
    assert.equal(resource.present, true, resource.relative);
  }
  assert.doesNotMatch(skill, /allowed-tools:|AskUserQuestion|mcp__claude_ai_/);
});
