'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { auditCandidateStatic } = require('../scripts/skill-migration-audit');

test('candidate audit trusts only the exact local runner and same-skill entrypoint', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-runner-instructions-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const candidate = 'migration/candidates/review';
  for (const relative of [candidate, 'plugin/sd0x-dev-flow-codex/skills/review']) {
    fs.mkdirSync(path.join(root, relative, 'scripts'), { recursive: true });
    fs.writeFileSync(path.join(root, relative, 'scripts/gate.js'), 'module.exports = {};\n');
  }
  fs.writeFileSync(path.join(root, 'migration/source-disposition.json'), JSON.stringify({
    skills: [{ target_skill: 'review', delivery_state: 'candidate', operations: ['local-write', 'read'] }]
  }));
  const command = 'node "<plugin-root>/scripts/runtime/runner.js" \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\'';
  const skill = path.join(root, candidate, 'SKILL.md');
  fs.writeFileSync(skill, `Run \`${command}\`.\n`);
  assert.deepEqual(auditCandidateStatic({ root, candidate, target: 'review' }), {
    ok: true, observed_operations: ['local-write', 'read']
  });
  for (const unsafe of [
    command.replace('node ', 'node --require evil.js '),
    command.replace('<plugin-root>', '<repository-root>'),
    command.replace('review/gate.js', 'setup/setup.js'),
    command.replace('review/gate.js', 'review/unknown.js'),
    `env ${command}`,
    `${command} extra`,
    command.replace('"pass"', '"$(touch marker)"').replace("'{", '"{').replace("}'", '}"'),
    `function node() { touch marker; }\n${command}`
  ]) {
    fs.writeFileSync(skill, `\`\`\`bash\n${unsafe}\n\`\`\`\n`);
    assert.throws(() => auditCandidateStatic({ root, candidate, target: 'review' }),
      /unsupported|undeclared|ambiguous|cannot be audited/, unsafe);
  }
});
