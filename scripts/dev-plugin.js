#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const DEV_MARKER = '.sd0x-dev-link.json';
const SNAPSHOT_FILES = new Set(['.codex-plugin/plugin.json', 'LICENSE']);
const WINDOWS_CODEX_LAUNCHER = [
  '$json=[Text.Encoding]::UTF8.GetString(',
  '[Convert]::FromBase64String($env:SD0X_CODEX_ARGS_BASE64));',
  '$arguments=@(ConvertFrom-Json -InputObject $json);',
  '& codex @arguments;',
  '$code=$LASTEXITCODE;',
  'if ($null -eq $code) { exit 127 };',
  'exit $code'
].join('');

function mustRemainRegular(portableRelative) {
  // Codex skill discovery ignores symlinked SKILL.md entrypoints.
  return SNAPSHOT_FILES.has(portableRelative) || path.posix.basename(portableRelative) === 'SKILL.md';
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function loadMetadata(root = path.resolve(__dirname, '..')) {
  const marketplacePath = path.join(root, '.agents', 'plugins', 'marketplace.json');
  const marketplace = readJson(marketplacePath);
  const entry = marketplace.plugins.find((item) =>
    item.name === 'sd0x-dev-flow-codex'
  );
  if (!entry || entry.source?.source !== 'local') {
    throw new Error('Local sd0x-dev-flow-codex marketplace entry not found');
  }

  const pluginRoot = path.resolve(root, entry.source.path);
  const manifest = readJson(path.join(pluginRoot, '.codex-plugin', 'plugin.json'));
  if (manifest.name !== entry.name || !manifest.version) {
    throw new Error('Plugin manifest name/version does not match the marketplace entry');
  }

  return {
    root,
    pluginRoot,
    pluginName: entry.name,
    version: manifest.version,
    marketplaceName: marketplace.name,
    selector: `${entry.name}@${marketplace.name}`
  };
}

function getCodexHome(env = process.env) {
  return path.resolve(env.CODEX_HOME || path.join(os.homedir(), '.codex'));
}

function resolveRuntime(argv, env, root) {
  const localHome = argv.includes('--local-home');
  return {
    argv: argv.filter((item) => item !== '--local-home'),
    env: localHome
      ? { ...env, CODEX_HOME: path.join(root, '.codex-dev-home') }
      : env,
    localHome
  };
}

function expectedCachePath(metadata, codexHome) {
  return path.join(
    codexHome,
    'plugins',
    'cache',
    metadata.marketplaceName,
    metadata.pluginName,
    metadata.version
  );
}

function resolvedLinkTarget(linkPath) {
  const target = fs.readlinkSync(linkPath);
  return path.resolve(path.dirname(linkPath), target);
}

function samePath(left, right) {
  try {
    return fs.realpathSync(left) === fs.realpathSync(right);
  } catch {
    return path.resolve(left) === path.resolve(right);
  }
}

function inspectLink(installedPath, sourcePath) {
  let stats;
  try {
    stats = fs.lstatSync(installedPath);
  } catch (error) {
    if (error.code === 'ENOENT') return { state: 'missing', installedPath, sourcePath };
    throw error;
  }
  if (stats.isSymbolicLink()) {
    const target = resolvedLinkTarget(installedPath);
    return {
      state: samePath(target, sourcePath) ? 'legacy-root-link' : 'foreign-link',
      installedPath,
      sourcePath,
      target
    };
  }
  const markerPath = path.join(installedPath, DEV_MARKER);
  if (!fs.existsSync(markerPath)) {
    return { state: 'snapshot', installedPath, sourcePath };
  }
  const marker = readJson(markerPath);
  return marker.schema_version === 1 && samePath(marker.source_path, sourcePath)
    ? { state: 'linked', installedPath, sourcePath, marker }
    : {
        state: 'foreign-link',
        installedPath,
        sourcePath,
        target: marker.source_path || markerPath
      };
}

function assertCacheDestination(installedPath, codexHome) {
  const cacheRoot = path.join(codexHome, 'plugins', 'cache');
  if (!fs.existsSync(cacheRoot)) throw new Error(`Codex cache does not exist: ${cacheRoot}`);
  const realCache = fs.realpathSync(cacheRoot);
  const realParent = fs.realpathSync(path.dirname(installedPath));
  const candidate = path.join(realParent, path.basename(installedPath));
  if (candidate !== realCache && !candidate.startsWith(`${realCache}${path.sep}`)) {
    throw new Error(`Refusing to modify path outside Codex cache: ${candidate}`);
  }
}

function timestamp(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

function createLinkedOverlay(sourcePath, installedPath, snapshotPath) {
  let linkedFiles = 0;
  let copiedFiles = 0;

  function walk(sourceDirectory, relativeDirectory = '') {
    const destinationDirectory = path.join(installedPath, relativeDirectory);
    fs.mkdirSync(destinationDirectory, { recursive: true });
    for (const entry of fs.readdirSync(sourceDirectory, { withFileTypes: true })) {
      const relative = path.join(relativeDirectory, entry.name);
      const source = path.join(sourceDirectory, entry.name);
      const destination = path.join(installedPath, relative);
      if (entry.isDirectory()) {
        walk(source, relative);
      } else if (entry.isFile()) {
        const portableRelative = relative.split(path.sep).join('/');
        if (mustRemainRegular(portableRelative)) {
          const snapshotFile = path.join(snapshotPath, relative);
          fs.copyFileSync(fs.existsSync(snapshotFile) ? snapshotFile : source, destination);
          copiedFiles += 1;
        } else {
          fs.symlinkSync(source, destination, 'file');
          linkedFiles += 1;
        }
      } else if (entry.isSymbolicLink()) {
        fs.symlinkSync(fs.readlinkSync(source), destination);
        linkedFiles += 1;
      }
    }
  }

  walk(sourcePath);
  return { copiedFiles, linkedFiles };
}

function replaceSnapshotWithOverlay(options) {
  const {
    installedPath,
    sourcePath,
    backupRoot,
    codexHome,
    date = new Date()
  } = options;
  const current = inspectLink(installedPath, sourcePath);
  if (current.state === 'linked') return { ...current, backupPath: null };
  if (current.state === 'foreign-link') {
    throw new Error(`Refusing to replace foreign symlink: ${current.target}`);
  }
  if (current.state !== 'snapshot') {
    throw new Error(`Installed plugin snapshot not found: ${installedPath}`);
  }

  assertCacheDestination(installedPath, codexHome);
  fs.mkdirSync(backupRoot, { recursive: true });
  const backupPath = path.join(
    backupRoot,
    `${timestamp(date)}-${path.basename(installedPath)}-${process.pid}`
  );
  fs.renameSync(installedPath, backupPath);
  try {
    const { copiedFiles, linkedFiles } = createLinkedOverlay(
      sourcePath,
      installedPath,
      backupPath
    );
    const marker = {
      schema_version: 1,
      source_path: sourcePath,
      backup_path: backupPath,
      copied_files: copiedFiles,
      linked_files: linkedFiles,
      created_at: date.toISOString()
    };
    fs.writeFileSync(
      path.join(installedPath, DEV_MARKER),
      `${JSON.stringify(marker, null, 2)}\n`
    );
  } catch (error) {
    fs.rmSync(installedPath, { recursive: true, force: true });
    fs.renameSync(backupPath, installedPath);
    throw error;
  }

  return {
    state: 'linked',
    installedPath,
    sourcePath,
    backupPath,
    marker: readJson(path.join(installedPath, DEV_MARKER))
  };
}

function runCodex(
  args,
  env = process.env,
  execute = spawnSync,
  platform = process.platform
) {
  const windows = platform === 'win32';
  const command = windows ? 'powershell.exe' : 'codex';
  const commandArgs = windows
    ? ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', WINDOWS_CODEX_LAUNCHER]
    : args;
  const commandEnv = windows
    ? {
        ...env,
        SD0X_CODEX_ARGS_BASE64: Buffer.from(JSON.stringify(args), 'utf8')
          .toString('base64')
      }
    : env;
  const result = execute(command, commandArgs, {
    encoding: 'utf8',
    env: commandEnv,
    maxBuffer: 16 * 1024 * 1024,
    windowsHide: true,
    shell: false
  });
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || 'codex command failed').trim());
  }
  return result.stdout.trim();
}

function installSnapshot(metadata, env = process.env, executeCodex = runCodex) {
  executeCodex(['plugin', 'marketplace', 'add', metadata.root, '--json'], env);
  const output = executeCodex(['plugin', 'add', metadata.selector, '--json'], env);
  return JSON.parse(output);
}

function assertExpectedInstall(installedPath, expectedPath) {
  if (typeof installedPath !== 'string' ||
      !samePath(installedPath, expectedPath)) {
    throw new Error(
      `Codex installed an unexpected plugin cache path: ${installedPath || 'missing'}`
    );
  }
}

function link(metadata, env = process.env, options = {}) {
  const codexHome = getCodexHome(env);
  fs.mkdirSync(codexHome, { recursive: true });
  const expected = expectedCachePath(metadata, codexHome);
  const current = inspectLink(expected, metadata.pluginRoot);
  if (current.state === 'linked') return { ...current, alreadyLinked: true };
  if (current.state === 'foreign-link') {
    throw new Error(`Refusing to replace foreign symlink: ${current.target}`);
  }

  const installed = installSnapshot(metadata, env, options.runCodex);
  assertExpectedInstall(installed.installedPath, expected);
  const backupRoot = path.join(
    codexHome,
    'plugins',
    'dev-backups',
    `${metadata.marketplaceName}--${metadata.pluginName}`
  );
  return replaceSnapshotWithOverlay({
    installedPath: installed.installedPath,
    sourcePath: metadata.pluginRoot,
    backupRoot,
    codexHome
  });
}

function unlink(metadata, env = process.env, options = {}) {
  const codexHome = getCodexHome(env);
  fs.mkdirSync(codexHome, { recursive: true });
  const expected = expectedCachePath(metadata, codexHome);
  const current = inspectLink(expected, metadata.pluginRoot);
  if (current.state === 'foreign-link') {
    throw new Error(`Refusing to replace foreign symlink: ${current.target}`);
  }
  const installed = installSnapshot(metadata, env, options.runCodex);
  assertExpectedInstall(installed.installedPath, expected);
  const after = inspectLink(installed.installedPath, metadata.pluginRoot);
  if (after.state !== 'snapshot') {
    throw new Error('Codex reinstall did not restore a regular plugin snapshot');
  }
  return after;
}

function main(argv = process.argv.slice(2), env = process.env) {
  const metadata = loadMetadata();
  const runtime = resolveRuntime(argv, env, metadata.root);
  const action = runtime.argv[0] || 'status';
  let result;
  if (action === 'link') result = link(metadata, runtime.env);
  else if (action === 'unlink') result = unlink(metadata, runtime.env);
  else if (action === 'status') {
    result = inspectLink(
      expectedCachePath(metadata, getCodexHome(runtime.env)),
      metadata.pluginRoot
    );
  } else {
    throw new Error('Usage: dev-plugin.js <link|status|unlink>');
  }
  process.stdout.write(`${JSON.stringify({
    action,
    localHome: runtime.localHome,
    codexHome: getCodexHome(runtime.env),
    ...result
  }, null, 2)}\n`);
  return 0;
}

if (require.main === module) {
  try {
    process.exitCode = main();
  } catch (error) {
    process.stderr.write(`sd0x dev plugin: ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  expectedCachePath,
  getCodexHome,
  inspectLink,
  link,
  loadMetadata,
  main,
  replaceSnapshotWithOverlay,
  resolveRuntime,
  runCodex,
  WINDOWS_CODEX_LAUNCHER,
  timestamp,
  unlink
};
