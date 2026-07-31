'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { configureRepository, isolateGitEnvironment } = require('./git');

const ROOT = path.resolve(__dirname, '../..');
const LEGACY_FIXTURE_COMMIT = '6bbdfbcf1294fb8cacd4efaa712ed3c51dfabc20';

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

function rewindEvidenceFixtureToStableClosureBoundary(root) {
  const evidenceRef = 'refs/sd0x-dev-flow-codex/evidence/v1';
  const gitEnv = {
    ...process.env,
    GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : os.devNull,
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_NO_REPLACE_OBJECTS: '1'
  };
  const runGit = (args) => execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    env: gitEnv
  }).trim();
  let output;
  try {
    output = runGit([
      'grep', '-h', '-e', '"kind":"request-closure', evidenceRef, '--',
      'records/request-closure', 'records/request-closure-pending'
    ]);
  } catch (error) {
    if (error.status === 1) return;
    throw error;
  }
  const latest = new Map();
  const checkoutIncompatible = new Set();
  for (const line of output.split('\n').filter(Boolean)) {
    const record = JSON.parse(line);
    if (typeof record.request_path === 'string' &&
        !fs.existsSync(path.join(root, record.request_path))) {
      checkoutIncompatible.add(record.record_sha256);
    }
    const key = `${record.kind}\0${record.promotion_unit_id}`;
    const current = latest.get(key);
    if (!current || Date.parse(record.recorded_at) > Date.parse(current.recorded_at)) {
      latest.set(key, record);
    }
  }
  const unmatchedPending = new Set();
  for (const [key, closure] of latest) {
    if (!key.startsWith('request-closure\0')) continue;
    const pending = latest.get(
      `request-closure-pending\0${closure.promotion_unit_id}`
    );
    if (pending && pending.record_sha256 !== closure.pending_record_sha256) {
      unmatchedPending.add(pending.record_sha256);
    }
  }
  const incompatibleRecords = new Set([
    ...unmatchedPending,
    ...checkoutIncompatible
  ]);
  if (incompatibleRecords.size === 0) return;
  const history = runGit([
    'log', '--reverse', '--format=%H%x00%s', evidenceRef, '--',
    'records/request-closure-pending'
  ]).split('\n').filter(Boolean);
  const firstIncompatible = history.find((line) => {
    const separator = line.indexOf('\0');
    return separator !== -1 && incompatibleRecords.has(
      line.slice(separator + 1).split(' ').at(-1)
    );
  });
  if (!firstIncompatible) {
    throw new Error('Unable to locate incompatible pending closure history');
  }
  const commit = firstIncompatible.slice(0, firstIncompatible.indexOf('\0'));
  const current = runGit(['rev-parse', evidenceRef]);
  const stable = runGit(['rev-parse', `${commit}^`]);
  runGit(['update-ref', evidenceRef, stable, current]);
}

function fixtureRoot(options = {}) {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-migration-audit-'));
  const root = path.join(workspace, 'repo');
  isolateGitEnvironment();
  execFileSync('git', ['clone', '--no-local', '--quiet', ROOT, root], {
    env: process.env
  });
  configureRepository(root);
  execFileSync('git', ['checkout', '--detach', '--quiet', LEGACY_FIXTURE_COMMIT], {
    cwd: root,
    env: process.env
  });
  const historicalResearchValidators = new Map();
  const historicalResearchPack = path.join(
    root, 'migration', 'packs', 'research-pack'
  );
  if (fs.existsSync(historicalResearchPack)) {
    for (const entry of fs.readdirSync(historicalResearchPack, {
      withFileTypes: true
    })) {
      if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
      const validator = path.join(
        root, 'scripts', 'research-validators', `${entry.name}.js`
      );
      if (fs.existsSync(validator)) {
        historicalResearchValidators.set(entry.name, fs.readFileSync(validator));
      }
    }
  }
  const historicalDisposition = readJson(root, 'migration/source-disposition.json');
  if (options.copyEvidenceRef) {
    const evidenceRef = 'refs/sd0x-dev-flow-codex/evidence/v1';
    const subjectRefs = 'refs/sd0x-dev-flow-codex/subjects/*';
    execFileSync('git', [
      'fetch', '--quiet', ROOT, `${evidenceRef}:${evidenceRef}`,
      `${subjectRefs}:${subjectRefs}`
    ], {
      cwd: root,
      env: {
        ...process.env,
        GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : os.devNull,
        GIT_CONFIG_NOSYSTEM: '1'
      }
    });
    // A copied development ledger can end at an intentionally unfinished
    // prepare/apply transaction. Evidence tests need the latest ancestor where
    // every existing closure still consumes the latest pending record; otherwise
    // an unrelated in-progress closure masks the invariant each fixture mutates.
    rewindEvidenceFixtureToStableClosureBoundary(root);
  }
  copy(path.join(ROOT, 'migration'), path.join(root, 'migration'));
  // The fixture replays a pinned historical disposition below. Active candidates
  // from the caller's current worktree belong to a different lifecycle and must
  // not leak into that historical registry snapshot.
  fs.rmSync(path.join(root, 'migration', 'candidates'), {
    recursive: true,
    force: true
  });
  const currentAliasCapability = readJson(ROOT, 'migration/alias-capability.json');
  const currentAliasOwner = currentAliasCapability.owner_request_path;
  fs.mkdirSync(path.dirname(path.join(root, currentAliasOwner)), { recursive: true });
  fs.copyFileSync(path.join(ROOT, currentAliasOwner), path.join(root, currentAliasOwner));
  const disposition = structuredClone(historicalDisposition);
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
  if (!options.copyEvidenceRef && !options.preserveCompletedCandidateOwners) {
    const candidateOwners = new Map();
    for (const row of disposition.skills) {
      if (row.delivery_state !== 'candidate' || row.promotion_request === null) continue;
      const units = candidateOwners.get(row.promotion_request) || new Set();
      units.add(row.promotion_unit_id);
      candidateOwners.set(row.promotion_request, units);
    }
    for (const [requestPath, units] of candidateOwners) {
      const absolute = path.join(root, requestPath);
      let request = fs.readFileSync(absolute, 'utf8');
      if (!/^> \*\*Status\*\*: Completed$/m.test(request)) continue;
      request = request.replace(
        '> **Status**: Completed', '> **Status**: Candidate Complete'
      );
      if (!(units.size === 1 && units.has('create-request/default'))) {
        request = request.replace(/^\| Acceptance \| Complete \|.*$/m,
          '| Acceptance | Candidate Complete | Synthetic fixture candidate authority remains pending. |');
      }
      fs.writeFileSync(absolute, request);
    }
  }
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
  // These fixtures replay the immutable historical research pack, so its
  // validators must come from the same pinned checkout. A newer live
  // replacement can legitimately update the repository validator after its
  // candidate directory has moved away; copying that validator into this
  // historical pack would create a cross-lifecycle byte mismatch.
  for (const [target, bytes] of historicalResearchValidators) {
    fs.writeFileSync(path.join(
      root, 'scripts', 'research-validators', `${target}.js`
    ), bytes);
  }
  copy(path.join(ROOT, 'scripts', 'debug-probe'),
    path.join(root, 'scripts', 'debug-probe'));
  for (const relative of [
    'AGENTS.md',
    'docs/MIGRATION.md',
    'docs/PROJECT-MIGRATION-GUIDE.md',
    'plugin/sd0x-dev-flow-codex/.codex-plugin/plugin.json',
    'plugin/sd0x-dev-flow-codex/skills/setup/scripts/setup.js',
    'scripts/supplemental-behavior-tests.json',
    'scripts/skill-routing-test.js'
  ]) {
    fs.copyFileSync(path.join(ROOT, relative), path.join(root, relative));
  }
  return { workspace, root };
}

module.exports = { copy, fixtureRoot };
