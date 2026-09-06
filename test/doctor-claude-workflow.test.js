'use strict';
// sd0x-migration-supplemental-test target=doctor unit=doctor/claude

const assert = require('node:assert/strict');
const test = require('node:test');
const { readActiveSkill } = require('../scripts/supplemental-active-skill');

test("doctor/claude reports retirement without restoring a Claude execution path", () => {
  const payload = readActiveSkill("doctor", ["scripts/doctor.js"]);
  const skill = payload.skill;
  for (const anchor of ["Claude review is retired", "No Claude CLI or authentication check runs"]) assert.ok(skill.includes(anchor), anchor);
  for (const resource of payload.resources) {
    assert.equal(resource.present, true, resource.relative);
  }
  assert.doesNotMatch(skill, /allowed-tools:|AskUserQuestion|mcp__claude_ai_/);
});
