'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { adaptSourceSkill } = require('../scripts/prepare-planned-formal-plugin');

function regenerate(target) {
  const source = fs.readFileSync(path.join(__dirname, '../migration/staging',
    target, 'SKILL.md'), 'utf8').replace(/^---\n[\s\S]*?\n---\n/, '');
  return adaptSourceSkill(source, target, [target], new Map([[target, target]]));
}

test("bump-version regeneration preserves revised instruction boundaries", () => {
  const skill = regenerate("bump-version");
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

test("doc-refactor regeneration preserves revised instruction boundaries", () => {
  const skill = regenerate("doc-refactor");
  assert.match(skill, /preserving technical meaning/);
  assert.match(skill, /safety constraints and completion criteria/);
  assert.match(skill, /within the requested document scope/);
  assert.match(skill, /Local work is sufficient when delegation adds no value/);
  assert.match(skill, /Line counts .* are not success criteria/);
  assert.match(skill, /repository’s required review and verification rules/);
  assert.doesNotMatch(skill, /Target Lines|^## Agent Dispatch|Steps -> sequenceDiagram/m);
  assert.doesNotMatch(skill, /allowed-tools:|AskUserQuestion|mcp__claude_ai_/);
});

test("update-docs regeneration preserves revised instruction boundaries", () => {
  const skill = regenerate("update-docs");
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

for (const mode of ['fast', 'precommit']) {
  test('verify ' + mode + ' generated workflow test accepts its generated body', () => {
    const { bodyLines, workflowTestSource } = require('../scripts/prepare-planned-formal-plugin');
    const { runInNewContext } = require('node:vm');
    const unit = { promotion_unit_id: 'verify/' + mode, target_mode: mode };
    const skill = bodyLines('verify', [unit], ['read', 'local-write']).join('\n');
    const code = workflowTestSource('verify', ['verify'], '', unit, ['scripts/verify.js']);
    const callbacks = [];
    runInNewContext(code, {
      require(name) {
        if (name === 'node:assert/strict') return assert;
        if (name === 'node:test') return (_name, callback) => callbacks.push(callback);
        if (name === '../scripts/supplemental-active-skill') {
          return { readActiveSkill(target, resources) {
            assert.equal(target, 'verify');
            assert.deepEqual(Array.from(resources), ['scripts/verify.js']);
            return { skill, resources: resources.map((relative) => ({ relative, present: true })) };
          } };
        }
        throw new Error('Unexpected generated import: ' + name);
      }
    });
    assert.equal(callbacks.length, 1);
    for (const callback of callbacks) callback();
  });
}
