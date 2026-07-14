'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const requestToolPath = process.env.SD0X_CREATE_REQUEST_TOOL ||
  '../plugin/sd0x-dev-flow-codex/skills/create-request/scripts/request-tool';
const resolvedRequestToolPath = require.resolve(path.resolve(__dirname, requestToolPath));
const {
  resolveFeature,
  scanRequests
} = require(resolvedRequestToolPath);
const {
  commit,
  git,
  initRepository,
  isolateGitEnvironment
} = require('./helpers/git');

isolateGitEnvironment();

function createRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-create-request-'));
  initRepository(root);
  fs.writeFileSync(path.join(root, 'seed.txt'), 'seed\n');
  git(root, ['add', 'seed.txt']);
  commit(root, 'initial');
  return root;
}

function write(root, relative, content) {
  const target = path.join(root, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
  return target;
}

function request({
  title,
  status = 'Pending',
  priority = 'P1',
  created = '2026-07-01',
  checked = 0,
  total = 2,
  table = false
}) {
  const metadata = table
    ? `| Status | **${status}** |\n| Priority | ${priority} |\n| Created | ${created} |`
    : `> **Created**: ${created}\n> **Status**: ${status}\n> **Priority**: ${priority}`;
  const base = '> **Implementation Base SHA**: `0000000000000000000000000000000000000000`';
  const criteria = Array.from({ length: total }, (_, index) =>
    `- [${index < checked ? 'x' : ' '}] Criterion ${index + 1}`).join('\n');
  return `# ${title}\n\n${metadata}\n${base}\n\n## Acceptance Criteria\n\n${criteria}\n\n## Progress\n`;
}

function withImplementationBase(root, content, sha = null) {
  const base = sha || git(root, ['rev-parse', 'HEAD']).toString().trim();
  return content.replace(/`0{40}`/, `\`${base}\``);
}

test('explicit resolution is contained, canonical, and lists only active requests', (t) => {
  const root = createRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  write(root, 'docs/features/auth/1-requirements-v2.md', '# Requirements\n');
  write(root, 'docs/features/auth/2-tech-spec.md', '# Spec\n');
  write(root, 'docs/features/auth/requests/2026-07-01-active.md', request({ title: 'Active' }));
  write(root, 'docs/features/auth/requests/2026-07-02-done.md', withImplementationBase(root, request({
    title: 'Done', status: 'Completed', checked: 2
  })));

  const result = resolveFeature(root, {
    feature: 'auth',
    path: 'docs/features/auth/requests/2026-07-01-active.md'
  });

  assert.equal(result.key, 'auth');
  assert.equal(result.source, 'explicit-path');
  assert.equal(result.confidence, 'high');
  assert.equal(result.exists, true);
  assert.deepEqual(result.canonical_docs, {
    requirements: 'docs/features/auth/1-requirements-v2.md',
    tech_spec: 'docs/features/auth/2-tech-spec.md'
  });
  assert.deepEqual(result.active_requests.map((item) => item.title), ['Active']);
  assert.equal(resolveFeature(root, { path: 'docs/features/auth/' }).key, 'auth');
  assert.equal(resolveFeature(root, {
    path: 'docs/features/auth/2-tech-spec.md'
  }).key, 'auth');
  for (const invalid of [
    'docs/features/auth/requests',
    'docs/features/auth/requests/'
  ]) {
    assert.throws(() => resolveFeature(root, { path: invalid }),
      /feature directory|lifecycle Markdown|request Markdown|only a feature/);
  }
  assert.throws(
    () => resolveFeature(root, { feature: 'billing', path: 'docs/features/auth' }),
    /does not match/
  );
  assert.throws(() => resolveFeature(root, { path: '../outside' }), /escapes|canonical/);
});

test('resolution rejects symlink escapes and ambiguous implicit context', (t) => {
  const root = createRepo();
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-create-request-outside-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  t.after(() => fs.rmSync(outside, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'docs', 'features'), { recursive: true });
  fs.symlinkSync(outside, path.join(root, 'docs', 'features', 'escape'));
  assert.throws(() => resolveFeature(root, { feature: 'escape' }), /symlink/);
  fs.rmSync(path.join(root, 'docs', 'features', 'escape'));

  write(root, 'docs/features/auth/2-tech-spec.md', '# Auth\n');
  write(root, 'docs/features/billing/2-tech-spec.md', '# Billing\n');
  const result = resolveFeature(root);
  assert.equal(result.key, null);
  assert.equal(result.source, 'none');
});

test('implicit resolution and scans reject external, internal, and dangling feature symlinks', (t) => {
  for (const kind of ['external', 'internal', 'dangling']) {
    const root = createRepo();
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-feature-link-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    t.after(() => fs.rmSync(outside, { recursive: true, force: true }));
    const features = path.join(root, 'docs', 'features');
    fs.mkdirSync(features, { recursive: true });
    const target = kind === 'external'
      ? outside
      : kind === 'internal'
        ? path.join(root, 'private-feature')
        : path.join(root, 'missing-feature');
    if (kind !== 'dangling') {
      write(target, 'requests/2026-07-01-hidden.md', request({ title: 'Hidden pending' }));
    }
    fs.symlinkSync(path.relative(features, target), path.join(features, 'linked'));

    assert.throws(() => scanRequests(root, { today: '2026-07-12' }), /feature directory.*symlink/,
      kind);
    assert.throws(() => resolveFeature(root), /symlink/, kind);
  }
});

test('resolution and scan reject nested request and archive symlink escapes', (t) => {
  const root = createRepo();
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-create-request-outside-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  t.after(() => fs.rmSync(outside, { recursive: true, force: true }));
  write(outside, '2026-07-01-external.md', request({ title: 'External' }));
  fs.mkdirSync(path.join(root, 'docs', 'features', 'auth'), { recursive: true });
  fs.symlinkSync(outside, path.join(root, 'docs', 'features', 'auth', 'requests'));

  assert.throws(() => scanRequests(root), /symlink/);
  assert.throws(
    () => resolveFeature(root, { path: 'docs/features/auth/requests/2026-07-12-new.md' }),
    /symlink/
  );

  fs.rmSync(path.join(root, 'docs', 'features', 'auth', 'requests'));
  fs.mkdirSync(path.join(root, 'docs', 'features', 'auth', 'requests'));
  fs.symlinkSync(outside, path.join(root, 'docs', 'features', 'auth', 'requests', 'archived'));
  assert.throws(() => scanRequests(root), /symlink/);
});

test('resolution and scan reject every symlinked request directory', (t) => {
  for (const target of ['.git', '.codex', 'docs/features/billing/requests', 'docs/shared-requests']) {
    const root = createRepo();
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    write(root, 'docs/features/auth/2-tech-spec.md', '# Auth\n');
    if (target !== '.git') fs.mkdirSync(path.join(root, target), { recursive: true });
    const featureDir = path.join(root, 'docs', 'features', 'auth');
    fs.symlinkSync(path.relative(featureDir, path.join(root, target)), path.join(featureDir, 'requests'));

    assert.throws(() => resolveFeature(root, { feature: 'auth' }), /symlink/);
    assert.throws(() => scanRequests(root, { today: '2026-07-12' }), /symlink/);
    assert.throws(
      () => resolveFeature(root, { path: 'docs/features/auth/requests/2026-07-12-new.md' }),
      /symlink/
    );
  }
});

test('resolution and scan reject dangling request and archive symlinks', (t) => {
  for (const target of [
    path.join('docs', 'missing-requests'),
    path.join(os.tmpdir(), `sd0x-missing-${process.pid}-${Math.random().toString(16).slice(2)}`)
  ]) {
    const root = createRepo();
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    write(root, 'docs/features/auth/2-tech-spec.md', '# Auth\n');
    const featureDir = path.join(root, 'docs', 'features', 'auth');
    const absoluteTarget = path.isAbsolute(target) ? target : path.join(root, target);
    fs.symlinkSync(path.relative(featureDir, absoluteTarget), path.join(featureDir, 'requests'));

    assert.throws(() => resolveFeature(root, { feature: 'auth' }), /symlink/);
    assert.throws(() => scanRequests(root, { today: '2026-07-12' }), /symlink/);
    assert.throws(
      () => resolveFeature(root, { path: 'docs/features/auth/requests/2026-07-12-new.md' }),
      /symlink/
    );
  }

  const root = createRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const requestsDir = path.join(root, 'docs', 'features', 'auth', 'requests');
  fs.mkdirSync(requestsDir, { recursive: true });
  fs.symlinkSync('../missing-archive', path.join(requestsDir, 'archived'));
  assert.throws(() => scanRequests(root, { today: '2026-07-12' }), /symlink/);
});

test('resolution cascade prefers branch then unique changed feature', (t) => {
  const root = createRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  write(root, 'docs/features/auth/2-tech-spec.md', '# Auth\n');
  write(root, 'docs/features/billing/2-tech-spec.md', '# Billing\n');
  git(root, ['add', 'docs']);
  commit(root, 'add feature docs');

  git(root, ['switch', '-c', 'feat/auth']);
  assert.equal(resolveFeature(root).source, 'branch');
  assert.equal(resolveFeature(root).key, 'auth');

  git(root, ['switch', '-c', 'work']);
  write(root, 'docs/features/billing/notes.md', 'changed\n');
  const changed = resolveFeature(root);
  assert.equal(changed.source, 'changed-paths');
  assert.equal(changed.key, 'billing');
});

test('branch resolution supports every contract prefix, suffixes, and missing-feature fallback', (t) => {
  for (const branch of ['feat/auth', 'feature/auth', 'fix/auth/login', 'docs/auth/rewrite']) {
    const root = createRepo();
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    write(root, 'docs/features/auth/2-tech-spec.md', '# Auth\n');
    write(root, 'docs/features/billing/2-tech-spec.md', '# Billing\n');
    git(root, ['add', 'docs']);
    commit(root, 'add feature docs');
    git(root, ['switch', '-c', branch]);
    const result = resolveFeature(root);
    assert.equal(result.source, 'branch', branch);
    assert.equal(result.key, 'auth', branch);
  }

  const root = createRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  write(root, 'docs/features/auth/2-tech-spec.md', '# Auth\n');
  write(root, 'docs/features/billing/2-tech-spec.md', '# Billing\n');
  git(root, ['add', 'docs']);
  commit(root, 'add feature docs');
  git(root, ['switch', '-c', 'feat/missing']);
  assert.equal(resolveFeature(root).key, null);
});

test('scan normalizes both metadata shapes, sorts actionably, and exposes failures', (t) => {
  const root = createRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  write(root, 'docs/features/a/requests/2026-07-09-progress.md', request({
    title: 'Progress', status: 'In Progress', priority: 'P2', created: '2026-07-09', checked: 1
  }));
  write(root, 'docs/features/a/requests/2026-05-01-stale.md', request({
    title: 'Stale', priority: 'P0', created: '2026-05-01', table: true
  }));
  write(root, 'docs/features/b/requests/2026-06-01-candidate.md', request({
    title: 'Candidate', status: 'Candidate Complete', priority: 'P0', created: '2026-06-01', checked: 2
  }));
  write(root, 'docs/features/b/requests/2026-06-02-complete.md', withImplementationBase(root, request({
    title: 'Complete', status: 'Done', priority: 'P0', checked: 2
  })));
  write(root, 'docs/features/b/requests/no-date.md', '# Broken\n');
  write(root, 'docs/features/b/requests/archived/2025-01-01-old.md', request({ title: 'Archived' }));

  const result = scanRequests(root, { today: '2026-07-11' });

  assert.equal(result.total, 5);
  assert.equal(result.incomplete, 4);
  assert.equal(result.archived_excluded, 1);
  assert.deepEqual(result.requests.map((item) => item.title), [
    'Progress', 'Candidate', 'Stale', 'Broken'
  ]);
  assert.equal(result.requests[2].stale, true);
  assert.deepEqual(result.requests[3].parse_errors, [
    'missing-status', 'missing-created-date', 'missing-acceptance-criteria'
  ]);
});

test('canonical blockquote metadata wins over conflicting legacy tables', (t) => {
  const root = createRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const mixed = `# Mixed\n\n| Status | **Completed** |\n| Priority | P2 |\n| Created | 2026-01-01 |\n\n> **Created**: 2026-07-01\n> **Status**: Pending\n> **Priority**: P0\n\n## Acceptance Criteria\n\n- [ ] Still active\n`;
  write(root, 'docs/features/a/requests/2026-07-01-mixed.md', mixed);

  const result = scanRequests(root, { today: '2026-07-11' });
  assert.equal(result.incomplete, 1);
  assert.deepEqual(result.requests[0], {
    title: 'Mixed',
    feature: 'a',
    status: 'Pending',
    priority: 'P0',
    created: '2026-07-01',
    checked: 0,
    total: 1,
    stale: false,
    age_days: 10,
    path: 'docs/features/a/requests/2026-07-01-mixed.md',
    parse_errors: []
  });
});

test('legacy fallback ignores status tables outside the metadata region', (t) => {
  const root = createRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const bodyTable = `# Body table\n\n## Summary\n\n| Status | Completed | Note |\n|---|---|---|\n| Status | Completed | This is body data |\n\n## Acceptance Criteria\n\n- [ ] Still active\n`;
  write(root, 'docs/features/a/requests/2026-07-01-body-table.md', bodyTable);

  const result = scanRequests(root, { today: '2026-07-11' });
  assert.equal(result.incomplete, 1);
  assert.equal(result.requests[0].status, 'unknown');
  assert.deepEqual(result.requests[0].parse_errors, ['missing-status']);
});

test('scan retains malformed metadata as explicit per-file errors', (t) => {
  const root = createRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  write(root, 'docs/features/a/requests/2026-02-30-bad.md', request({
    title: 'Bad metadata', status: 'Complete-ish', priority: 'P9', created: '2026-02-30'
  }));
  write(root, 'docs/features/a/requests/2026-01-01-proposed.md', request({
    title: 'Proposed', status: 'Proposed', priority: 'P0', created: '2026-01-01'
  }));

  const results = scanRequests(root, { today: '2026-07-11' }).requests;
  assert.deepEqual(results.map((item) => item.title), ['Bad metadata', 'Proposed']);
  const [result] = results;
  assert.deepEqual(result.parse_errors, [
    'invalid-status', 'invalid-created-date', 'invalid-priority'
  ]);
  assert.equal(result.age_days, null);
  assert.equal(result.stale, false);
});

test('scan validates explicit today as a real calendar date', (t) => {
  const root = createRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  assert.doesNotThrow(() => scanRequests(root, { today: '2024-02-29' }));
  assert.throws(() => scanRequests(root, { today: '2026-02-30' }), /invalid --today date/);
  assert.throws(() => scanRequests(root, { today: 'yesterday' }), /invalid --today date/);
});

test('malformed terminal tickets remain visible as incomplete parser errors', (t) => {
  const root = createRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const [index, status] of ['Completed', 'Done', 'Superseded'].entries()) {
    write(
      root,
      `docs/features/a/requests/broken-${index}-${status.toLowerCase()}.md`,
      `# Broken ${status}\n\n> **Status**: ${status}\n`
    );
  }

  const resolution = resolveFeature(root, { feature: 'a' });
  assert.deepEqual(
    resolution.active_requests.map((item) => item.status),
    ['Completed', 'Done', 'Superseded']
  );
  for (const item of resolution.active_requests) {
    const expected = ['missing-created-date', 'missing-acceptance-criteria'];
    if (['Completed', 'Done'].includes(item.status)) expected.push('missing-implementation-base');
    if (item.status === 'Superseded') expected.push('missing-superseded-by');
    assert.deepEqual(item.parse_errors, expected);
  }
  const scan = scanRequests(root, { today: '2026-07-12' });
  assert.equal(scan.total, 3);
  assert.equal(scan.incomplete, 3);
  assert.deepEqual(scan.requests.map((item) => item.status), ['Completed', 'Done', 'Superseded']);
});

test('Completed and Done require a valid base SHA and fully checked ACs', (t) => {
  const root = createRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const blob = git(root, ['hash-object', '-w', 'seed.txt']).toString().trim();
  const tree = git(root, ['write-tree']).toString().trim();
  const unrelated = git(root, ['commit-tree', tree, '-m', 'unrelated']).toString().trim();
  git(root, ['tag', '-a', 'base-tag', '-m', 'base tag']);
  const annotatedTag = git(root, ['rev-parse', 'base-tag^{tag}']).toString().trim();
  write(root, 'docs/features/a/requests/2026-07-01-missing-base.md', request({
    title: 'Missing base', status: 'Completed', checked: 2
  }).replace(/^> \*\*Implementation Base SHA\*\*:.+\n/m, ''));
  write(root, 'docs/features/a/requests/2026-07-02-invalid-base.md', request({
    title: 'Invalid base', status: 'Completed', checked: 2
  }).replace(/`0{40}`/, '`not-a-sha`'));
  write(root, 'docs/features/a/requests/2026-07-03-missing-commit.md', request({
    title: 'Missing commit', status: 'Completed', checked: 2
  }).replace(/`0{40}`/, `\`${'f'.repeat(40)}\``));
  write(root, 'docs/features/a/requests/2026-07-04-blob.md', withImplementationBase(root, request({
    title: 'Blob', status: 'Completed', checked: 2
  }), blob));
  write(root, 'docs/features/a/requests/2026-07-05-unrelated.md', withImplementationBase(root, request({
    title: 'Unrelated', status: 'Completed', checked: 2
  }), unrelated));
  write(root, 'docs/features/a/requests/2026-07-06-tag.md', withImplementationBase(root, request({
    title: 'Annotated tag', status: 'Completed', checked: 2
  }), annotatedTag));
  write(root, 'docs/features/a/requests/2026-07-07-unchecked.md', withImplementationBase(root, request({
    title: 'Unchecked', status: 'Done', checked: 1
  })));
  write(root, 'docs/features/a/requests/2026-07-08-valid.md', withImplementationBase(root, request({
    title: 'Valid', status: 'Completed', checked: 2
  })));

  const scan = scanRequests(root, { today: '2026-07-12' });
  assert.equal(scan.total, 8);
  assert.equal(scan.incomplete, 7);
  assert.deepEqual(scan.requests.map((item) => item.parse_errors), [
    ['missing-implementation-base'],
    ['invalid-implementation-base'],
    ['missing-implementation-base-commit'],
    ['implementation-base-not-commit'],
    ['implementation-base-not-ancestor'],
    ['implementation-base-not-commit'],
    ['incomplete-acceptance-criteria']
  ]);
  assert.equal(resolveFeature(root, { feature: 'a' }).active_requests.length, 7);
});

test('bounded ancestry remains correct beyond the synchronous child output limit', (t) => {
  const root = createRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const base = git(root, ['rev-parse', 'HEAD']).toString().trim();
  const commits = Array.from({ length: 26000 }, (_, index) => [
    'commit refs/heads/main',
    'committer Fixture <fixture@example.invalid> 1700000000 +0000',
    'data 1',
    'x',
    ...(index === 0 ? [`from ${base}`] : []),
    ''
  ].join('\n')).join('\n');
  const imported = spawnSync('git', ['fast-import', '--quiet'], {
    cwd: root,
    input: commits,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024
  });
  assert.equal(imported.status, 0, imported.stderr || imported.stdout);
  git(root, ['reset', '--hard', 'HEAD']);
  for (const suffix of ['one', 'two']) {
    write(root, `docs/features/a/requests/2026-07-01-${suffix}.md`,
      withImplementationBase(root, request({
        title: `Bounded ${suffix}`,
        status: 'Completed',
        checked: 2
      }), base));
  }
  const scan = scanRequests(root, { today: '2026-07-12' });
  assert.equal(scan.total, 2);
  assert.equal(scan.incomplete, 0);
});

test('CLI ignores hostile ambient Git repository and configuration selectors', (t) => {
  const root = createRepo();
  const hostile = createRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  t.after(() => fs.rmSync(hostile, { recursive: true, force: true }));
  write(root, 'docs/features/auth/requests/2026-07-01-pending.md',
    request({ title: 'Visible pending' }));
  const cliPath = path.resolve(__dirname, requestToolPath);
  const result = spawnSync(process.execPath, [cliPath, 'scan', '--today', '2026-07-12'], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_ALTERNATE_OBJECT_DIRECTORIES: path.join(hostile, '.git', 'objects'),
      GIT_COMMON_DIR: path.join(hostile, '.git'),
      GIT_CONFIG_COUNT: '1',
      GIT_CONFIG_GLOBAL: path.join(hostile, 'hostile.gitconfig'),
      GIT_CONFIG_KEY_0: 'core.bare',
      GIT_CONFIG_NOSYSTEM: '0',
      GIT_CONFIG_PARAMETERS: "'core.bare'='true'",
      GIT_CONFIG_VALUE_0: 'true',
      GIT_DIR: path.join(hostile, '.git'),
      GIT_INDEX_FILE: path.join(hostile, '.git', 'index'),
      GIT_NAMESPACE: 'hostile',
      GIT_OBJECT_DIRECTORY: path.join(hostile, '.git', 'objects'),
      GIT_QUARANTINE_PATH: path.join(hostile, '.git', 'objects'),
      GIT_REPLACE_REF_BASE: 'refs/replace-hostile/',
      GIT_SHALLOW_FILE: path.join(hostile, '.git', 'shallow'),
      GIT_WORK_TREE: hostile
    }
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const scan = JSON.parse(result.stdout);
  assert.equal(scan.total, 1);
  assert.equal(scan.incomplete, 1);
  assert.equal(scan.requests[0].title, 'Visible pending');
});

test('CLI preserves the caller-selected Git PATH in its clean subprocess environment', (t) => {
  if (process.platform === 'win32' || /\s/.test(process.execPath)) {
    t.skip('the executable PATH wrapper fixture requires a whitespace-free Unix node path');
    return;
  }
  const root = createRepo();
  const wrapperRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-git-path-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  t.after(() => fs.rmSync(wrapperRoot, { recursive: true, force: true }));
  write(root, 'docs/features/auth/requests/2026-07-01-pending.md',
    request({ title: 'PATH-selected pending' }));
  const gitExecutable = (process.env.PATH || '').split(path.delimiter)
    .map((directory) => path.join(directory, 'git'))
    .find((candidate) => {
      try {
        fs.accessSync(candidate, fs.constants.X_OK);
        return true;
      } catch {
        return false;
      }
    });
  assert.ok(gitExecutable, 'test requires Git on the caller PATH');
  const marker = path.join(wrapperRoot, 'used');
  const wrapper = path.join(wrapperRoot, 'git');
  fs.writeFileSync(wrapper, [
    `#!${process.execPath}`,
    "'use strict';",
    "const fs = require('node:fs');",
    "const { spawnSync } = require('node:child_process');",
    `fs.writeFileSync(${JSON.stringify(marker)}, 'used\\n');`,
    `const result = spawnSync(${JSON.stringify(gitExecutable)}, process.argv.slice(2), { stdio: 'inherit' });`,
    "process.exit(result.status === null ? 1 : result.status);",
    ''
  ].join('\n'));
  fs.chmodSync(wrapper, 0o755);
  const cliPath = path.resolve(__dirname, requestToolPath);
  const result = spawnSync(process.execPath, [cliPath, 'scan', '--today', '2026-07-12'], {
    cwd: root,
    encoding: 'utf8',
    env: { PATH: wrapperRoot }
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(fs.readFileSync(marker, 'utf8'), 'used\n');
});

test('Superseded is terminal only with contained reciprocal replacement links', (t) => {
  const root = createRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const base = (title, status, links = '') => request({
    title,
    status,
    created: '2026-07-01',
    checked: status === 'Superseded' ? 2 : 0
  }).replace('> **Priority**: P1', `> **Priority**: P1${links}`);

  write(root, 'docs/features/a/requests/2026-07-01-missing.md', base('Missing', 'Superseded'));
  write(root, 'docs/features/a/requests/2026-07-02-one-way.md', base(
    'One way', 'Superseded', '\n> **Superseded By**: [Replacement](./2026-07-03-one-way-new.md)'
  ));
  write(root, 'docs/features/a/requests/2026-07-03-one-way-new.md', base('One way new', 'Pending'));
  write(root, 'docs/features/a/requests/2026-07-04-broken.md', base(
    'Broken', 'Superseded', '\n> **Superseded By**: [Missing](./2026-07-99-missing.md)'
  ));
  write(root, 'docs/features/a/requests/2026-07-05-valid.md', base(
    'Valid old', 'Superseded', '\n> **Superseded By**: [Valid new](./2026-07-06-valid-new.md)'
  ));
  write(root, 'docs/features/a/requests/2026-07-06-valid-new.md', base(
    'Valid new', 'Pending', '\n> **Supersedes**: [Valid old](./2026-07-05-valid.md)'
  ));

  const scan = scanRequests(root, { today: '2026-07-12' });
  assert.equal(scan.total, 6);
  assert.equal(scan.incomplete, 5);
  assert.equal(scan.requests.some((item) => item.title === 'Valid old'), false);
  assert.deepEqual(
    scan.requests.find((item) => item.title === 'Missing').parse_errors,
    ['missing-superseded-by']
  );
  assert.deepEqual(
    scan.requests.find((item) => item.title === 'One way').parse_errors,
    ['missing-reciprocal-supersedes']
  );
  assert.deepEqual(
    scan.requests.find((item) => item.title === 'Broken').parse_errors,
    ['broken-superseded-by']
  );
});

test('supersession graph rejects self-links and cycles but accepts a linear chain', (t) => {
  const root = createRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const base = (title, status, links) => request({
    title, status, created: '2026-07-01', checked: status === 'Superseded' ? 2 : 0
  }).replace('> **Priority**: P1', `> **Priority**: P1${links}`);

  write(root, 'docs/features/a/requests/2026-07-01-self.md', base(
    'Self', 'Superseded',
    '\n> **Superseded By**: [Self](./2026-07-01-self.md)\n> **Supersedes**: [Self](./2026-07-01-self.md)'
  ));
  write(root, 'docs/features/a/requests/2026-07-02-cycle-a.md', base(
    'Cycle A', 'Superseded',
    '\n> **Superseded By**: [Cycle B](./2026-07-03-cycle-b.md)\n> **Supersedes**: [Cycle B](./2026-07-03-cycle-b.md)'
  ));
  write(root, 'docs/features/a/requests/2026-07-03-cycle-b.md', base(
    'Cycle B', 'Superseded',
    '\n> **Superseded By**: [Cycle A](./2026-07-02-cycle-a.md)\n> **Supersedes**: [Cycle A](./2026-07-02-cycle-a.md)'
  ));

  write(root, 'docs/features/b/requests/2026-07-01-linear-a.md', base(
    'Linear A', 'Superseded',
    '\n> **Superseded By**: [Linear B](./2026-07-02-linear-b.md)'
  ));
  write(root, 'docs/features/b/requests/2026-07-02-linear-b.md', base(
    'Linear B', 'Superseded',
    '\n> **Superseded By**: [Linear C](./2026-07-03-linear-c.md)\n> **Supersedes**: [Linear A](./2026-07-01-linear-a.md)'
  ));
  write(root, 'docs/features/b/requests/2026-07-03-linear-c.md', base(
    'Linear C', 'In Progress',
    '\n> **Supersedes**: [Linear B](./2026-07-02-linear-b.md)'
  ));

  const scan = scanRequests(root, { today: '2026-07-12' });
  assert.equal(scan.total, 6);
  assert.deepEqual(scan.requests.map((item) => item.title), ['Linear C', 'Self', 'Cycle A', 'Cycle B']);
  assert.deepEqual(scan.requests.find((item) => item.title === 'Self').parse_errors, ['self-supersession']);
  for (const title of ['Cycle A', 'Cycle B']) {
    assert.deepEqual(scan.requests.find((item) => item.title === title).parse_errors, ['cyclic-supersession']);
  }
});

test('active status ordering survives unrelated metadata errors', (t) => {
  const root = createRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  write(root, 'docs/features/a/requests/no-date-progress.md', request({
    title: 'Progress', status: 'In Progress', created: '2026-07-01'
  }).replace(/^> \*\*Created\*\*:.+\n/m, ''));
  write(root, 'docs/features/a/requests/2026-07-01-candidate.md', request({
    title: 'Candidate', status: 'Candidate Complete', checked: 2
  }));
  const scan = scanRequests(root, { today: '2026-07-12' });
  assert.deepEqual(scan.requests.map((item) => item.title), ['Progress', 'Candidate']);
  assert.deepEqual(scan.requests[0].parse_errors, ['missing-created-date']);
});

test('Candidate Complete requires every acceptance criterion checked', (t) => {
  const root = createRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  write(root, 'docs/features/a/requests/2026-07-01-partial.md', request({
    title: 'Partial candidate', status: 'Candidate Complete', priority: 'P0', checked: 1
  }));
  write(root, 'docs/features/a/requests/2026-07-02-full.md', request({
    title: 'Full candidate', status: 'Candidate Complete', priority: 'P2', checked: 2
  }));

  const scan = scanRequests(root, { today: '2026-07-12' });
  assert.deepEqual(scan.requests.map((item) => item.title), ['Full candidate', 'Partial candidate']);
  assert.deepEqual(scan.requests[0].parse_errors, []);
  assert.deepEqual(scan.requests[1].parse_errors, ['incomplete-acceptance-criteria']);
  assert.equal(resolveFeature(root, { feature: 'a' }).active_requests.length, 2);
});

test('Candidate Complete ordering survives unrelated metadata errors', (t) => {
  const root = createRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  write(root, 'docs/features/a/requests/no-date-candidate.md', request({
    title: 'Candidate without date', status: 'Candidate Complete', priority: 'P2', checked: 2
  }).replace(/^> \*\*Created\*\*:.+\n/m, ''));
  write(root, 'docs/features/a/requests/2026-07-01-pending.md', request({
    title: 'Pending', status: 'Pending', priority: 'P0'
  }));
  const scan = scanRequests(root, { today: '2026-07-12' });
  assert.deepEqual(scan.requests.map((item) => item.title), ['Candidate without date', 'Pending']);
  assert.deepEqual(scan.requests[0].parse_errors, ['missing-created-date']);
});

test('feature discovery rejects symlinked and dangling docs ancestors', (t) => {
  for (const variant of ['docs-external', 'docs-dangling', 'features-external', 'features-dangling']) {
    const root = createRepo();
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-features-outside-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    t.after(() => fs.rmSync(outside, { recursive: true, force: true }));
    const dangling = variant.endsWith('dangling');
    const target = dangling ? `${outside}-missing` : outside;
    if (variant.startsWith('docs-')) {
      if (!dangling) fs.mkdirSync(path.join(outside, 'features', 'external'), { recursive: true });
      fs.symlinkSync(target, path.join(root, 'docs'));
    } else {
      fs.mkdirSync(path.join(root, 'docs'));
      if (!dangling) fs.mkdirSync(path.join(outside, 'external'), { recursive: true });
      fs.symlinkSync(target, path.join(root, 'docs', 'features'));
    }
    assert.throws(() => resolveFeature(root), /symlink/);
    assert.throws(() => scanRequests(root, { today: '2026-07-12' }), /symlink/);
  }
});

test('create-request payload is Codex-native, concise, and closure-safe', () => {
  const skillPath = path.join(path.dirname(path.dirname(resolvedRequestToolPath)), 'SKILL.md');
  const skill = fs.readFileSync(skillPath, 'utf8');
  const lines = skill.split(/\r?\n/).length;

  assert.ok(lines < 500);
  assert.match(skill, /^---\nname: create-request\ndescription: .+\n---/);
  assert.doesNotMatch(skill, /allowed-tools|AskUserQuestion|Claude `Agent`/);
  assert.match(skill, /Create[\s\S]*Update one[\s\S]*Update all[\s\S]*Status/);
  assert.match(skill, /no more than eight acceptance criteria/i);
  assert.match(skill, /60 seconds/);
  assert.match(skill, /file:line/);
  assert.match(skill, /highest writable state is[\s\S]*Candidate Complete/i);
  assert.match(skill, /closure preparation[\s\S]*finalization/i);
  const referencePath = path.join(path.dirname(skillPath), 'references', 'request-format.md');
  assert.ok(fs.existsSync(referencePath));
  const reference = fs.readFileSync(referencePath, 'utf8');
  assert.match(reference, /Durable closure[\s\S]*two-perspective review/i);
  assert.match(reference, /pending_record_sha256[\s\S]*supersedes_record_sha256/i);
  assert.match(reference, /path:line/);
  assert.match(reference, /at least one evidence location outside the request/i);
  assert.match(reference,
    /Legacy pending records[\s\S]*schema-v2[\s\S]*cannot be[\s\S]*newly applied or finalized/i);
  assert.match(reference, /Recovery remains available[\s\S]*legacy apply journal/i);
  assert.match(reference, /there is no automatic rollback/i);
  assert.doesNotMatch(reference, /failed truncate\/write\/fsync[^.]*restores the exact prior/i);
  const helper = fs.readFileSync(path.join(path.dirname(skillPath), 'scripts', 'request-tool.js'), 'utf8');
  assert.match(helper, /merge-base['"], ['"]--is-ancestor/);
  assert.doesNotMatch(helper, /rev-list['"], ['"]HEAD/);
  assert.match(helper, /const baseErrors = new Map\(\)/);
  assert.match(helper, /env: CLEAN_GIT_ENV/);
});
