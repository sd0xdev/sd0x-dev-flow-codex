'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  MARKETPLACE_NAME,
  PLUGIN_NAME,
  REPOSITORY_URL,
  buildReleaseArchives,
  checkRelease,
  expectedReleaseAssets,
  releasePlan,
  setVersion,
  verifyReleaseAssets
} = require('../scripts/release');
const { commit, git, initRepository } = require('./helpers/git');

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-release-'));
  const pluginRoot = path.join(root, 'plugin', PLUGIN_NAME);
  writeJson(path.join(root, 'package.json'), {
    name: PLUGIN_NAME,
    version: '0.1.0',
    private: true
  });
  writeJson(path.join(root, '.agents', 'plugins', 'marketplace.json'), {
    name: MARKETPLACE_NAME,
    plugins: [{
      name: PLUGIN_NAME,
      source: { source: 'local', path: `./plugin/${PLUGIN_NAME}` },
      policy: { installation: 'AVAILABLE' }
    }]
  });
  writeJson(path.join(pluginRoot, '.codex-plugin', 'plugin.json'), {
    name: PLUGIN_NAME,
    version: '0.1.0',
    homepage: REPOSITORY_URL,
    repository: REPOSITORY_URL,
    skills: './skills/',
    mcpServers: './.mcp.json',
    interface: {
      websiteURL: REPOSITORY_URL,
      longDescription: 'Codex-first review with an optional Claude MCP primary.'
    }
  });
  writeJson(path.join(pluginRoot, '.mcp.json'), {});
  writeJson(path.join(pluginRoot, 'hooks', 'hooks.json'), {});
  fs.mkdirSync(path.join(pluginRoot, 'skills'), { recursive: true });
  fs.writeFileSync(path.join(pluginRoot, 'LICENSE'), 'MIT\n');
  return { root, pluginRoot };
}

test('current repository satisfies the public release contract', () => {
  const result = checkRelease();
  assert.equal(result.selector, `${PLUGIN_NAME}@${MARKETPLACE_NAME}`);
  assert.match(result.version, /^\d+\.\d+\.\d+/);
});

test('Node.js runtime requirements stay aligned across CI and the shipped plugin', () => {
  const root = path.resolve(__dirname, '..');
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const workflow = fs.readFileSync(path.join(root, '.github', 'workflows', 'ci.yml'), 'utf8');
  const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
  const agents = fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8');
  const migrationGuide = fs.readFileSync(
    path.join(root, 'docs', 'PROJECT-MIGRATION-GUIDE.md'),
    'utf8'
  );
  const doctorSource = fs.readFileSync(
    path.join(root, 'plugin', PLUGIN_NAME, 'scripts', 'runtime', 'cli.js'),
    'utf8'
  );

  assert.equal(packageJson.engines.node, '>=24.0.0');
  assert.equal(fs.readFileSync(path.join(root, '.nvmrc'), 'utf8').trim(), '24');
  assert.match(workflow, /node-version-file: \.nvmrc/);
  assert.doesNotMatch(workflow, /matrix\.node|node:\s*\[/);
  assert.equal(readme.match(/Node\.js 24 或更新版本/g)?.length, 2);
  assert.doesNotMatch(readme, /Node\.js (?:18|22)(?:\s|`|或)/);
  assert.match(agents, /Use Node\.js 24-compatible CommonJS/);
  assert.match(migrationGuide, /Node\.js `>=24` 與 npm/);
  assert.match(doctorSource, /check: 'node>=24'.*nodeMajor >= 24/);
});

test('version setter updates package and plugin manifest together', (t) => {
  const values = fixture();
  t.after(() => fs.rmSync(values.root, { recursive: true, force: true }));

  const result = setVersion('2.3.4-rc.1', values.root);
  assert.equal(result.tag, 'v2.3.4-rc.1');
  assert.equal(
    JSON.parse(fs.readFileSync(path.join(values.root, 'package.json'))).version,
    '2.3.4-rc.1'
  );
  assert.equal(
    JSON.parse(fs.readFileSync(
      path.join(values.pluginRoot, '.codex-plugin', 'plugin.json')
    )).version,
    '2.3.4-rc.1'
  );
});

test('release check rejects mismatched versions', (t) => {
  const values = fixture();
  t.after(() => fs.rmSync(values.root, { recursive: true, force: true }));
  const manifestPath = path.join(values.pluginRoot, '.codex-plugin', 'plugin.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath));
  manifest.version = '0.2.0';
  writeJson(manifestPath, manifest);
  assert.throws(() => checkRelease(values.root), /versions must match/);
});

test('release check rejects metadata that presents Claude as the fixed primary', (t) => {
  const values = fixture();
  t.after(() => fs.rmSync(values.root, { recursive: true, force: true }));
  const manifestPath = path.join(values.pluginRoot, '.codex-plugin', 'plugin.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath));
  manifest.interface.longDescription =
    'A harness that combines a Claude MCP primary review with Codex reviewers.';
  writeJson(manifestPath, manifest);

  assert.throws(
    () => checkRelease(values.root),
    /Codex-first review and optional Claude MCP/
  );
});

test('release check rejects symlinks in the distributable payload', (t) => {
  const values = fixture();
  t.after(() => fs.rmSync(values.root, { recursive: true, force: true }));
  const outside = path.join(values.root, 'outside.txt');
  fs.writeFileSync(outside, 'outside\n');
  fs.symlinkSync(outside, path.join(values.pluginRoot, 'linked.txt'));
  assert.throws(() => checkRelease(values.root), /must not contain symbolic links/);
});

test('release plan distinguishes stable releases from prereleases', () => {
  const stable = releasePlan({ version: '2.3.4' });
  assert.equal(stable.prerelease, false);
  assert.equal(stable.latest, true);

  const candidate = releasePlan({ version: '2.3.4-rc.1' });
  assert.equal(candidate.prerelease, true);
  assert.equal(candidate.latest, false);
  assert.deepEqual(candidate.expectedAssets, [
    'sd0x-dev-flow-codex-2.3.4-rc.1.tar.gz',
    'sd0x-dev-flow-codex-2.3.4-rc.1.zip',
    'SHA256SUMS'
  ]);
});

test('release plan repairs missing releases and partial assets', () => {
  const version = '2.3.4';
  const expected = expectedReleaseAssets(version);

  assert.equal(releasePlan({ version }).action, 'create');
  assert.equal(releasePlan({ version, tagExists: true }).action, 'create-existing-tag');

  const partial = releasePlan({
    version,
    tagExists: true,
    releaseExists: true,
    assetNames: expected.slice(0, 1)
  });
  assert.equal(partial.action, 'upload');
  assert.deepEqual(partial.missingAssets, expected.slice(1));

  const complete = releasePlan({
    version,
    tagExists: true,
    releaseExists: true,
    assetNames: expected
  });
  assert.equal(complete.action, 'verify');
  assert.deepEqual(complete.missingAssets, []);
  assert.deepEqual(complete.presentAssets, expected);
});

test('release plan repairs draft releases before publishing', () => {
  const version = '2.3.4';
  const expected = expectedReleaseAssets(version);
  const partial = releasePlan({
    version,
    tagExists: true,
    releaseExists: true,
    releaseDraft: true,
    assetNames: expected.slice(0, 1)
  });
  assert.equal(partial.action, 'upload-publish');
  assert.deepEqual(partial.presentAssets, expected.slice(0, 1));
  assert.deepEqual(partial.missingAssets, expected.slice(1));

  const complete = releasePlan({
    version,
    tagExists: true,
    releaseExists: true,
    releaseDraft: true,
    assetNames: expected
  });
  assert.equal(complete.action, 'publish');
});

test('first-release workflow creates the tag before release asset upload', () => {
  const workflow = fs.readFileSync(
    path.resolve(__dirname, '..', '.github', 'workflows', 'release.yml'),
    'utf8'
  );
  assert.match(
    workflow,
    /if \[ "\$ACTION" = 'create' \]; then\s+git tag "\$TAG" "\$GITHUB_SHA"\s+git push origin "refs\/tags\/\$\{TAG\}"\s+fi/
  );
  assert.match(workflow, /FLAGS=\(--title "\$TAG" --generate-notes --verify-tag\)/);

  const expected = expectedReleaseAssets('2.3.4');
  assert.equal(releasePlan({
    version: '2.3.4',
    tagExists: true,
    releaseExists: true,
    releaseDraft: true,
    assetNames: expected.slice(0, 1)
  }).action, 'upload-publish');
});

test('release workflow cannot publish from a non-main manual dispatch', () => {
  const workflow = fs.readFileSync(
    path.resolve(__dirname, '..', '.github', 'workflows', 'release.yml'),
    'utf8'
  );
  assert.match(
    workflow,
    /jobs:\s+release:\s+if: github\.ref == 'refs\/heads\/main'/
  );
});

test('release workflow verifies every complete existing release', () => {
  const workflow = fs.readFileSync(
    path.resolve(__dirname, '..', '.github', 'workflows', 'release.yml'),
    'utf8'
  );
  const expected = expectedReleaseAssets('2.3.4');
  assert.equal(releasePlan({
    version: '2.3.4',
    tagExists: true,
    releaseExists: true,
    assetNames: expected
  }).action, 'verify');
  assert.doesNotMatch(workflow, /Build release archives\s+if:/);
  assert.match(
    workflow,
    /Verify existing release assets\s+if: steps\.release\.outputs\.action == 'verify'/
  );
});

test('release plan rejects reuse of a tag for changed payload', () => {
  assert.throws(
    () => releasePlan({ version: '2.3.4', tagExists: true, payloadChanged: true }),
    /payload changed; bump the version/
  );
});

test('release recovery stays bound to a tagged commit after later commits', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-release-archive-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  initRepository(root);
  const payload = path.join(root, 'plugin', PLUGIN_NAME);
  fs.mkdirSync(path.join(payload, '.codex-plugin'), { recursive: true });
  fs.writeFileSync(path.join(payload, '.codex-plugin', 'plugin.json'), '{}\n');
  fs.writeFileSync(path.join(payload, 'LICENSE'), 'MIT\n');
  git(root, ['add', '.']);
  commit(root, 'fixture');
  git(root, ['tag', 'v1.2.3']);

  const first = buildReleaseArchives({
    root,
    version: '1.2.3',
    outputDirectory: 'dist-one',
    revision: 'v1.2.3'
  });
  await new Promise((resolve) => setTimeout(resolve, 1100));
  fs.writeFileSync(path.join(root, 'README.md'), 'later docs-only commit\n');
  git(root, ['add', 'README.md']);
  commit(root, 'docs only');
  const second = buildReleaseArchives({
    root,
    version: '1.2.3',
    outputDirectory: 'dist-two',
    revision: 'v1.2.3'
  });
  const wrongRevision = buildReleaseArchives({
    root,
    version: '1.2.3',
    outputDirectory: 'dist-head',
    revision: 'HEAD'
  });
  assert.deepEqual(
    first.assets.map((asset) => [asset.filename, asset.sha256]),
    second.assets.map((asset) => [asset.filename, asset.sha256])
  );
  for (const asset of expectedReleaseAssets('1.2.3')) {
    assert.deepEqual(
      fs.readFileSync(path.join(first.outputDirectory, asset)),
      fs.readFileSync(path.join(second.outputDirectory, asset))
    );
  }
  assert.notEqual(
    first.assets.find((asset) => asset.filename.endsWith('.tar.gz')).sha256,
    wrongRevision.assets.find((asset) => asset.filename.endsWith('.tar.gz')).sha256
  );
});

test('release asset verification fails closed on a divergent existing asset', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-release-assets-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const builtDirectory = path.join(root, 'built');
  const existingDirectory = path.join(root, 'existing');
  fs.mkdirSync(builtDirectory);
  fs.mkdirSync(existingDirectory);
  const filename = 'sd0x-dev-flow-codex-1.2.3.zip';
  fs.writeFileSync(path.join(builtDirectory, filename), 'expected\n');
  fs.writeFileSync(path.join(existingDirectory, filename), 'different\n');

  assert.throws(
    () => verifyReleaseAssets({
      version: '1.2.3',
      builtDirectory,
      existingDirectory,
      assetNames: [filename]
    }),
    /differs from reproducible build/
  );
});
