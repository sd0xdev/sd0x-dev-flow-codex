'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  expectedCachePath,
  inspectLink,
  link,
  replaceSnapshotWithOverlay,
  resolveRuntime,
  runCodex,
  WINDOWS_CODEX_LAUNCHER,
  unlink
} = require('../scripts/dev-plugin');

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-dev-link-'));
  const codexHome = path.join(root, 'codex-home');
  const installedPath = path.join(
    codexHome,
    'plugins',
    'cache',
    'market',
    'plugin',
    '0.1.0'
  );
  const sourcePath = path.join(root, 'source');
  const backupRoot = path.join(codexHome, 'plugins', 'dev-backups', 'plugin');
  fs.mkdirSync(installedPath, { recursive: true });
  fs.mkdirSync(sourcePath, { recursive: true });
  fs.mkdirSync(path.join(installedPath, '.codex-plugin'));
  fs.mkdirSync(path.join(sourcePath, '.codex-plugin'));
  fs.mkdirSync(path.join(installedPath, 'skills', 'example'), { recursive: true });
  fs.mkdirSync(path.join(sourcePath, 'skills', 'example'), { recursive: true });
  fs.writeFileSync(
    path.join(installedPath, '.codex-plugin', 'plugin.json'),
    '{"version":"snapshot"}\n'
  );
  fs.writeFileSync(
    path.join(sourcePath, '.codex-plugin', 'plugin.json'),
    '{"version":"source"}\n'
  );
  fs.writeFileSync(path.join(installedPath, 'origin.txt'), 'snapshot\n');
  fs.writeFileSync(path.join(sourcePath, 'live.txt'), 'source\n');
  fs.writeFileSync(
    path.join(installedPath, 'skills', 'example', 'SKILL.md'),
    'snapshot skill\n'
  );
  fs.writeFileSync(
    path.join(sourcePath, 'skills', 'example', 'SKILL.md'),
    'source skill\n'
  );
  return { root, codexHome, installedPath, sourcePath, backupRoot };
}

test('replaces an installed snapshot with a loader-safe symlink overlay', (t) => {
  const values = fixture();
  t.after(() => fs.rmSync(values.root, { recursive: true, force: true }));
  const result = replaceSnapshotWithOverlay({
    ...values,
    date: new Date('2026-07-10T00:00:00.000Z')
  });

  assert.equal(fs.lstatSync(values.installedPath).isDirectory(), true);
  assert.equal(fs.lstatSync(path.join(values.installedPath, 'live.txt')).isSymbolicLink(), true);
  assert.equal(
    fs.lstatSync(path.join(values.installedPath, '.codex-plugin', 'plugin.json')).isSymbolicLink(),
    false
  );
  assert.equal(
    fs.lstatSync(
      path.join(values.installedPath, 'skills', 'example', 'SKILL.md')
    ).isSymbolicLink(),
    false
  );
  assert.match(
    fs.readFileSync(path.join(values.installedPath, '.codex-plugin', 'plugin.json'), 'utf8'),
    /snapshot/
  );
  assert.equal(fs.readFileSync(path.join(values.installedPath, 'live.txt'), 'utf8'), 'source\n');
  assert.equal(
    fs.readFileSync(
      path.join(values.installedPath, 'skills', 'example', 'SKILL.md'),
      'utf8'
    ),
    'snapshot skill\n'
  );
  assert.equal(result.marker.copied_files, 2);
  assert.equal(fs.readFileSync(path.join(result.backupPath, 'origin.txt'), 'utf8'), 'snapshot\n');
  assert.equal(inspectLink(values.installedPath, values.sourcePath).state, 'linked');
});

test('linking the same source is idempotent', (t) => {
  const values = fixture();
  t.after(() => fs.rmSync(values.root, { recursive: true, force: true }));
  replaceSnapshotWithOverlay(values);
  const result = replaceSnapshotWithOverlay(values);
  assert.equal(result.state, 'linked');
  assert.equal(result.backupPath, null);
});

test('refuses to replace a symlink owned by another source', (t) => {
  const values = fixture();
  t.after(() => fs.rmSync(values.root, { recursive: true, force: true }));
  const foreign = path.join(values.root, 'foreign');
  fs.mkdirSync(foreign);
  fs.rmSync(values.installedPath, { recursive: true });
  fs.symlinkSync(foreign, values.installedPath, 'dir');
  assert.throws(
    () => replaceSnapshotWithOverlay(values),
    /foreign symlink/
  );
  assert.equal(fs.realpathSync(values.installedPath), fs.realpathSync(foreign));
});

test('reports a missing cache path without requiring its parent', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-dev-link-missing-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const result = inspectLink(
    path.join(root, 'missing', 'plugin', '0.1.0'),
    path.join(root, 'source')
  );
  assert.equal(result.state, 'missing');
});

test('local-home mode keeps Codex state under the repository', () => {
  const root = '/tmp/example-plugin';
  const runtime = resolveRuntime(
    ['link', '--local-home'],
    { CODEX_HOME: '/tmp/global-codex' },
    root
  );
  assert.deepEqual(runtime.argv, ['link']);
  assert.equal(runtime.localHome, true);
  assert.equal(runtime.env.CODEX_HOME, path.join(root, '.codex-dev-home'));
});

test('Codex CLI preserves Windows arguments through a shell-free launcher', () => {
  let observed;
  const originalArgs = [
    'plugin', 'marketplace', 'add', 'C:\\Project & Tools\\repo path', '--json'
  ];
  const output = runCodex(originalArgs, {}, (command, args, options) => {
    observed = { command, args, options };
    return { status: 0, stdout: 'ok\n', stderr: '' };
  }, 'win32');
  assert.equal(output, 'ok');
  assert.equal(observed.command, 'powershell.exe');
  assert.deepEqual(observed.args, [
    '-NoLogo', '-NoProfile', '-NonInteractive', '-Command', WINDOWS_CODEX_LAUNCHER
  ]);
  assert.equal(observed.options.shell, false);
  assert.deepEqual(
    JSON.parse(Buffer.from(
      observed.options.env.SD0X_CODEX_ARGS_BASE64,
      'base64'
    ).toString('utf8')),
    originalArgs
  );
  assert.equal(observed.args.join(' ').includes('repo path'), false);
});

test('isolated CODEX_HOME link and unlink exercise the install path', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-dev-install-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const codexHome = path.join(root, 'codex-home');
  const pluginRoot = path.join(root, 'plugin');
  const metadata = {
    root,
    pluginRoot,
    pluginName: 'plugin',
    version: '0.1.0',
    marketplaceName: 'market',
    selector: 'plugin@market'
  };
  fs.mkdirSync(path.join(pluginRoot, '.codex-plugin'), { recursive: true });
  fs.mkdirSync(path.join(pluginRoot, 'skills', 'example'), { recursive: true });
  fs.writeFileSync(
    path.join(pluginRoot, '.codex-plugin', 'plugin.json'),
    JSON.stringify({ name: 'plugin', version: '0.1.0' })
  );
  fs.writeFileSync(
    path.join(pluginRoot, 'skills', 'example', 'SKILL.md'),
    '# Example\n'
  );
  fs.writeFileSync(path.join(pluginRoot, 'runtime.js'), 'module.exports = true;\n');

  const calls = [];
  const runCodex = (args, env) => {
    calls.push({ args, codexHome: env.CODEX_HOME });
    if (args[1] === 'marketplace') return '{}';
    const installedPath = expectedCachePath(metadata, env.CODEX_HOME);
    fs.rmSync(installedPath, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(installedPath), { recursive: true });
    fs.cpSync(pluginRoot, installedPath, { recursive: true });
    return JSON.stringify({ installedPath });
  };
  const env = { ...process.env, CODEX_HOME: codexHome };

  const linked = link(metadata, env, { runCodex });
  assert.equal(linked.state, 'linked');
  assert.equal(linked.installedPath, expectedCachePath(metadata, codexHome));
  assert.equal(
    fs.lstatSync(path.join(linked.installedPath, 'runtime.js')).isSymbolicLink(),
    true
  );
  assert.equal(
    fs.lstatSync(
      path.join(linked.installedPath, 'skills', 'example', 'SKILL.md')
    ).isSymbolicLink(),
    false
  );

  const restored = unlink(metadata, env, { runCodex });
  assert.equal(restored.state, 'snapshot');
  assert.equal(
    fs.lstatSync(path.join(restored.installedPath, 'runtime.js')).isSymbolicLink(),
    false
  );
  assert.deepEqual(calls.map((item) => item.codexHome), [
    codexHome,
    codexHome,
    codexHome,
    codexHome
  ]);
});

test('link refuses an installer path for another cached plugin', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-dev-mismatch-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const codexHome = path.join(root, 'codex-home');
  const pluginRoot = path.join(root, 'plugin');
  const metadata = {
    root,
    pluginRoot,
    pluginName: 'plugin',
    version: '0.1.0',
    marketplaceName: 'market',
    selector: 'plugin@market'
  };
  fs.mkdirSync(path.join(pluginRoot, '.codex-plugin'), { recursive: true });
  fs.writeFileSync(
    path.join(pluginRoot, '.codex-plugin', 'plugin.json'),
    JSON.stringify({ name: 'plugin', version: '0.1.0' })
  );
  fs.writeFileSync(path.join(pluginRoot, 'runtime.js'), 'source\n');
  const wrongPath = path.join(
    codexHome,
    'plugins',
    'cache',
    'market',
    'another-plugin',
    '0.1.0'
  );
  const runCodex = (args) => {
    if (args[1] === 'marketplace') return '{}';
    fs.mkdirSync(wrongPath, { recursive: true });
    fs.writeFileSync(path.join(wrongPath, 'snapshot.txt'), 'keep\n');
    return JSON.stringify({ installedPath: wrongPath });
  };

  assert.throws(
    () => link(
      metadata,
      { ...process.env, CODEX_HOME: codexHome },
      { runCodex }
    ),
    /unexpected plugin cache path/
  );
  assert.equal(
    fs.readFileSync(path.join(wrongPath, 'snapshot.txt'), 'utf8'),
    'keep\n'
  );
  assert.equal(fs.existsSync(path.join(wrongPath, '.sd0x-dev-link.json')), false);
});
