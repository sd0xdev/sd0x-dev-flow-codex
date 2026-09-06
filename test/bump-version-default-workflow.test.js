'use strict';
// sd0x-migration-supplemental-test target=bump-version unit=bump-version/default

const assert = require('node:assert/strict');
const test = require('node:test');
const { readActiveSkill } = require('../scripts/supplemental-active-skill');

test("bump-version/default preserves domain and operation boundaries", () => {
  const skill = readActiveSkill("bump-version", []).skill;
  assert.match(skill, /release\.js in the repository-root scripts directory/);
  assert.match(skill, /setVersion/);
  assert.match(skill, /PROJECT-MIGRATION-GUIDE\.md/);
  assert.match(skill, /migration\/alias-capability\.json/);
  assert.match(skill, /alias owner request’s decision hash/);
  assert.match(skill, /Do not create or edit installation\/runtime state/);
  assert.match(skill, /dev:local:unlink/);
  assert.match(skill, /dev:local:link/);
  assert.match(skill, /dev:local:status/);
  assert.ok(skill.includes('close the old Codex process'));
  assert.ok(skill.includes('Keep global Codex home unchanged'));
  assert.match(skill, /pending migration units or a Completed alias owner/);
  assert.doesNotMatch(skill, /prevents the plugin startup drift sentinel/);
  assert.doesNotMatch(skill, /allowed-tools:|AskUserQuestion|mcp__claude_ai_/);
});
