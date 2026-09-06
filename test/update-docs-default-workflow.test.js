'use strict';
// sd0x-migration-supplemental-test target=update-docs unit=update-docs/default

const assert = require('node:assert/strict');
const test = require('node:test');
const { readActiveSkill } = require('../scripts/supplemental-active-skill');

test("update-docs/default preserves domain and operation boundaries", () => {
  const skill = readActiveSkill("update-docs", []).skill;
  assert.match(skill, /existing documentation where current implementation proves material drift/);
  assert.match(skill, /query-only resolver/);
  assert.match(skill, /create-request\/scripts\/request-tool\.js/);
  assert.match(skill, /resolver owns containment and conflict validation/);
  assert.match(skill, /does not install an implicit hook/);
  assert.match(skill, /Any edit invalidates stale fingerprint evidence/);
  assert.match(skill, /Keep implementation and unrelated documents unchanged/);
  assert.doesNotMatch(skill, /^## Auto-Trigger/m);
  assert.doesNotMatch(skill, /allowed-tools:|AskUserQuestion|mcp__claude_ai_/);
});
