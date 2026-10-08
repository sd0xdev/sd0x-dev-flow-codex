#!/usr/bin/env node
'use strict';

// Repository-only, read-only source inventory. No fetch, checkout or source writes.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const SNAPSHOT = '7805e98510943f45e57f9856966172401cff0c40';
const TAG = 'c9f112af4af9e6bf362d7baa3502b3593f42c1c4';
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function inventory(source, target) {
  const env = { ...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_NO_REPLACE_OBJECTS: '1',
    GIT_NO_LAZY_FETCH: '1', GIT_TERMINAL_PROMPT: '0' };
  for (const key of Object.keys(env)) {
    if (/^GIT_(?:DIR|WORK_TREE|COMMON_DIR|INDEX_FILE|OBJECT_DIRECTORY|ALTERNATE_OBJECT_DIRECTORIES|NAMESPACE|CONFIG.*)$/.test(key)) delete env[key];
  }
  const raw = args => execFileSync('git', ['-C', source, ...args], {
    env, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 16 * 1024 * 1024
  });
  const git = args => raw(args).toString('utf8').trimEnd();
  if (git(['rev-parse', 'v5.0.0^{commit}']) !== TAG) throw new Error('v5 tag identity changed');
  const files = git(['ls-tree', '-r', '--name-only', SNAPSHOT]).split('\n');
  const changed = new Set(git(['diff', '--name-only', 'v4.6.2', SNAPSHOT, '--']).split('\n'));
  const disposition = JSON.parse(fs.readFileSync(path.join(target, 'migration/source-disposition.json')));
  const historical = JSON.parse(fs.readFileSync(path.join(target, 'migration/source-inventory.generated.json')));
  const baselineCommit = historical.sources.find(row => row.id === 'upstream-git').commit;
  let baselineAvailable = false;
  try { git(['cat-file', '-e', baselineCommit + '^{commit}']); baselineAvailable = true; } catch { /* Hash-bound staged inventory remains the baseline. */ }
  const additions = { adr: { unit: 'architecture/default', mode: 'adr', coverage: ['A01'] },
    'deploy-flow': { unit: 'runbook/default', mode: 'deploy', coverage: ['D01', 'D02', 'D03', 'D04'] },
    'gh-stack': { unit: 'create-pr/default', mode: 'stack', coverage: ['S01', 'S02', 'S03', 'S04', 'S05', 'S06'] } };
  const skills = files.filter(file => /^skills\/[^/]+\/SKILL\.md$/.test(file)).map(file => {
    const name = file.split('/')[1];
    const text = raw(['show', `${SNAPSHOT}:${file}`]).toString('utf8');
    const baseline = historical.skills.find(row => row.source_name === name && row.source_id === 'upstream-git');
    const baselineFiles = new Map((baseline?.source_files || []).map(row => [row.path, row.sha256]));
    const currentPaths = files.filter(item => item.startsWith(`skills/${name}/`));
    const delta = currentPaths.map(item => { const current = sha256(raw(['show', `${SNAPSHOT}:${item}`]));
      return { path: item, sha256: current, baseline_sha256: baselineFiles.get(item) || null,
        change: !baselineFiles.has(item) ? 'added' : baselineFiles.get(item) === current ? 'unchanged' : 'changed' }; });
    for (const [item, before] of baselineFiles) if (!currentPaths.includes(item)) delta.push({ path: item, sha256: null, baseline_sha256: before, change: 'removed' });
    const prior = disposition.skills.filter(row => row.source_name === name);
    return {
      source_name: name, source_path: file, source_sha256: sha256(text),
      changed_since_v4_6_2: changed.has(file),
      source_options: [...new Set(text.match(/--[a-z][a-z0-9-]*/g) || [])].sort(),
      // Options describe the source surface; they are not a count of modes or features.
      native_units: prior.length ? prior.map(row => row.promotion_unit_id) : [additions[name]?.unit].filter(Boolean),
      native_extension: additions[name] || null,
      baseline_file_comparison: delta,
      semantic_review: 'pending',
      acceptance: 'pending-current-fingerprint',
      prior_delivery: prior.map(row => ({ owner: row.promotion_request,
        state: row.delivery_state, reason: row.rationale })),
      assessment: prior.length ? 'existing-mapping-awaiting-v5-acceptance' : 'native-adaptation-required'
    };
  });
  const assessmentPath = path.join(target, 'migration/upstream-v5-semantic-assessment.json');
  if (fs.existsSync(assessmentPath)) {
    const assessment = JSON.parse(fs.readFileSync(assessmentPath, 'utf8'));
    if (assessment.source_snapshot !== SNAPSHOT || assessment.entries.length !== skills.length ||
      new Set(assessment.entries.map(row => row.source_name)).size !== skills.length) throw new Error('Semantic assessment identity mismatch');
    for (const skill of skills) {
      const row = assessment.entries.find(entry => entry.source_name === skill.source_name);
      if (!row || row.source_sha256 !== skill.source_sha256) throw new Error('Semantic assessment source bytes mismatch');
      skill.semantic_review = { status: row.status, path: 'migration/upstream-v5-semantic-assessment.json' };
      skill.acceptance = row.acceptance;
      if (row.acceptance_evidence) skill.acceptance_evidence = row.acceptance_evidence;
      if (row.acceptance === 'accepted-at-recorded-subject') skill.assessment = 'native-mapping-accepted-at-recorded-subject';
    }
  }
  return { schema_version: 1, source: {
    snapshot: SNAPSHOT, tag: 'v5.0.0', tag_commit: TAG,
    checkout_head: git(['rev-parse', 'HEAD']),
    checkout_dirty: git(['status', '--porcelain=v1', '--untracked-files=all']) !== '',
    version: JSON.parse(git(['show', `${SNAPSHOT}:package.json`])).version,
    delta_base: git(['rev-parse', 'v4.6.2^{commit}']),
    historical_baseline_commit: baselineCommit, historical_commit_available: baselineAvailable,
    baseline_inventory_sha256: sha256(fs.readFileSync(path.join(target, 'migration/source-inventory.generated.json')))
  }, skills, changed_paths: [...changed].sort(),
  legacy_only: disposition.skills.filter(row => !skills.some(skill => skill.source_name === row.source_name))
    .map(row => ({ source_name: row.source_name, unit: row.promotion_unit_id, reason: row.rationale })),
  limitations: ['Options are lexical discovery aids, not semantic modes.',
    'Prior delivery is historical evidence, not current-fingerprint v5 acceptance.',
    'Source tests and remote versions are not executed or fetched.'] };
}

if (require.main === module) {
  try {
    if (process.argv.length !== 3) throw new Error('usage: upstream-v5-inventory.js <read-only-source>');
    console.log(JSON.stringify(inventory(path.resolve(process.argv[2]), path.resolve(__dirname, '..')), null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { inventory, SNAPSHOT, TAG };
