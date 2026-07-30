'use strict';
// sd0x-migration-supplemental-test target=readme-i18n-sync unit=readme-i18n-sync/default

const assert = require('node:assert/strict');
const test = require('node:test');
const { readActiveSkill } = require('../scripts/supplemental-active-skill');

test("readme-i18n-sync/default preserves its source workflow", () => {
  const payload = readActiveSkill("readme-i18n-sync", ["references/glossary.md"]);
  const skill = payload.skill;
  for (const anchor of ["Registry and scope","Result","Translation","Verification"]) assert.ok(skill.includes(anchor), anchor);
  for (const resource of payload.resources) {
    assert.equal(resource.present, true, resource.relative);
  }
  assert.doesNotMatch(skill, /allowed-tools:|AskUserQuestion|mcp__claude_ai_/);
});
