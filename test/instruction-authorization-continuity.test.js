'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { adaptSourceSkill } = require('../scripts/prepare-planned-formal-plugin');

for (const target of ['create-pr', 'jira']) {
  for (const surface of ['live', 'regenerated']) {
    test(target + ' ' + surface + ' preserves scoped execution and preview-only boundaries', () => {
      const live = path.join(__dirname, '../plugin/sd0x-dev-flow-codex/skills', target, 'SKILL.md');
      const source = path.join(__dirname, '../migration/staging', target, 'SKILL.md');
      const skill = surface === 'live' ? fs.readFileSync(live, 'utf8') : adaptSourceSkill(
        fs.readFileSync(source, 'utf8').replace(/^---\n[\s\S]*?\n---\n/, ''),
        target, [target], new Map([[target, target]])
      );
      assert.match(skill, /Stop at the preview for dry-run or preview-only requests, or when the policy above is not satisfied/);
      assert.match(skill, /Otherwise continue execution in the same task/);
      assert.doesNotMatch(skill, /A later task|A later execution task|Stop after the preview|--execute[^\n]*preview and stop/);
      if (target === 'create-pr') {
        assert.match(skill, /explicit request to create or update the PR selects execution unless the user requests dry-run or preview-only/);
        assert.match(skill, /revalidate repository identity, branch OIDs, existing PR state, sanitized payload hash, and argv/);
      } else {
        assert.match(skill, /re-fetches the issue and transitions, rejects drift/);
        assert.match(skill, /revalidates site access and issue-type metadata/);
      }
    });
  }
}
