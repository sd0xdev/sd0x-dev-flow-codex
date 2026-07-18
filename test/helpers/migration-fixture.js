'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '../..');

function copy(source, destination) {
  fs.rmSync(destination, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.cpSync(source, destination, { recursive: true });
}

function readJson(root, relative) {
  return JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
}

function writeJson(root, relative, value) {
  const filePath = path.join(root, relative);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function fixtureRoot(options = {}) {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-migration-audit-'));
  const root = path.join(workspace, 'repo');
  execFileSync('git', ['clone', '--no-local', '--quiet', ROOT, root], {
    env: { ...process.env, GIT_CONFIG_GLOBAL: os.devNull, GIT_CONFIG_NOSYSTEM: '1' }
  });
  if (options.copyEvidenceRef) {
    const evidenceRef = 'refs/sd0x-dev-flow-codex/evidence/v1';
    execFileSync('git', ['fetch', '--quiet', ROOT, `${evidenceRef}:${evidenceRef}`], {
      cwd: root,
      env: { ...process.env, GIT_CONFIG_GLOBAL: os.devNull, GIT_CONFIG_NOSYSTEM: '1' }
    });
  }
  copy(path.join(ROOT, 'migration'), path.join(root, 'migration'));
  const disposition = readJson(root, 'migration/source-disposition.json');
  for (const [sourceName, deliveryState] of Object.entries(
    options.deliveryStateOverrides || {}
  )) {
    disposition.skills.find((row) => row.source_name === sourceName).delivery_state = deliveryState;
  }
  for (const row of disposition.skills) {
    if (['pack-ready', 'promoted'].includes(row.delivery_state)) {
      row.delivery_state = 'candidate';
    } else if (row.delivery_state === 'retired') {
      row.delivery_state = 'planned';
    }
    if (!options.candidateCompletePacks &&
        row.target_package === 'research-pack' &&
        row.delivery_state === 'candidate') {
      row.delivery_state = 'planned';
    }
  }
  writeJson(root, 'migration/source-disposition.json', disposition);
  copy(path.join(ROOT, 'plugin', 'sd0x-dev-flow-codex', 'skills'),
    path.join(root, 'plugin', 'sd0x-dev-flow-codex', 'skills'));
  copy(path.join(ROOT, 'docs', 'features', 'skill-toolkit-migration'),
    path.join(root, 'docs', 'features', 'skill-toolkit-migration'));
  if (options.candidateCompletePacks && !options.completedCandidatePacks) {
    for (const requestPath of new Set(disposition.skills
      .filter((row) => row.target_package === 'research-pack' &&
        row.delivery_state === 'candidate')
      .map((row) => row.promotion_request))) {
      const absolute = path.join(root, requestPath);
      const request = fs.readFileSync(absolute, 'utf8')
        .replace('> **Status**: Completed', '> **Status**: Candidate Complete')
        .replace(/ Final pack audit `[0-9a-f]{64}` passed\./g, '')
        .replace(/^\| Acceptance \| Complete \|.*$/m,
          '| Acceptance | Candidate Complete | Payload and preflight evidence are recorded; R3 closure is pending. |');
      fs.writeFileSync(absolute, request);
    }
  }
  copy(path.join(ROOT, 'test', 'fixtures', 'alias-capability'),
    path.join(root, 'test', 'fixtures', 'alias-capability'));
  copy(path.join(ROOT, 'scripts', 'research-validators'),
    path.join(root, 'scripts', 'research-validators'));
  copy(path.join(ROOT, 'scripts', 'debug-probe'),
    path.join(root, 'scripts', 'debug-probe'));
  for (const relative of [
    'AGENTS.md',
    'docs/MIGRATION.md',
    'docs/PROJECT-MIGRATION-GUIDE.md',
    'plugin/sd0x-dev-flow-codex/.codex-plugin/plugin.json',
    'scripts/research-contract-test.js',
    'scripts/research-semantic-contracts.json',
    'scripts/supplemental-behavior-tests.json',
    'scripts/skill-routing-test.js'
  ]) {
    fs.copyFileSync(path.join(ROOT, relative), path.join(root, relative));
  }
  return { workspace, root };
}

module.exports = { copy, fixtureRoot };
