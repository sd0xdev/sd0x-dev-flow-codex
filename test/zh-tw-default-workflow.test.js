'use strict';
// sd0x-migration-supplemental-test target=zh-tw unit=zh-tw/default

const assert = require('node:assert/strict');
const test = require('node:test');
const { readActiveSkill } = require('../scripts/supplemental-active-skill');

test("zh-tw/default preserves its source workflow", () => {
  const payload = readActiveSkill("zh-tw", []);
  const skill = payload.skill;
  for (const anchor of ["Result","Rewrite rules","Target selection"]) assert.ok(skill.includes(anchor), anchor);
  for (const resource of payload.resources) {
    assert.equal(resource.present, true, resource.relative);
  }
  assert.doesNotMatch(skill, /allowed-tools:|AskUserQuestion|mcp__claude_ai_/);
});
