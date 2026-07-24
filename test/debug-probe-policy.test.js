'use strict';
// sd0x-migration-supplemental-test target=debug unit=debug/default

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const test = require('node:test');
const policy = require('../scripts/debug-probe/probe-runner');
const {
  gitExecutableCandidates,
  trustedGitExecutable
} = require('../scripts/debug-probe/probe-spawn');

const ROOT = path.resolve(__dirname, '..');
const POLICY_FILES = Object.freeze([
  'probe-policy.js', 'probe-redaction.js', 'probe-runner.js', 'probe-spawn.js'
]);

function fakeChild(chunks = [], options = {}) {
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = (signal) => {
    if (child.killed) return true;
    child.killed = true;
    queueMicrotask(() => child.emit('close', null, signal));
    return true;
  };
  queueMicrotask(() => {
    for (const chunk of chunks) {
      if (child.killed) break;
      child.stdout.emit('data', Buffer.from(chunk));
    }
    if (options.close !== false && !child.killed) child.emit('close', 0, null);
  });
  return child;
}

function populated(directory) {
  return fs.existsSync(directory) && fs.readdirSync(directory).length > 0;
}

function completePolicyRoot(directory) {
  if (!fs.existsSync(directory)) return false;
  const entries = fs.readdirSync(directory).sort();
  if (JSON.stringify(entries) !== JSON.stringify([...POLICY_FILES].sort())) return false;
  return POLICY_FILES.every((name) => {
    const stat = fs.lstatSync(path.join(directory, name));
    return stat.isFile() && !stat.isSymbolicLink();
  });
}

function payloadPolicyRoot(root = ROOT) {
  const disposition = JSON.parse(fs.readFileSync(
    path.join(root, 'migration', 'source-disposition.json'), 'utf8'
  ));
  const rows = disposition.skills.filter((row) => row.target_skill === 'debug');
  assert.ok(rows.length > 0, 'debug disposition row is missing');
  const states = [...new Set(rows.map((row) => row.delivery_state))];
  assert.deepEqual(states.length, 1, 'debug disposition lifecycle is ambiguous');
  const candidate = path.join(root, 'migration', 'candidates', 'debug', 'scripts');
  const pack = path.join(
    root, 'migration', 'packs', 'development-pack', 'debug', 'scripts'
  );
  if (states[0] === 'candidate') {
    const candidateComplete = completePolicyRoot(candidate);
    const packComplete = completePolicyRoot(pack);
    assert.notEqual(candidateComplete, packComplete,
      'debug candidate lifecycle must have exactly one complete payload');
    if (candidateComplete) {
      assert.equal(populated(pack), false, 'debug candidate and pack payloads are ambiguous');
      return candidate;
    }
    assert.equal(populated(candidate), false, 'debug candidate and pack payloads are ambiguous');
    return pack;
  }
  if (states[0] === 'pack-ready') {
    assert.equal(populated(candidate), false, 'debug candidate and pack payloads are ambiguous');
    assert.equal(completePolicyRoot(pack), true, 'debug pack policy is incomplete');
    return pack;
  }
  throw new Error('debug policy cannot run for lifecycle state: ' + states[0]);
}

function assertTrustedPayloadBytes(payloadPath, name) {
  const trusted = fs.readFileSync(path.join(ROOT, 'scripts', 'debug-probe', name));
  const payload = fs.readFileSync(payloadPath);
  assert.deepEqual(payload, trusted, 'candidate probe policy must equal the trusted harness');
}

test('debug probe checks load only trusted code and reject candidate drift without execution', (t) => {
  const payloadRoot = payloadPolicyRoot();
  for (const name of POLICY_FILES) {
    assertTrustedPayloadBytes(path.join(payloadRoot, name), name);
  }
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'debug-probe-untrusted-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const marker = path.join(directory, 'executed');
  const malicious = path.join(directory, 'probe-policy.js');
  fs.copyFileSync(path.join(payloadRoot, 'probe-policy.js'), malicious);
  fs.appendFileSync(malicious, "\nrequire('node:fs').writeFileSync(" +
    JSON.stringify(marker) + ", 'executed');\n");
  assert.throws(() => assertTrustedPayloadBytes(malicious, 'probe-policy.js'),
    /candidate probe policy must equal the trusted harness/);
  assert.equal(fs.existsSync(marker), false);
});

test('debug probe payload selection follows lifecycle and rejects ambiguity', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'debug-probe-payload-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const dispositionPath = path.join(root, 'migration', 'source-disposition.json');
  fs.mkdirSync(path.dirname(dispositionPath), { recursive: true });
  const writeDisposition = (deliveryState) => fs.writeFileSync(dispositionPath,
    JSON.stringify({ skills: [{ target_skill: 'debug', delivery_state: deliveryState }] }) + '\n');
  const installPolicy = (directory) => {
    fs.mkdirSync(directory, { recursive: true });
    for (const name of POLICY_FILES) {
      fs.copyFileSync(path.join(ROOT, 'scripts', 'debug-probe', name), path.join(directory, name));
    }
  };
  const candidate = path.join(root, 'migration', 'candidates', 'debug', 'scripts');
  const pack = path.join(root, 'migration', 'packs', 'development-pack', 'debug', 'scripts');

  writeDisposition('candidate');
  installPolicy(candidate);
  assert.equal(payloadPolicyRoot(root), candidate);

  fs.rmSync(candidate, { recursive: true, force: true });
  fs.mkdirSync(candidate, { recursive: true });
  installPolicy(pack);
  assert.equal(payloadPolicyRoot(root), pack);

  writeDisposition('pack-ready');
  assert.equal(payloadPolicyRoot(root), pack);

  fs.writeFileSync(path.join(candidate, 'stale.js'), 'stale\n');
  assert.throws(() => payloadPolicyRoot(root), /candidate and pack payloads are ambiguous/);
});

test('debug probe runner never spawns stateful or destructive commands', async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'debug-probe-deny-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const marker = path.join(directory, 'executed');
  const stateful = await policy.runProbe('npm test', { cwd: directory });
  assert.equal(stateful.allowed, false);
  assert.equal(stateful.spawned, false);
  const destructive = await policy.runProbe('node -e fs.writeFileSync(' + marker + ',x)', {
    cwd: directory
  });
  assert.equal(destructive.allowed, false);
  assert.equal(destructive.spawned, false);
  assert.equal(fs.existsSync(marker), false);
});

test('debug probe runner binds permitted probes to fixed limits', async () => {
  const status = await policy.runProbe('git status --short', { cwd: ROOT });
  assert.equal(status.allowed, false);
  assert.equal(status.spawned, false);

  const failure = await policy.runProbe(
    'git rev-parse --verify refs/sd0x-debug-probe/missing',
    { cwd: ROOT }
  );
  assert.equal(failure.allowed, true);
  assert.equal(failure.spawned, true);
  assert.equal(failure.timeout_ms, 30_000);
  assert.equal(failure.max_output_bytes, 64 * 1024);
  assert.notEqual(failure.code, 0);
  assert.equal(failure.timeout, false);
  assert.equal(typeof failure.output, 'string');
});

test('debug Git probe cannot execute repository filters, fsmonitor, or submodules', async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'debug-probe-git-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const gitDirectory = path.join(directory, '.git');
  fs.mkdirSync(path.join(gitDirectory, 'objects'), { recursive: true });
  fs.mkdirSync(path.join(gitDirectory, 'refs', 'heads'), { recursive: true });
  fs.writeFileSync(path.join(gitDirectory, 'HEAD'), 'ref: refs/heads/main\n');
  fs.writeFileSync(path.join(gitDirectory, 'config'), [
    '[core]',
    '\trepositoryformatversion = 0',
    '\tfilemode = true',
    '\tbare = false',
    ''
  ].join('\n'));
  const marker = path.join(directory, 'repository-command-executed');
  const hook = path.join(directory, 'repository-command');
  fs.writeFileSync(hook, '#!/bin/sh\nprintf executed > ' + JSON.stringify(marker) + '\ncat\n');
  fs.chmodSync(hook, 0o755);
  fs.writeFileSync(path.join(directory, '.gitattributes'), 'tracked.txt filter=evil\n');
  fs.writeFileSync(path.join(directory, 'tracked.txt'), 'tracked\n');
  fs.appendFileSync(path.join(gitDirectory, 'config'), [
    '[filter "evil"]',
    '\tclean = ' + hook,
    '[core]',
    '\tfsmonitor = ' + hook,
    ''
  ].join('\n'));
  fs.rmSync(marker, { force: true });
  fs.writeFileSync(path.join(directory, 'tracked.txt'), 'modified\n');
  const pathMarker = path.join(directory, 'path-wrapper-executed');
  const pathWrapper = path.join(directory, 'git');
  fs.writeFileSync(pathWrapper,
    '#!/bin/sh\nprintf executed > ' + JSON.stringify(pathMarker) + '\nexit 1\n');
  fs.chmodSync(pathWrapper, 0o755);
  const priorPath = process.env.PATH;
  process.env.PATH = directory;
  t.after(() => {
    if (priorPath === undefined) delete process.env.PATH;
    else process.env.PATH = priorPath;
  });

  const indexPath = path.join(gitDirectory, 'index');
  assert.equal(fs.existsSync(indexPath), false);
  const status = await policy.runProbe('git status --short', { cwd: directory });
  const failure = await policy.runProbe(
    'git rev-parse --verify refs/sd0x-debug-probe/missing',
    { cwd: directory }
  );
  assert.equal(status.allowed, false);
  assert.equal(status.spawned, false);
  assert.notEqual(failure.code, 0);
  assert.equal(fs.existsSync(marker), false);
  assert.equal(fs.existsSync(pathMarker), false);
  assert.equal(fs.existsSync(indexPath), false);

  const spawnSource = fs.readFileSync(
    path.join(ROOT, 'scripts', 'debug-probe', 'probe-spawn.js'), 'utf8'
  );
  assert.match(spawnSource, /'--no-optional-locks'/);
  assert.equal(spawnSource.includes('spawn(TRUSTED_GIT_EXECUTABLE'), true);
  assert.match(spawnSource, /'core\.hooksPath=\/dev\/null'/);
  assert.match(spawnSource, /'core\.fsmonitor=false'/);
  assert.match(spawnSource, /'submodule\.recurse=false'/);
  assert.match(spawnSource, /env: CLOSED_GIT_ENV/);
  assert.doesNotMatch(spawnSource, /nodeProcess\.env|\bPATH\b/);
  assert.doesNotMatch(spawnSource, /'status'/);
});

test('debug Git resolver declares protected platform locations without PATH lookup', () => {
  assert.deepEqual(gitExecutableCandidates('win32'), [
    'C:\\Program Files\\Git\\cmd\\git.exe',
    'C:\\Program Files\\Git\\bin\\git.exe'
  ]);
  assert.deepEqual(gitExecutableCandidates('darwin'), [
    '/usr/bin/git', '/opt/homebrew/bin/git', '/usr/local/bin/git'
  ]);
  assert.deepEqual(gitExecutableCandidates('linux'), [
    '/usr/bin/git', '/bin/git', '/usr/local/bin/git'
  ]);
  assert.equal(path.isAbsolute(trustedGitExecutable()), true);
});

test('debug probe collector terminates a sleeping process at its deadline', async () => {
  const child = fakeChild([], { close: false });
  const result = await policy.collectChild(child, {
    timeout_ms: 25,
    max_output_bytes: policy.MAX_OUTPUT_BYTES
  });
  assert.equal(result.timeout, true);
  assert.equal(result.signal, 'SIGKILL');
});

test('debug probe collector sanitizes standalone and structured secrets before output', async () => {
  const values = [
    'Authorization: Bearer abc.def.ghi',
    JSON.stringify({ password: 'hunter 2' }),
    "token='quoted token value'",
    'ghp_abcdefghijklmnopqrstuvwxyz123456',
    'github_pat_abcdefghijklmnopqrstuvwxyz123456',
    'AKIAABCDEFGHIJKLMNOP',
    'eyJabcdefgh.ijklmnop.qrstuvwx',
    'cookie=session-cookie-value',
    'https://user:password@example.test/private',
    'sk-proj-abcdefghijklmnopqrstuvwxyz123456',
    'sk-abcdefghijklmnopqrstuvwxyz123456',
    'sk-ant-abcdefghijklmnopqrstuvwxyz123456',
    'xoxb-abcdefghijklmnopqrstuvwxyz123456',
    'npm_abcdefghijklmnopqrstuvwxyz123456',
    'glpat-abcdefghijklmnopqrstuvwxyz123456',
    'AIzaabc-def_ghijklmnopqrstuvwxyz123456',
    ['sk', 'live', 'abcdefghijklmnopqrstuvwxyz123456'].join('_'),
    'Authorization: Basic dXNlcjpwYXNzd29yZA==',
    '-----BEGIN PRIVATE KEY-----\ntruncated-private-material'
  ];
  const child = fakeChild([values.join('\n') + '\n' + 'x'.repeat(70000)]);
  const result = await policy.collectChild(child, {
    timeout_ms: 1000,
    max_output_bytes: policy.MAX_OUTPUT_BYTES
  });
  assert.equal(result.output_limit, true);
  assert.ok(Buffer.byteLength(result.output) <= policy.MAX_OUTPUT_BYTES);
  assert.equal(result.bytes, Buffer.byteLength(result.output));
  assert.doesNotMatch(result.output,
    /abc\.def\.ghi|hunter 2|quoted token value|ghp_|github_pat_|AKIA|eyJabcdefgh|session-cookie-value|user:password|sk-proj-|sk-ant-|sk-abc|xoxb-|npm_|glpat-|AIza|sk_live_|dXNlcjpwYXNzd29yZA|truncated-private-material/);
  assert.match(result.output, /\[REDACTED/);
});

test('debug redaction handles escaped, unterminated, and whitespace secrets fail closed', () => {
  const escaped = policy.redactOutput(
    '{\\"password\\":\\"hunter 2\\",\\"token\\":\\"abc\\\\\\"def\\"}'
  );
  assert.doesNotMatch(escaped, /hunter 2|abc|def/);
  const unterminated = policy.redactOutput('visible\npassword="hunter 2');
  assert.match(unterminated, /^visible\npassword="\[REDACTED\]$/);
  assert.doesNotMatch(unterminated, /hunter| 2/);
  const unquoted = policy.redactOutput('password=hunter 2\nvisible diagnostic');
  assert.equal(unquoted, 'password=[REDACTED]\nvisible diagnostic');
});

test('debug redaction covers separated API key labels and preserves boundaries', () => {
  const cases = [
    ['API Key: arbitrary-sensitive-value', 'API Key: [REDACTED]'],
    ['api-key=hyphen-sensitive-value', 'api-key=[REDACTED]'],
    ['X-API-Key: header-sensitive-value', 'X-API-Key: [REDACTED]'],
    ['{"api-key":"json-sensitive-value","status":"ok"}',
      '{"api-key":"[REDACTED]","status":"ok"}'],
    ['before\nX-API-Key: line-sensitive-value\nafter',
      'before\nX-API-Key: [REDACTED]\nafter']
  ];
  for (const [input, expected] of cases) {
    assert.equal(policy.redactOutput(input), expected);
  }
  for (const diagnostic of [
    'capillary key=benign',
    'notapi key: diagnostic',
    'API response missing key: diagnostic'
  ]) {
    assert.equal(policy.redactOutput(diagnostic), diagnostic);
  }
});

test('debug redaction preserves diagnostics around complete private-key blocks', () => {
  const output = policy.redactOutput([
    'before',
    '-----BEGIN PRIVATE KEY-----',
    'first-private-material',
    '-----END PRIVATE KEY-----',
    'visible diagnostic',
    '-----BEGIN EC PRIVATE KEY-----',
    'second-private-material',
    '-----END EC PRIVATE KEY-----',
    'between',
    '-----BEGIN PGP PRIVATE KEY BLOCK-----',
    'third-private-material',
    '-----END PGP PRIVATE KEY BLOCK-----',
    'after'
  ].join('\n'));
  assert.equal((output.match(/\[REDACTED_PRIVATE_KEY\]/g) || []).length, 3);
  assert.match(output, /before\n\[REDACTED_PRIVATE_KEY\]\nvisible diagnostic\n\[REDACTED_PRIVATE_KEY\]\nbetween\n\[REDACTED_PRIVATE_KEY\]\nafter/);
  assert.doesNotMatch(output, /private-material/);
  assert.equal(policy.redactOutput(
    'before\n-----BEGIN PGP PRIVATE KEY BLOCK-----\ntruncated-pgp-material'
  ), 'before\n[REDACTED_PRIVATE_KEY]');
});

test('debug redaction preserves benign token-like diagnostic filenames', () => {
  const diagnostics = [
    'scripts/npm_config.js',
    'docs/sk-proj-placeholder.md',
    'fixtures/xoxb-example.txt',
    'AIza-short-placeholder'
  ].join('\n');
  assert.equal(policy.redactOutput(diagnostics), diagnostics);
});

test('debug output boundary redacts partial standalone and quoted credentials', () => {
  const standalone = policy.boundedOutput(
    'x'.repeat(policy.MAX_OUTPUT_BYTES - 12) + 'sk-proj-secret-tail'
  );
  assert.doesNotMatch(standalone.output, /sk-proj-|secret/);
  const quoted = policy.boundedOutput(
    'x'.repeat(policy.MAX_OUTPUT_BYTES - 20) + 'password="hunter 2 beyond-limit'
  );
  assert.doesNotMatch(quoted.output, /hunter|beyond|password="h/);
  assert.ok(standalone.bytes <= policy.MAX_OUTPUT_BYTES);
  assert.ok(quoted.bytes <= policy.MAX_OUTPUT_BYTES);
});

test('debug collector redacts every credential family split at the capture boundary', async () => {
  const prefixes = [
    'ghp_', 'github_pat_', 'AKIA', 'sk-proj-', 'sk-ant-', 'sk-', 'xoxb-',
    'npm_', 'glpat-', 'AIza', 'sk_live_', 'eyJ'
  ];
  assert.equal(prefixes.length, 12);
  for (const prefix of prefixes) {
    const padding = 'z'.repeat(policy.MAX_OUTPUT_BYTES - prefix.length);
    const child = fakeChild([padding + prefix + 'secret-tail-material']);
    const result = await policy.collectChild(child, {
      timeout_ms: 1000,
      max_output_bytes: policy.MAX_OUTPUT_BYTES
    });
    assert.equal(result.output_limit, true, prefix);
    assert.doesNotMatch(result.output, new RegExp(prefix.replace(/[-]/g, '\\-')), prefix);
    assert.doesNotMatch(result.output, /secret-tail-material/, prefix);
    assert.ok(result.bytes <= policy.MAX_OUTPUT_BYTES, prefix);
  }
});

test('debug collector redacts credentialed URLs cut across authority fields', async () => {
  const visibleTails = [
    'https://u',
    'https://user:',
    'https://user:pass',
    'https://' + 'u'.repeat(700),
    'https://' + 'u'.repeat(600) + ':',
    'https://' + 'u'.repeat(300) + ':' + 'p'.repeat(600),
    'https://alice:' + 'p'.repeat(600) + '://nested'
  ];
  assert.equal(visibleTails.length, 7);
  for (const visibleTail of visibleTails) {
    const paddingLength = policy.MAX_OUTPUT_BYTES + 1 - visibleTail.length;
    const padding = 'z'.repeat(paddingLength - 1) + '\n';
    const child = fakeChild([padding + visibleTail + '@example.test/private']);
    const result = await policy.collectChild(child, {
      timeout_ms: 1000,
      max_output_bytes: policy.MAX_OUTPUT_BYTES
    });
    assert.equal(result.output_limit, true, visibleTail);
    assert.doesNotMatch(result.output, /https:\/\/u|user|pass|alice/, visibleTail);
    assert.doesNotMatch(result.output, /u{20}|p{20}/, visibleTail);
    if (visibleTail.length > 512) {
      assert.match(result.output, /\[REDACTED_TRUNCATED_URL\]/, visibleTail);
    }
    assert.ok(result.bytes <= policy.MAX_OUTPUT_BYTES, visibleTail);
  }
});

test('debug output truncation preserves the UTF-8 byte ceiling', () => {
  const input = 'x'.repeat(policy.MAX_OUTPUT_BYTES - 1) + '€';
  const result = policy.boundedOutput(input);
  assert.equal(result.truncated, true);
  assert.equal(result.bytes, policy.MAX_OUTPUT_BYTES - 1);
  assert.equal(Buffer.byteLength(result.output), result.bytes);
  assert.doesNotMatch(result.output, /�/);
});
