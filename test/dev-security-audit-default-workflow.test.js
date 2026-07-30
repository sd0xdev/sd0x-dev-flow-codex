'use strict';
// sd0x-migration-supplemental-test target=dev-security-audit unit=dev-security-audit/default

const assert = require('node:assert/strict');
const test = require('node:test');
const { readActiveSkill } = require('../scripts/supplemental-active-skill');

test("dev-security-audit/default preserves its source workflow", () => {
  const payload = readActiveSkill("dev-security-audit", ["references/cases/README.md","references/cases/apifox-2026-03.md","references/cases/axios-2026-03.md","references/remediation.md","references/scan-targets.md"]);
  const skill = payload.skill;
  for (const anchor of ["Applicable Scenarios","Browser Data","Critical Findings (Immediate Action Required)","Crypto Wallet Check","Dispatch Algorithm","Dispatch Rules"]) assert.ok(skill.includes(anchor), anchor);
  for (const resource of payload.resources) {
    assert.equal(resource.present, true, resource.relative);
  }
  assert.doesNotMatch(skill, /allowed-tools:|AskUserQuestion|mcp__claude_ai_/);
});
