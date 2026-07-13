#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const PLUGIN_NAME = 'sd0x-dev-flow-codex';
const MARKETPLACE_NAME = 'sd0xdev-marketplace';
const REPOSITORY_URL = 'https://github.com/sd0xdev/sd0x-dev-flow-codex';
const PLUGIN_RELATIVE = `plugin/${PLUGIN_NAME}`;
const SEMVER_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function replaceFilesTransaction(entries, hooks = {}) {
  const transaction = crypto.randomUUID();
  const prepared = entries.map((entry, index) => ({
    ...entry,
    prior: fs.readFileSync(entry.path),
    temporary: `${entry.path}.${process.pid}.${transaction}.${index}.tmp`
  }));
  let installed = 0;
  try {
    for (const entry of prepared) {
      fs.writeFileSync(entry.temporary, entry.bytes, { flag: 'wx' });
    }
    for (const [index, entry] of prepared.entries()) {
      if (typeof hooks.beforeInstall === 'function') {
        hooks.beforeInstall({ index, path: entry.path });
      }
      fs.renameSync(entry.temporary, entry.path);
      installed += 1;
    }
  } catch (error) {
    let rollbackError = null;
    const rollbackArtifacts = [];
    for (let index = installed - 1; index >= 0; index -= 1) {
      const entry = prepared[index];
      const rollback = `${entry.path}.${process.pid}.${transaction}.${index}.rollback`;
      try {
        fs.writeFileSync(rollback, entry.prior, { flag: 'wx' });
        if (typeof hooks.beforeRollbackInstall === 'function') {
          hooks.beforeRollbackInstall({ index, path: entry.path, rollback });
        }
        fs.renameSync(rollback, entry.path);
      } catch (failure) {
        rollbackError ||= failure;
        if (fs.existsSync(rollback)) rollbackArtifacts.push(rollback);
      }
    }
    if (rollbackError) {
      throw new Error(
        `${error.message}; version rollback failed: ${rollbackError.message}; ` +
        `prior bytes retained at: ${rollbackArtifacts.join(', ') || 'unavailable'}`
      );
    }
    throw error;
  } finally {
    for (const entry of prepared) fs.rmSync(entry.temporary, { force: true });
  }
}

function releasePaths(root = ROOT) {
  const pluginRoot = path.join(root, ...PLUGIN_RELATIVE.split('/'));
  return {
    root,
    packagePath: path.join(root, 'package.json'),
    marketplacePath: path.join(root, '.agents', 'plugins', 'marketplace.json'),
    migrationGuidePath: path.join(root, 'docs', 'PROJECT-MIGRATION-GUIDE.md'),
    pluginRoot,
    manifestPath: path.join(pluginRoot, '.codex-plugin', 'plugin.json')
  };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function parseVersion(version) {
  const match = typeof version === 'string' && SEMVER_PATTERN.exec(version);
  assert(match, 'version must be valid SemVer');
  return {
    version,
    prerelease: match[4] || null,
    build: match[5] || null
  };
}

function expectedReleaseAssets(version) {
  parseVersion(version);
  const basename = `${PLUGIN_NAME}-${version}`;
  return [`${basename}.tar.gz`, `${basename}.zip`, 'SHA256SUMS'];
}

function releasePlan(options) {
  const {
    version,
    tagExists = false,
    payloadChanged = false,
    releaseExists = false,
    releaseDraft = false,
    assetNames = []
  } = options;
  const parsed = parseVersion(version);
  assert(Array.isArray(assetNames), 'release asset names must be an array');
  assert(!releaseExists || tagExists, 'a GitHub release cannot exist without its tag');
  assert(!releaseDraft || releaseExists, 'a draft state requires an existing GitHub release');
  if (tagExists && payloadChanged) {
    throw new Error(
      `v${version} already exists but the release payload changed; bump the version`
    );
  }

  const expectedAssets = expectedReleaseAssets(version);
  const existingAssets = new Set(assetNames);
  const missingAssets = expectedAssets.filter((name) => !existingAssets.has(name));
  const presentAssets = expectedAssets.filter((name) => existingAssets.has(name));
  let action = 'create';
  if (tagExists && !releaseExists) action = 'create-existing-tag';
  else if (releaseDraft && missingAssets.length > 0) action = 'upload-publish';
  else if (releaseDraft) action = 'publish';
  else if (tagExists && missingAssets.length > 0) action = 'upload';
  else if (tagExists) action = 'verify';

  return {
    version,
    tag: `v${version}`,
    prerelease: parsed.prerelease !== null,
    latest: parsed.prerelease === null,
    action,
    expectedAssets,
    missingAssets,
    presentAssets
  };
}

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function runGit(root, args) {
  const result = spawnSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true
  });
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || 'git command failed').trim());
  }
  return result.stdout.trim();
}

function buildReleaseArchives(options) {
  const {
    root = ROOT,
    version,
    revision = 'HEAD',
    outputDirectory
  } = options;
  parseVersion(version);
  assert(typeof outputDirectory === 'string' && outputDirectory.length > 0,
    'release output directory is required');
  const outputRoot = path.resolve(root, outputDirectory);
  fs.mkdirSync(outputRoot, { recursive: true });
  const expected = expectedReleaseAssets(version);
  const commit = runGit(root, ['rev-parse', '--verify', `${revision}^{commit}`]);
  const commitTime = runGit(root, ['show', '-s', '--format=%cI', commit]);
  assert(commit.length > 0 && commitTime.length > 0,
    `release revision is not a commit: ${revision}`);
  const treeish = `${commit}:plugin/${PLUGIN_NAME}`;
  const formats = [
    ['tar.gz', expected[0]],
    ['zip', expected[1]]
  ];

  for (const [format, filename] of formats) {
    runGit(root, [
      'archive',
      `--format=${format}`,
      `--prefix=${PLUGIN_NAME}/`,
      `--mtime=${commitTime}`,
      `--output=${path.join(outputRoot, filename)}`,
      treeish
    ]);
  }

  const checksumPath = path.join(outputRoot, expected[2]);
  const checksumBody = expected.slice(0, 2)
    .map((filename) => `${sha256(path.join(outputRoot, filename))}  ${filename}`)
    .join('\n');
  fs.writeFileSync(checksumPath, `${checksumBody}\n`);
  return {
    version,
    revision,
    commit,
    commitTime,
    outputDirectory: outputRoot,
    assets: expected.map((filename) => ({
      filename,
      sha256: sha256(path.join(outputRoot, filename))
    }))
  };
}

function verifyReleaseAssets(options) {
  const {
    version,
    builtDirectory,
    existingDirectory,
    assetNames
  } = options;
  const allowed = new Set(expectedReleaseAssets(version));
  assert(Array.isArray(assetNames), 'release asset names must be an array');
  const verified = [];
  for (const filename of assetNames) {
    assert(allowed.has(filename), `unexpected release asset: ${filename}`);
    const builtPath = path.resolve(builtDirectory, filename);
    const existingPath = path.resolve(existingDirectory, filename);
    assert(fs.existsSync(builtPath), `built release asset is missing: ${filename}`);
    assert(fs.existsSync(existingPath), `existing release asset is missing: ${filename}`);
    const builtHash = sha256(builtPath);
    const existingHash = sha256(existingPath);
    assert(builtHash === existingHash,
      `existing release asset differs from reproducible build: ${filename}`);
    verified.push({ filename, sha256: builtHash });
  }
  return { verified };
}

function assertRelativePayloadPath(pluginRoot, value, field) {
  assert(typeof value === 'string' && value.length > 0, `manifest ${field} is required`);
  const resolved = path.resolve(pluginRoot, value);
  assert(
    resolved === pluginRoot || resolved.startsWith(`${pluginRoot}${path.sep}`),
    `manifest ${field} escapes the plugin payload`
  );
  assert(fs.existsSync(resolved), `manifest ${field} does not exist: ${value}`);
}

function symbolicLinks(directory) {
  const links = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) links.push(absolute);
    else if (entry.isDirectory()) links.push(...symbolicLinks(absolute));
  }
  return links;
}

function checkRelease(root = ROOT) {
  const paths = releasePaths(root);
  const packageJson = readJson(paths.packagePath);
  const marketplace = readJson(paths.marketplacePath);
  const manifest = readJson(paths.manifestPath);

  assert(SEMVER_PATTERN.test(packageJson.version), 'package.json version must be valid SemVer');
  assert(packageJson.private === true, 'the repository package must remain private');
  assert(manifest.name === PLUGIN_NAME, `manifest name must be ${PLUGIN_NAME}`);
  assert(manifest.version === packageJson.version, 'package and plugin versions must match');
  assert(manifest.repository === REPOSITORY_URL, `manifest repository must be ${REPOSITORY_URL}`);
  assert(manifest.homepage === REPOSITORY_URL, `manifest homepage must be ${REPOSITORY_URL}`);
  assert(manifest.interface?.websiteURL === REPOSITORY_URL, `manifest websiteURL must be ${REPOSITORY_URL}`);
  assert(
    typeof manifest.interface?.longDescription === 'string' &&
      /Codex-first review/i.test(manifest.interface.longDescription) &&
      /optional Claude MCP/i.test(manifest.interface.longDescription),
    'manifest longDescription must describe Codex-first review and optional Claude MCP'
  );
  assert(marketplace.name === MARKETPLACE_NAME, `marketplace name must be ${MARKETPLACE_NAME}`);

  const entries = marketplace.plugins.filter((entry) => entry.name === PLUGIN_NAME);
  assert(entries.length === 1, `marketplace must contain exactly one ${PLUGIN_NAME} entry`);
  const entry = entries[0];
  assert(entry.source?.source === 'local', 'marketplace plugin source must be local');
  assert(entry.source.path === `./${PLUGIN_RELATIVE}`, `marketplace path must be ./${PLUGIN_RELATIVE}`);
  assert(entry.policy?.installation === 'AVAILABLE', 'marketplace plugin must be installable');

  assertRelativePayloadPath(paths.pluginRoot, manifest.skills, 'skills');
  assertRelativePayloadPath(paths.pluginRoot, manifest.mcpServers, 'mcpServers');
  assertRelativePayloadPath(paths.pluginRoot, './hooks/hooks.json', 'hooks');
  assert(fs.existsSync(path.join(paths.pluginRoot, 'LICENSE')), 'plugin payload must include LICENSE');

  const links = symbolicLinks(paths.pluginRoot);
  assert(links.length === 0, `plugin payload must not contain symbolic links: ${links.join(', ')}`);

  return {
    version: packageJson.version,
    tag: `v${packageJson.version}`,
    marketplace: MARKETPLACE_NAME,
    selector: `${PLUGIN_NAME}@${MARKETPLACE_NAME}`,
    pluginRoot: paths.pluginRoot
  };
}

function setVersion(version, root = ROOT, hooks = {}) {
  parseVersion(version);
  const paths = releasePaths(root);
  const packageJson = readJson(paths.packagePath);
  const manifest = readJson(paths.manifestPath);
  const migrationGuide = fs.readFileSync(paths.migrationGuidePath, 'utf8');
  const documentedVersion =
    /> Codex 版本：`sd0x-dev-flow-codex` `([^`]+)`/;
  assert(documentedVersion.test(migrationGuide),
    'migration guide must contain the documented Codex version');
  packageJson.version = version;
  manifest.version = version;
  const updatedGuide = migrationGuide.replace(
    documentedVersion,
    `> Codex 版本：\`sd0x-dev-flow-codex\` \`${version}\``
  );
  replaceFilesTransaction([
    {
      path: paths.packagePath,
      bytes: `${JSON.stringify(packageJson, null, 2)}\n`
    },
    {
      path: paths.manifestPath,
      bytes: `${JSON.stringify(manifest, null, 2)}\n`
    },
    { path: paths.migrationGuidePath, bytes: updatedGuide }
  ], hooks);
  return checkRelease(root);
}

function main(argv = process.argv.slice(2)) {
  const [command, ...args] = argv;
  const [value] = args;
  if (command === 'check' && value === undefined) {
    process.stdout.write(`${JSON.stringify(checkRelease(), null, 2)}\n`);
    return;
  }
  if (command === 'set-version' && args.length === 1) {
    process.stdout.write(`${JSON.stringify(setVersion(value), null, 2)}\n`);
    return;
  }
  if (command === 'plan' && value === undefined) {
    const current = checkRelease();
    const assets = JSON.parse(process.env.SD0X_RELEASE_ASSETS_JSON || '[]');
    const plan = releasePlan({
      version: current.version,
      tagExists: process.env.SD0X_RELEASE_TAG_EXISTS === 'true',
      payloadChanged: process.env.SD0X_RELEASE_PAYLOAD_CHANGED === 'true',
      releaseExists: process.env.SD0X_RELEASE_EXISTS === 'true',
      releaseDraft: process.env.SD0X_RELEASE_DRAFT === 'true',
      assetNames: assets
    });
    process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
    return;
  }
  if (command === 'build' && (args.length === 1 || args.length === 2)) {
    const current = checkRelease();
    const result = buildReleaseArchives({
      version: current.version,
      outputDirectory: value,
      revision: args[1] || 'HEAD'
    });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  if (command === 'verify-assets' && args.length === 2) {
    const current = checkRelease();
    const result = verifyReleaseAssets({
      version: current.version,
      builtDirectory: path.resolve(value),
      existingDirectory: path.resolve(args[1]),
      assetNames: JSON.parse(process.env.SD0X_RELEASE_ASSETS_JSON || '[]')
    });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  throw new Error(
    'usage: node scripts/release.js <check|plan|build OUTPUT_DIR [REVISION]|verify-assets BUILT_DIR EXISTING_DIR|set-version VERSION>'
  );
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`release: ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  MARKETPLACE_NAME,
  PLUGIN_NAME,
  REPOSITORY_URL,
  SEMVER_PATTERN,
  buildReleaseArchives,
  checkRelease,
  expectedReleaseAssets,
  main,
  parseVersion,
  releasePlan,
  releasePaths,
  setVersion,
  symbolicLinks,
  verifyReleaseAssets
};
