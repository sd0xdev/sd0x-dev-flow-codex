'use strict';
// sd0x-migration-supplemental-test target=sharingan unit=sharingan/default

const assert = require('node:assert/strict');
const test = require('node:test');
const { readActiveSkill } = require('../scripts/supplemental-active-skill');

test("sharingan/default preserves its source workflow", () => {
  const payload = readActiveSkill("sharingan", []);
  const skill = payload.skill;
  for (const anchor of ["Classification and dependency graph","Codex-native design","Source bundle","Write and validation"]) assert.ok(skill.includes(anchor), anchor);
  for (const resource of payload.resources) {
    assert.equal(resource.present, true, resource.relative);
  }
  assert.doesNotMatch(skill, /allowed-tools:|AskUserQuestion|mcp__claude_ai_/);
});
