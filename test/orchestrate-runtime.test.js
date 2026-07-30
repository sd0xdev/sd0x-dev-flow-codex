'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const { commit, git, initRepository, isolateGitEnvironment } = require('./helpers/git');

isolateGitEnvironment();

const SKILL_ROOT = path.resolve(
  __dirname, '..', 'plugin', 'sd0x-dev-flow-codex', 'skills', 'orchestrate'
);
const orchestrateValidator = require(path.join(
  SKILL_ROOT, 'scripts', 'validate-plan.js'
));

function runScript(relative, options = {}) {
  return spawnSync(process.execPath, [path.join(SKILL_ROOT, relative), ...(options.args || [])], {
    cwd: options.cwd,
    encoding: 'utf8',
    input: options.input,
    timeout: options.timeout,
    env: { ...process.env, ...(options.env || {}) }
  });
}

function repository(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-orchestrate-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  initRepository(root);
  fs.writeFileSync(path.join(root, 'app.js'), 'baseline\n');
  git(root, ['add', '.']);
  commit(root, 'baseline');
  return root;
}

function plan() {
  return {
    intent: { type: 'user-objective', sha256: 'a'.repeat(64) },
    done_definition: {
      type: 'evidence-report',
      required_outputs: ['sources', 'findings', 'gaps', 'follow-up']
    },
    steps: [{
      id: 'inspect',
      kind: 'main-skill',
      target: 'ask',
      why: { type: 'repository-signal', evidence_index: 0 },
      depends_on: [],
      evidence: [{ type: 'repository-path', path: 'AGENTS.md', line: 1 }],
      done_criteria: { type: 'evidence-count', minimum: 1 },
      task: {
        type: 'evidence-inspection',
        operation: 'assess',
        concern: 'correctness',
        selectors: ['runtime-behavior'],
        required_outputs: ['sources', 'findings', 'gaps']
      },
      parallel_group: null,
      mutating: false,
      mutation_class: null
    }],
    stop_conditions: ['repository-drift', 'budget-exhausted'],
    budgets: { max_steps: 4, max_workers: 2, max_waves: 2 }
  };
}

test('orchestrate baseline detects repeated tracked and untracked content edits', (t) => {
  const trackedRoot = repository(t);
  fs.writeFileSync(path.join(trackedRoot, 'app.js'), 'dirty-one\n');
  const trackedSnapshot = runScript('scripts/run-verify.js', {
    cwd: trackedRoot,
    args: ['snapshot']
  });
  assert.equal(trackedSnapshot.status, 0, trackedSnapshot.stderr);
  const trackedFingerprint = JSON.parse(trackedSnapshot.stdout).fingerprint;
  fs.writeFileSync(path.join(trackedRoot, 'app.js'), 'dirty-two\n');
  const trackedCompare = runScript('scripts/run-verify.js', {
    cwd: trackedRoot,
    args: ['compare', '--expect', trackedFingerprint]
  });
  assert.equal(trackedCompare.status, 2, trackedCompare.stderr);
  assert.equal(JSON.parse(trackedCompare.stdout).ok, false);

  const untrackedRoot = repository(t);
  fs.writeFileSync(path.join(untrackedRoot, 'notes.txt'), 'untracked-one\n');
  const untrackedSnapshot = runScript('scripts/run-verify.js', {
    cwd: untrackedRoot,
    args: ['snapshot']
  });
  assert.equal(untrackedSnapshot.status, 0, untrackedSnapshot.stderr);
  const untrackedFingerprint = JSON.parse(untrackedSnapshot.stdout).fingerprint;
  fs.writeFileSync(path.join(untrackedRoot, 'notes.txt'), 'untracked-two\n');
  const untrackedCompare = runScript('scripts/run-verify.js', {
    cwd: untrackedRoot,
    args: ['compare', '--expect', untrackedFingerprint]
  });
  assert.equal(untrackedCompare.status, 2, untrackedCompare.stderr);
  assert.equal(JSON.parse(untrackedCompare.stdout).ok, false);
});

test('orchestrate baseline detects repeated tracked submodule edits', (t) => {
  const root = repository(t);
  const source = repository(t);
  fs.writeFileSync(path.join(source, 'child.js'), 'child-one\n');
  git(source, ['add', 'child.js']);
  commit(source, 'child baseline');
  git(root, [
    '-c', 'protocol.file.allow=always', 'submodule', 'add', source, 'nested'
  ], { stdio: 'ignore' });
  git(root, ['add', '.gitmodules', 'nested']);
  commit(root, 'track nested repository');

  const child = path.join(root, 'nested', 'child.js');
  fs.writeFileSync(child, 'child-two\n');
  const snapshot = runScript('scripts/run-verify.js', {
    cwd: root,
    args: ['snapshot']
  });
  assert.equal(snapshot.status, 0, snapshot.stderr);
  const fingerprint = JSON.parse(snapshot.stdout).fingerprint;
  fs.writeFileSync(child, 'child-three\n');
  const compare = runScript('scripts/run-verify.js', {
    cwd: root,
    args: ['compare', '--expect', fingerprint]
  });
  assert.equal(compare.status, 2, compare.stderr);
  assert.equal(JSON.parse(compare.stdout).ok, false);
});

test('orchestrate baseline ignores hostile Git repository selectors', (t) => {
  const root = repository(t);
  const decoy = repository(t);
  const baseline = runScript('scripts/run-verify.js', {
    cwd: root,
    args: ['snapshot']
  });
  assert.equal(baseline.status, 0, baseline.stderr);
  const fingerprint = JSON.parse(baseline.stdout).fingerprint;
  const selectors = [
    { GIT_DIR: path.join(decoy, '.git'), GIT_WORK_TREE: decoy },
    { GIT_INDEX_FILE: path.join(decoy, '.git', 'index') },
    { GIT_OBJECT_DIRECTORY: path.join(decoy, '.git', 'objects') },
    {
      GIT_CONFIG_COUNT: '1',
      GIT_CONFIG_KEY_0: 'core.repositoryformatversion',
      GIT_CONFIG_VALUE_0: '999'
    }
  ];
  for (const env of selectors) {
    const selected = runScript('scripts/run-verify.js', {
      cwd: root,
      args: ['snapshot'],
      env
    });
    assert.equal(selected.status, 0, selected.stderr);
    assert.equal(JSON.parse(selected.stdout).fingerprint, fingerprint);
  }
  fs.writeFileSync(path.join(root, 'app.js'), 'changed target\n');
  for (const env of selectors) {
    const compare = runScript('scripts/run-verify.js', {
      cwd: root,
      args: ['compare', '--expect', fingerprint],
      env
    });
    assert.equal(compare.status, 2, compare.stderr);
    assert.equal(JSON.parse(compare.stdout).ok, false);
  }
});

test('orchestrate baseline never invokes repository-local Git helpers', (t) => {
  const configureHelpers = (root, suffix) => {
    const marker = path.join(root, `.helper-${suffix}`);
    const helper = path.join(root, `.helper-${suffix}.sh`);
    fs.writeFileSync(helper, `#!/bin/sh\nprintf invoked >> "${marker}"\n`);
    fs.chmodSync(helper, 0o755);
    fs.writeFileSync(path.join(root, '.gitattributes'), '*.txt diff=hostile\n');
    git(root, ['add', '.gitattributes']);
    commit(root, `configure ${suffix} attributes`);
    git(root, ['config', 'core.fsmonitor', helper]);
    git(root, ['config', 'diff.hostile.textconv', helper]);
    fs.writeFileSync(path.join(root, 'probe.txt'), 'baseline\n');
    git(root, ['add', 'probe.txt']);
    commit(root, `configure ${suffix} probe`);
    fs.writeFileSync(path.join(root, 'probe.txt'), 'changed\n');
    fs.rmSync(marker, { force: true });
    return marker;
  };

  const root = repository(t);
  const rootMarker = configureHelpers(root, 'root');
  const nested = repository(t);
  const nestedMarker = configureHelpers(nested, 'nested');
  git(root, [
    '-c', 'protocol.file.allow=always', 'submodule', 'add', nested, 'nested'
  ], { stdio: 'ignore' });
  git(root, ['add', '.gitmodules', 'nested']);
  commit(root, 'track helper-protected nested repository');
  fs.writeFileSync(path.join(root, 'nested', 'probe.txt'), 'nested changed again\n');
  fs.rmSync(rootMarker, { force: true });
  fs.rmSync(nestedMarker, { force: true });

  const snapshot = runScript('scripts/run-verify.js', {
    cwd: root,
    args: ['snapshot']
  });
  assert.equal(snapshot.status, 0, snapshot.stderr);
  assert.equal(fs.existsSync(rootMarker), false);
  assert.equal(fs.existsSync(nestedMarker), false);
});

test('orchestrate baseline never invokes promisor remote helpers', (t) => {
  const makePromisor = (root, suffix) => {
    const external = fs.mkdtempSync(path.join(os.tmpdir(), `sd0x-promisor-${suffix}-`));
    t.after(() => fs.rmSync(external, { recursive: true, force: true }));
    const marker = path.join(external, 'invoked');
    const helper = path.join(external, 'remote-helper.sh');
    fs.writeFileSync(helper, `#!/bin/sh\nprintf invoked >> "${marker}"\nexit 1\n`);
    fs.chmodSync(helper, 0o755);
    git(root, ['config', 'core.repositoryformatversion', '1']);
    git(root, ['config', 'extensions.partialclone', 'origin']);
    git(root, ['config', 'remote.origin.promisor', 'true']);
    git(root, ['config', 'remote.origin.partialclonefilter', 'blob:none']);
    git(root, ['config', 'remote.origin.url', `ext::${helper}`]);
    git(root, ['config', 'protocol.ext.allow', 'always']);
    const oid = git(root, ['rev-parse', 'HEAD:app.js'], { encoding: 'utf8' }).trim();
    const gitDirectory = git(root, ['rev-parse', '--absolute-git-dir'], {
      encoding: 'utf8'
    }).trim();
    const object = path.join(gitDirectory, 'objects', oid.slice(0, 2), oid.slice(2));
    assert.equal(fs.existsSync(object), true);
    fs.rmSync(object);
    return { marker, object, config: fs.readFileSync(path.join(gitDirectory, 'config')) };
  };

  const root = repository(t);
  const hostileRoot = makePromisor(root, 'root');
  fs.writeFileSync(path.join(root, 'app.js'), 'promisor dirty\n');
  const rootSnapshot = runScript('scripts/run-verify.js', {
    cwd: root,
    args: ['snapshot']
  });
  assert.notEqual(rootSnapshot.status, 0, rootSnapshot.stdout);
  assert.equal(fs.existsSync(hostileRoot.marker), false);
  assert.equal(fs.existsSync(hostileRoot.object), false);
  assert.deepEqual(fs.readFileSync(path.join(root, '.git', 'config')), hostileRoot.config);

  const parent = repository(t);
  const source = repository(t);
  git(parent, [
    '-c', 'protocol.file.allow=always', 'submodule', 'add', source, 'nested'
  ], { stdio: 'ignore' });
  git(parent, ['add', '.gitmodules', 'nested']);
  commit(parent, 'track nested promisor repository');
  const nested = path.join(parent, 'nested');
  const hostileNested = makePromisor(nested, 'nested');
  fs.writeFileSync(path.join(nested, 'app.js'), 'nested dirty\n');
  const nestedSnapshot = runScript('scripts/run-verify.js', {
    cwd: parent,
    args: ['snapshot']
  });
  assert.notEqual(nestedSnapshot.status, 0, nestedSnapshot.stdout);
  assert.equal(fs.existsSync(hostileNested.marker), false);
  assert.equal(fs.existsSync(hostileNested.object), false);
  const nestedGit = git(nested, ['rev-parse', '--absolute-git-dir'], {
    encoding: 'utf8'
  }).trim();
  assert.deepEqual(fs.readFileSync(path.join(nestedGit, 'config')), hostileNested.config);
});

test('orchestrate plan validator accepts only the closed read-only schema', async (t) => {
  const validate = (value, options = {}) => runScript('scripts/validate-plan.js', {
    args: ['--objective-sha256', options.objectiveSha256 || value.intent.sha256],
    cwd: options.cwd,
    input: JSON.stringify(value)
  });
  const accepted = validate(plan());
  assert.equal(accepted.status, 0, accepted.stderr);
  assert.match(JSON.parse(accepted.stdout).sha256, /^[a-f0-9]{64}$/);

  const cases = [
    ['missing budget field', (value) => { delete value.budgets.max_steps; }],
    ['missing typed task', (value) => { delete value.steps[0].task; }],
    ['empty stop conditions', (value) => { value.stop_conditions = []; }],
    ['empty evidence', (value) => { value.steps[0].evidence = []; }],
    ['unknown main skill', (value) => { value.steps[0].target = 'not-a-skill'; }],
    ['executable text', (value) => { value.steps[0].why = 'git status --short'; }],
    ['command after prose', (value) => { value.steps[0].why = 'Run git status'; }],
    ['command after separator', (value) => { value.steps[0].why = 'Inspect; git status'; }],
    ['redirect', (value) => { value.steps[0].why = 'git>output.txt'; }],
    ['executable path', (value) => { value.steps[0].why = '/bin/rm -f artifact'; }],
    ['unknown executable', (value) => { value.steps[0].why = 'touch artifact'; }],
    ['interpreter command', (value) => { value.steps[0].why = 'python3 -c pass'; }],
    ['relative helper', (value) => {
      value.steps[0].why = './repository-helper --write';
    }],
    ['punctuated relative helper', (value) => {
      value.steps[0].why = './repository-helper --write.';
    }],
    ['helper after opener', (value) => {
      value.steps[0].why = 'Inspect ./repository-helper --write.';
    }],
    ['interpreter after opener', (value) => {
      value.steps[0].why = 'Read python3 -c pass.';
    }],
    ['build command', (value) => { value.steps[0].why = 'make deploy'; }],
    ['write utility', (value) => { value.steps[0].why = 'tee output.txt'; }],
    ['gate claim', (value) => { value.steps[0].done_criteria = 'review passed'; }],
    ['punctuated gate claim', (value) => {
      value.steps[0].done_criteria = 'Review: passed.';
    }],
    ['approved gate claim', (value) => {
      value.steps[0].done_criteria = 'Verification was approved.';
    }],
    ['status before gate subject', (value) => {
      value.steps[0].done_criteria = 'The changes passed code review.';
    }],
    ['passive gate claim', (value) => {
      value.steps[0].done_criteria = 'Code review was eventually approved.';
    }],
    ['unadmitted role', (value) => {
      value.steps[0].kind = 'fanout';
      value.steps[0].target = 'coverage-analyst';
      value.steps[0].parallel_group = 'wave-1';
    }],
    ['worker group limit', (value) => {
      value.budgets.max_workers = 1;
      value.steps = [0, 1].map((index) => ({
        ...value.steps[0],
        id: 'fanout-' + index,
        kind: 'fanout',
        target: 'explorer',
        parallel_group: 'wave-1'
      }));
    }]
  ];
  for (const [name, mutate] of cases) {
    await t.test(name, () => {
      const value = structuredClone(plan());
      mutate(value);
      const result = validate(value);
      assert.notEqual(result.status, 0, result.stdout);
      assert.match(result.stderr, /^validate-plan:/);
    });
  }
  for (const objective of [
    'determine why the tests fail.',
    'Determine why the tests fail.',
    'Touch artifact.',
    'The reviewer found no actionable findings.'
  ]) {
    const benign = structuredClone(plan());
    benign.intent.sha256 = crypto.createHash('sha256').update(objective).digest('hex');
    assert.equal(validate(benign).status, 0);
  }
  const mismatch = plan();
  assert.notEqual(validate(mismatch, { objectiveSha256: 'b'.repeat(64) }).status, 0);
  const missingDigest = runScript('scripts/validate-plan.js', {
    input: JSON.stringify(plan())
  });
  assert.notEqual(missingDigest.status, 0);

  const pathRoot = repository(t);
  fs.mkdirSync(path.join(pathRoot, 'Scripts'));
  fs.writeFileSync(path.join(pathRoot, 'Scripts', 'helper'), 'evidence\n');
  const typedPath = structuredClone(plan());
  typedPath.steps[0].evidence[0].path = 'Scripts/helper';
  assert.equal(validate(typedPath, { cwd: pathRoot }).status, 0);

  fs.writeFileSync(path.join(pathRoot, '.env'), 'TOKEN=secret\n');
  const protectedPath = structuredClone(plan());
  protectedPath.steps[0].evidence[0].path = '.env';
  assert.notEqual(validate(protectedPath, { cwd: pathRoot }).status, 0);
  const gitConfig = structuredClone(plan());
  gitConfig.steps[0].evidence[0].path = '.git/config';
  assert.notEqual(validate(gitConfig, { cwd: pathRoot }).status, 0);
  for (const relative of ['.npmrc', '.aws/credentials', '.ssh/id_ecdsa']) {
    fs.mkdirSync(path.dirname(path.join(pathRoot, relative)), { recursive: true });
    fs.writeFileSync(path.join(pathRoot, relative), 'credential material\n');
    const protectedCredential = structuredClone(plan());
    protectedCredential.steps[0].evidence[0].path = relative;
    assert.notEqual(validate(protectedCredential, { cwd: pathRoot }).status, 0);
  }

  const external = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-orchestrate-external-'));
  t.after(() => fs.rmSync(external, { recursive: true, force: true }));
  fs.writeFileSync(path.join(external, 'outside.txt'), 'first\n');
  fs.symlinkSync(path.join(external, 'outside.txt'), path.join(pathRoot, 'outside-link'));
  const externalLink = structuredClone(plan());
  externalLink.steps[0].evidence[0].path = 'outside-link';
  assert.notEqual(validate(externalLink, { cwd: pathRoot }).status, 0);
  fs.writeFileSync(path.join(external, 'outside.txt'), 'second\n');
  assert.notEqual(validate(externalLink, { cwd: pathRoot }).status, 0);
  fs.symlinkSync(external, path.join(pathRoot, 'linked-directory'));
  const linkedAncestor = structuredClone(plan());
  linkedAncestor.steps[0].evidence[0].path = 'linked-directory/outside.txt';
  assert.notEqual(validate(linkedAncestor, { cwd: pathRoot }).status, 0);
});

test('orchestrate dispatch captures redacted bytes and rejects path swaps', (t) => {
  const root = repository(t);
  fs.writeFileSync(path.join(root, 'evidence.txt'), 'api_key=super-secret-value\nbehavior=true\n');
  const value = plan();
  value.steps[0].kind = 'fanout';
  value.steps[0].target = 'explorer';
  value.steps[0].parallel_group = 'wave-1';
  value.steps[0].evidence[0] = {
    type: 'repository-path', path: 'evidence.txt', line: 2
  };
  const rendered = orchestrateValidator.run(JSON.stringify(value), {
    root,
    expectedObjectiveSha256: value.intent.sha256
  });
  assert.equal(rendered.dispatches.length, 1);
  assert.doesNotMatch(rendered.dispatches[0].message, /super-secret-value/);
  assert.match(rendered.dispatches[0].message, /content_sha256/);
  const packet = JSON.parse(rendered.dispatches[0].message.match(
    /^Evidence packets: (.+)$/m
  )[1])[0];
  assert.match(Buffer.from(packet.bytes_base64, 'base64').toString(), /REDACTED/);
  assert.equal(packet.redactions, 1);
  assert.equal(Object.hasOwn(packet, 'source_sha256'), false);

  const credentials = [
    'Authorization: Bearer bearer-secret-value',
    'Authorization: Basic dXNlcjpwYXNzd29yZA==',
    'OPENAI_API_KEY=sk-proj-openai-secret-value',
    'SLACK_TOKEN=xoxb-slack-secret-value',
    'NPM_TOKEN=npm_registry-secret-value',
    'GITLAB_TOKEN=glpat-gitlab-secret-value',
    'GOOGLE_API_KEY=AIzaGoogleSecretValueThatIsLongEnough1234',
    'JWT=eyJheaderpart.payloadpart.signaturepart',
    'remote=https://user:password@example.test/repository',
    '-----BEGIN PRIVATE KEY-----\nincomplete-private-key-material',
    '{"password": "hunter 2"}',
    "client_secret='quoted token value'",
    'password="unterminated secret phrase',
    'password=unquoted secret phrase',
    'password="multiline secret phrase\ncontinuation fragment',
    '{\\"password\\": \\"escaped hunter 2\\"}',
    'payload={\\"api_key\\": \\"nested serialized secret\\"}',
    '{\\"client_secret\\": \\"escaped unterminated phrase',
    'password": "orphan closing label secret"',
    'password": "orphan incomplete secret',
    'password\\": \\"escaped orphan label secret\\"',
    'password\\": \\"escaped orphan incomplete secret',
    'password\\": "mismatched delimiter secret"',
    'password": \\"mismatched escaped value secret\\"'
  ];
  for (const depth of [17, 31]) {
    const escaped = '\\'.repeat(depth);
    credentials.push(
      `${escaped}"password${escaped}": ${escaped}"depth ${depth} balanced secret${escaped}"`,
      `password${escaped}": ${escaped}"depth ${depth} orphan secret${escaped}"`,
      `${escaped}"api_key${escaped}": ${escaped}"depth ${depth} incomplete secret`,
      `client_secret${escaped}": ${escaped}"depth ${depth} orphan incomplete secret`
    );
  }
  for (const [index, credential] of credentials.entries()) {
    fs.writeFileSync(path.join(root, 'evidence.txt'), credential + '\nbehavior=true\n');
    const credentialRender = orchestrateValidator.run(JSON.stringify(value), {
      root,
      expectedObjectiveSha256: value.intent.sha256
    });
    const message = credentialRender.dispatches[0].message;
    const credentialPacket = JSON.parse(message.match(/^Evidence packets: (.+)$/m)[1])[0];
    const decoded = Buffer.from(credentialPacket.bytes_base64, 'base64').toString();
    assert.equal(message.includes(credential), false, 'credential ' + index + ' reached dispatch');
    assert.equal(message.includes(crypto.createHash('sha256').update(
      credential + '\nbehavior=true\n'
    ).digest('hex')), false);
    assert.equal(decoded.includes(credential), false);
    assert.match(decoded, /REDACTED/);
    assert.doesNotMatch(decoded,
      /hunter 2|quoted token value|unterminated secret phrase|unquoted secret phrase|multiline secret phrase|continuation fragment|escaped hunter 2|nested serialized secret|escaped unterminated phrase/);
    assert.doesNotMatch(decoded,
      /orphan closing label secret|orphan incomplete secret|escaped orphan label secret|escaped orphan incomplete secret|mismatched delimiter secret|mismatched escaped value secret/);
    assert.doesNotMatch(decoded,
      /depth (?:17|31) (?:balanced|orphan|incomplete|orphan incomplete) secret/);
    assert.ok(credentialPacket.redactions >= 1);
  }

  const nearLimitCredential = 'password="' + '\\a'.repeat(15000) + 'terminal-fragment';
  fs.writeFileSync(path.join(root, 'evidence.txt'), nearLimitCredential);
  const boundedRedaction = runScript('scripts/validate-plan.js', {
    cwd: root,
    args: ['--objective-sha256', value.intent.sha256],
    input: JSON.stringify(value),
    timeout: 5000
  });
  assert.equal(boundedRedaction.error, undefined);
  assert.equal(boundedRedaction.status, 0, boundedRedaction.stderr);
  assert.doesNotMatch(boundedRedaction.stdout, /terminal-fragment/);

  fs.writeFileSync(path.join(root, 'evidence.txt'),
    'api'.repeat(10000) + '\nbehavior=true\n');
  const boundedNoMatch = runScript('scripts/validate-plan.js', {
    cwd: root,
    args: ['--objective-sha256', value.intent.sha256],
    input: JSON.stringify(value),
    timeout: 5000
  });
  assert.equal(boundedNoMatch.error, undefined);
  assert.equal(boundedNoMatch.status, 0, boundedNoMatch.stderr);

  fs.writeFileSync(path.join(root, 'evidence.txt'), 'same-size-before\n');
  assert.throws(() => orchestrateValidator.run(JSON.stringify(value), {
    root,
    expectedObjectiveSha256: value.intent.sha256,
    afterEvidenceOpen({ absolute }) {
      fs.writeFileSync(absolute, 'same-size-after!\n');
      const changed = new Date('2030-01-01T00:00:00.000Z');
      fs.utimesSync(absolute, changed, changed);
    }
  }), /repository evidence identity changed during read/);

  const external = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-orchestrate-swap-'));
  t.after(() => fs.rmSync(external, { recursive: true, force: true }));
  fs.writeFileSync(path.join(external, 'evidence.txt'), 'outside\n');
  assert.throws(() => orchestrateValidator.run(JSON.stringify(value), {
    root,
    expectedObjectiveSha256: value.intent.sha256,
    beforeEvidenceOpen({ absolute }) {
      fs.rmSync(absolute);
      fs.symlinkSync(path.join(external, 'evidence.txt'), absolute);
    }
  }), /repository evidence/);

  fs.rmSync(path.join(root, 'evidence.txt'));
  fs.mkdirSync(path.join(root, 'bound'));
  fs.writeFileSync(path.join(root, 'bound', 'inside.txt'), 'inside\n');
  fs.writeFileSync(path.join(external, 'inside.txt'), 'outside\n');
  value.steps[0].evidence[0].path = 'bound/inside.txt';
  assert.throws(() => orchestrateValidator.run(JSON.stringify(value), {
    root,
    expectedObjectiveSha256: value.intent.sha256,
    beforeEvidenceOpen() {
      fs.renameSync(path.join(root, 'bound'), path.join(root, 'bound-original'));
      fs.symlinkSync(external, path.join(root, 'bound'));
    }
  }), /repository evidence/);
});

test('orchestrate plan validator binds dispatch payloads and execution waves', async (t) => {
  const validate = (value) => runScript('scripts/validate-plan.js', {
    args: ['--objective-sha256', (value.plan || value).intent.sha256],
    input: JSON.stringify(value)
  });
  const step = (id, options = {}) => ({
    ...structuredClone(plan().steps[0]),
    id,
    kind: options.kind || 'fanout',
    target: options.target || 'explorer',
    depends_on: options.dependsOn || [],
    evidence: options.evidence || [{ type: 'repository-path', path: 'AGENTS.md', line: 1 }],
    task: options.task || {
      type: 'evidence-inspection',
      operation: 'assess',
      concern: 'correctness',
      selectors: ['runtime-behavior'],
      required_outputs: ['sources', 'findings', 'gaps']
    },
    parallel_group: options.group === undefined ? 'wave-1' : options.group
  });

  const acceptedPlan = plan();
  acceptedPlan.steps = [
    step('producer'),
    step('consumer', {
      kind: 'fanout',
      target: 'explorer',
      dependsOn: ['producer'],
      evidence: [{ type: 'step-output', step_id: 'producer' }],
      group: 'wave-2',
      task: {
        type: 'evidence-inspection',
        operation: 'compare',
        concern: 'compatibility',
        selectors: ['producer-result'],
        required_outputs: ['sources', 'findings', 'gaps']
      }
    })
  ];
  const accepted = validate(acceptedPlan);
  assert.equal(accepted.status, 0, accepted.stderr);
  const output = JSON.parse(accepted.stdout);
  assert.equal(output.objective_sha256, acceptedPlan.intent.sha256);
  assert.equal(output.dispatches.length, 1);
  assert.equal(output.dispatches[0].role, 'explorer');
  assert.match(output.dispatches[0].message, new RegExp(acceptedPlan.intent.sha256));
  assert.doesNotMatch(output.dispatches[0].message, /reviewer found no actionable/i);
  assert.deepEqual(output.pending, ['consumer']);

  const producerPacket = JSON.parse(output.dispatches[0].message.match(
    /^Evidence packets: (.+)$/m
  )[1])[0];
  const result = {
    schema_version: 1,
    step_id: 'producer',
    objective_sha256: acceptedPlan.intent.sha256,
    plan_sha256: output.sha256,
    task_sha256: orchestrateValidator.taskRecordSha256(acceptedPlan.steps[0].task),
    sources: [{
      type: 'evidence-reference', evidence_index: 0,
      sha256: producerPacket.content_sha256
    }],
    observations: [{
      type: 'confirmed', concern: 'correctness', source_index: 0,
      selector: 'runtime-behavior'
    }],
    gaps: []
  };
  result.sha256 = orchestrateValidator.resultRecordSha256(result);
  const next = validate({ plan: acceptedPlan, results: [result] });
  assert.equal(next.status, 0, next.stderr);
  const nextOutput = JSON.parse(next.stdout);
  assert.deepEqual(nextOutput.pending, []);
  assert.equal(nextOutput.dispatches.length, 1);
  assert.equal(nextOutput.dispatches[0].step_id, 'consumer');
  assert.match(nextOutput.dispatches[0].message, new RegExp(result.sha256));
  assert.match(nextOutput.dispatches[0].message, /validated-step-output/);

  const consumerResult = {
    schema_version: 1,
    step_id: 'consumer',
    objective_sha256: acceptedPlan.intent.sha256,
    plan_sha256: output.sha256,
    task_sha256: orchestrateValidator.taskRecordSha256(acceptedPlan.steps[1].task),
    sources: [{
      type: 'evidence-reference', evidence_index: 0, sha256: result.sha256
    }],
    observations: [{
      type: 'confirmed', concern: 'compatibility', source_index: 0,
      selector: 'producer-result'
    }],
    gaps: []
  };
  consumerResult.sha256 = orchestrateValidator.resultRecordSha256(consumerResult);
  assert.notEqual(validate({ plan: acceptedPlan, results: [consumerResult] }).status, 0);

  const neverDispatched = plan();
  const localResult = structuredClone(result);
  localResult.step_id = 'inspect';
  localResult.task_sha256 = orchestrateValidator.taskRecordSha256(neverDispatched.steps[0].task);
  localResult.sha256 = orchestrateValidator.resultRecordSha256(localResult);
  assert.notEqual(validate({ plan: neverDispatched, results: [localResult] }).status, 0);

  const insufficient = structuredClone(acceptedPlan);
  insufficient.steps[0].done_criteria.minimum = 2;
  const insufficientOutput = JSON.parse(validate(insufficient).stdout);
  const insufficientPacket = JSON.parse(insufficientOutput.dispatches[0].message.match(
    /^Evidence packets: (.+)$/m
  )[1])[0];
  const insufficientResult = structuredClone(result);
  insufficientResult.plan_sha256 = insufficientOutput.sha256;
  insufficientResult.sources[0].sha256 = insufficientPacket.content_sha256;
  insufficientResult.sha256 = orchestrateValidator.resultRecordSha256(insufficientResult);
  assert.notEqual(validate({ plan: insufficient, results: [insufficientResult] }).status, 0);

  const incompleteWave = structuredClone(acceptedPlan);
  incompleteWave.steps.splice(1, 0, step('peer'));
  const incompleteWaveOutput = JSON.parse(validate(incompleteWave).stdout);
  const incompleteProducer = structuredClone(result);
  incompleteProducer.plan_sha256 = incompleteWaveOutput.sha256;
  incompleteProducer.sha256 = orchestrateValidator.resultRecordSha256(incompleteProducer);
  const incompleteWaveNext = JSON.parse(validate({
    plan: incompleteWave, results: [incompleteProducer]
  }).stdout);
  assert.deepEqual(incompleteWaveNext.dispatches.map((dispatch) => dispatch.step_id), ['peer']);
  assert.deepEqual(incompleteWaveNext.pending, ['consumer']);
  const earlyConsumer = structuredClone(consumerResult);
  earlyConsumer.plan_sha256 = incompleteWaveOutput.sha256;
  earlyConsumer.sources[0].sha256 = incompleteProducer.sha256;
  earlyConsumer.sha256 = orchestrateValidator.resultRecordSha256(earlyConsumer);
  assert.notEqual(validate({
    plan: incompleteWave, results: [incompleteProducer, earlyConsumer]
  }).status, 0);

  const invalidResult = structuredClone(result);
  invalidResult.observations[0].selector = 'git status --short';
  invalidResult.sha256 = orchestrateValidator.resultRecordSha256(invalidResult);
  assert.notEqual(validate({ plan: acceptedPlan, results: [invalidResult] }).status, 0);

  const wrongConcern = structuredClone(result);
  wrongConcern.observations[0].concern = 'security';
  wrongConcern.sha256 = orchestrateValidator.resultRecordSha256(wrongConcern);
  assert.notEqual(validate({ plan: acceptedPlan, results: [wrongConcern] }).status, 0);

  const wrongSelector = structuredClone(result);
  wrongSelector.observations[0].selector = 'unrelated-selector';
  wrongSelector.sha256 = orchestrateValidator.resultRecordSha256(wrongSelector);
  assert.notEqual(validate({ plan: acceptedPlan, results: [wrongSelector] }).status, 0);

  const untypedFollowUp = structuredClone(acceptedPlan);
  untypedFollowUp.steps[0].task.required_outputs.push('follow-up');
  assert.notEqual(validate(untypedFollowUp).status, 0);

  const alternate = structuredClone(acceptedPlan);
  alternate.intent.sha256 = 'b'.repeat(64);
  alternate.steps[0].task.operation = 'trace';
  alternate.steps[0].task.concern = 'security';
  alternate.steps[0].task.selectors = ['credential-flow'];
  const alternateOutput = JSON.parse(validate(alternate).stdout);
  const normalize = (message) => message.replace(/[a-f0-9]{64}/g, '<digest>');
  assert.notEqual(
    normalize(output.dispatches[0].message),
    normalize(alternateOutput.dispatches[0].message)
  );

  const selfReference = plan();
  selfReference.steps = [step('self', {
    dependsOn: ['self'],
    evidence: [{ type: 'step-output', step_id: 'self' }]
  })];
  assert.notEqual(validate(selfReference).status, 0);

  const undeclaredOutput = plan();
  undeclaredOutput.steps = [
    step('producer'),
    step('consumer', {
      kind: 'main-skill',
      target: 'ask',
      evidence: [{ type: 'step-output', step_id: 'producer' }],
      group: null
    })
  ];
  assert.notEqual(validate(undeclaredOutput).status, 0);

  const futureOutput = plan();
  futureOutput.steps = [
    step('consumer', {
      kind: 'main-skill',
      target: 'ask',
      dependsOn: ['producer'],
      evidence: [{ type: 'step-output', step_id: 'producer' }],
      group: null
    }),
    step('producer')
  ];
  assert.notEqual(validate(futureOutput).status, 0);

  const sameGroup = plan();
  sameGroup.steps = [
    step('producer'),
    step('consumer', {
      dependsOn: ['producer'],
      evidence: [{ type: 'step-output', step_id: 'producer' }]
    })
  ];
  assert.notEqual(validate(sameGroup).status, 0);

  const tooManyWaves = plan();
  tooManyWaves.budgets.max_waves = 2;
  tooManyWaves.steps = [
    step('one', { kind: 'main-skill', target: 'ask', group: null }),
    step('two', {
      kind: 'main-skill', target: 'ask', dependsOn: ['one'],
      evidence: [{ type: 'step-output', step_id: 'one' }], group: null
    }),
    step('three', {
      kind: 'main-skill', target: 'ask', dependsOn: ['two'],
      evidence: [{ type: 'step-output', step_id: 'two' }], group: null
    })
  ];
  assert.notEqual(validate(tooManyWaves).status, 0);
});

test('orchestrate generator output validates plans with the synchronized policy', (t) => {
  const {
    orchestrateAdmissionPolicySource,
    orchestrateValidatePlanScript
  } = require('../scripts/prepare-planned-formal-plugin');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-orchestrate-generated-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const orchestrate = path.join(root, 'skills', 'orchestrate');
  fs.mkdirSync(path.join(orchestrate, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(orchestrate, 'references'), { recursive: true });
  fs.mkdirSync(path.join(root, 'skills', 'ask'), { recursive: true });
  fs.writeFileSync(path.join(root, 'skills', 'ask', 'SKILL.md'), '# Ask\n');
  fs.writeFileSync(path.join(root, 'AGENTS.md'), '# Guidance\n');
  fs.writeFileSync(path.join(
    orchestrate, 'references', 'admission-allowlist.json'
  ), orchestrateAdmissionPolicySource());
  const validator = path.join(orchestrate, 'scripts', 'validate-plan.js');
  fs.writeFileSync(validator, orchestrateValidatePlanScript());
  const runGenerated = (value) => spawnSync(process.execPath, [
    validator, '--objective-sha256', value.intent.sha256
  ], {
    cwd: root,
    encoding: 'utf8',
    input: JSON.stringify(value),
    env: process.env
  });
  const accepted = runGenerated(plan());
  assert.equal(accepted.status, 0, accepted.stderr);
  const invalid = plan();
  invalid.steps[0].why = 'Run git status';
  const rejected = runGenerated(invalid);
  assert.notEqual(rejected.status, 0, rejected.stdout);
  assert.match(rejected.stderr, /^validate-plan:/);
});
