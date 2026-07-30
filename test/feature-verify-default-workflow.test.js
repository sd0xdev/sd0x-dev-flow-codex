'use strict';
// sd0x-migration-supplemental-test target=feature-verify unit=feature-verify/default

const assert = require('node:assert/strict');
const test = require('node:test');
const { readActiveSkill } = require('../scripts/supplemental-active-skill');

test("feature-verify/default preserves its source workflow", () => {
  const payload = readActiveSkill("feature-verify", ["references/blackbox-testing.md","references/environments.md","references/output-template.md","references/safety-rules.md"]);
  const skill = payload.skill;
  for (const anchor of ["P0 — Scope and Safety","P1 — Affected Scope","P2 — Test Charter","P3 — Read-Only Probes","P4 — Observation Correlation","P5 — Verdict"]) assert.ok(skill.includes(anchor), anchor);
  for (const resource of payload.resources) {
    assert.equal(resource.present, true, resource.relative);
  }
  assert.doesNotMatch(skill, /allowed-tools:|AskUserQuestion|mcp__claude_ai_/);
});
