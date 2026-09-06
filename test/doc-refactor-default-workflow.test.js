'use strict';
// sd0x-migration-supplemental-test target=doc-refactor unit=doc-refactor/default

const assert = require('node:assert/strict');
const test = require('node:test');
const { readActiveSkill } = require('../scripts/supplemental-active-skill');

test("doc-refactor/default preserves domain and operation boundaries", () => {
  const skill = readActiveSkill("doc-refactor", []).skill;
  assert.match(skill, /preserving technical meaning/);
  assert.match(skill, /safety constraints and completion criteria/);
  assert.match(skill, /within the requested document scope/);
  assert.match(skill, /Local work is sufficient when delegation adds no value/);
  assert.match(skill, /Line counts .* are not success criteria/);
  assert.match(skill, /repository’s required review and verification rules/);
  assert.doesNotMatch(skill, /Target Lines|^## Agent Dispatch|Steps -> sequenceDiagram/m);
  assert.doesNotMatch(skill, /allowed-tools:|AskUserQuestion|mcp__claude_ai_/);
});
