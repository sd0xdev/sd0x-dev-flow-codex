'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
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

function aliasOwnerRecord(root) {
  const aliasPath = path.join(root, 'migration', 'alias-capability.json');
  const aliasCapability = JSON.parse(fs.readFileSync(aliasPath));
  const ownerPath = path.join(root, ...aliasCapability.owner_request_path.split('/'));
  const ownerRequest = fs.readFileSync(ownerPath, 'utf8');
  const marker = /^<!-- sd0x-alias-capability-owner:v1 ([^\r\n]+) -->$/m.exec(
    ownerRequest
  );
  return {
    aliasPath,
    aliasCapability,
    ownerPath,
    ownerRequest,
    marker: marker[0],
    evidence: JSON.parse(marker[1])
  };
}

function writeAliasOwnerEvidence(root, update) {
  const record = aliasOwnerRecord(root);
  const evidence = update({ ...record.evidence }, record);
  fs.writeFileSync(record.ownerPath, record.ownerRequest.replace(
    record.marker,
    `<!-- sd0x-alias-capability-owner:v1 ${JSON.stringify(evidence)} -->`
  ));
}

function syncAliasOwnerDecisionHash(root) {
  writeAliasOwnerEvidence(root, (evidence, record) => ({
    ...evidence,
    decision_sha256: crypto.createHash('sha256')
      .update(fs.readFileSync(record.aliasPath))
      .digest('hex')
  }));
}

function syncAliasFingerprint(root, pluginRoot) {
  const manifestPath = path.join(pluginRoot, '.codex-plugin', 'plugin.json');
  const aliasPath = path.join(root, 'migration', 'alias-capability.json');
  const aliasCapability = JSON.parse(fs.readFileSync(aliasPath));
  aliasCapability.plugin_fingerprint = crypto.createHash('sha256')
    .update(fs.readFileSync(manifestPath))
    .digest('hex');
  writeJson(aliasPath, aliasCapability);
  syncAliasOwnerDecisionHash(root);
}

function versionSourceBytes(root, pluginRoot) {
  const aliasCapability = JSON.parse(fs.readFileSync(
    path.join(root, 'migration', 'alias-capability.json')
  ));
  return [
    path.join(root, 'package.json'),
    path.join(pluginRoot, '.codex-plugin', 'plugin.json'),
    path.join(root, 'docs', 'PROJECT-MIGRATION-GUIDE.md'),
    path.join(root, 'migration', 'alias-capability.json'),
    path.join(root, ...aliasCapability.owner_request_path.split('/'))
  ].map((filePath) => [filePath, fs.readFileSync(filePath)]);
}

function assertSourceBytes(entries) {
  for (const [filePath, bytes] of entries) {
    assert.deepEqual(fs.readFileSync(filePath), bytes, filePath);
  }
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-release-'));
  const pluginRoot = path.join(root, 'plugin', PLUGIN_NAME);
  writeJson(path.join(root, 'package.json'), {
    name: PLUGIN_NAME,
    version: '0.1.0',
    private: true
  });
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(root, 'docs', 'PROJECT-MIGRATION-GUIDE.md'),
    '> Codex 版本：`sd0x-dev-flow-codex` `0.1.0`\n');
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
  const manifestPath = path.join(pluginRoot, '.codex-plugin', 'plugin.json');
  const ownerRelative =
    'docs/features/skill-toolkit-migration/requests/2026-07-24-alias-owner.md';
  const aliasPath = path.join(root, 'migration', 'alias-capability.json');
  writeJson(aliasPath, {
    codex_version: 'codex-cli 0.145.0',
    decision: 'mapping-only',
    registry_mechanism: null,
    tested_at: '2026-07-24T00:00:00Z',
    plugin_fingerprint: crypto.createHash('sha256')
      .update(fs.readFileSync(manifestPath))
      .digest('hex'),
    owner_request_path: ownerRelative
  });
  const ownerPath = path.join(root, ...ownerRelative.split('/'));
  fs.mkdirSync(path.dirname(ownerPath), { recursive: true });
  fs.writeFileSync(ownerPath,
    '# Alias Owner\n\n' +
    `<!-- sd0x-alias-capability-owner:v1 ${JSON.stringify({
      codex_version: 'codex-cli 0.145.0',
      decision: 'mapping-only',
      decision_sha256: crypto.createHash('sha256')
        .update(fs.readFileSync(aliasPath))
        .digest('hex'),
      registry_mechanism: null,
      tested_at: '2026-07-24T00:00:00Z'
    })} -->\n`);
  writeJson(path.join(pluginRoot, '.mcp.json'), {});
  writeJson(path.join(pluginRoot, 'hooks', 'hooks.json'), {});
  fs.mkdirSync(path.join(pluginRoot, 'skills'), { recursive: true });
  fs.writeFileSync(path.join(pluginRoot, 'LICENSE'), 'MIT\n');
  return { root, pluginRoot };
}

test('current repository satisfies the public release contract', () => {
  const result = checkRelease();
  const migrationGuide = fs.readFileSync(path.resolve(
    __dirname,
    '..',
    'docs',
    'PROJECT-MIGRATION-GUIDE.md'
  ), 'utf8');
  const documentedVersion = /> Codex 版本：`sd0x-dev-flow-codex` `([^`]+)`/.exec(
    migrationGuide
  )?.[1];
  assert.equal(result.selector, `${PLUGIN_NAME}@${MARKETPLACE_NAME}`);
  assert.match(result.version, /^\d+\.\d+\.\d+/);
  assert.equal(documentedVersion, result.version);
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

test('CI and release budgets cover the aggregate repository check', () => {
  const root = path.resolve(__dirname, '..');
  const ci = fs.readFileSync(
    path.join(root, '.github', 'workflows', 'ci.yml'), 'utf8'
  );
  const release = fs.readFileSync(
    path.join(root, '.github', 'workflows', 'release.yml'), 'utf8'
  );
  const timeout = (workflow) => Number(
    /^\s*timeout-minutes:\s*(\d+)\s*$/m.exec(workflow)?.[1]
  );

  assert.ok(timeout(ci) >= 40);
  assert.ok(timeout(release) >= 45);
  assert.match(ci, /npm run check/);
  assert.match(release, /npm run check/);
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
  assert.match(
    fs.readFileSync(path.join(values.root, 'docs', 'PROJECT-MIGRATION-GUIDE.md'),
      'utf8'),
    /> Codex 版本：`sd0x-dev-flow-codex` `2\.3\.4-rc\.1`/
  );
  const manifestPath = path.join(values.pluginRoot, '.codex-plugin', 'plugin.json');
  assert.equal(
    JSON.parse(fs.readFileSync(path.join(
      values.root, 'migration', 'alias-capability.json'
    ))).plugin_fingerprint,
    crypto.createHash('sha256').update(fs.readFileSync(manifestPath)).digest('hex')
  );
  const aliasPath = path.join(values.root, 'migration', 'alias-capability.json');
  const ownerPath = path.join(values.root, 'docs', 'features',
    'skill-toolkit-migration', 'requests', '2026-07-24-alias-owner.md');
  const ownerEvidence = JSON.parse(
    /sd0x-alias-capability-owner:v1 ([^\r\n]+) -->/.exec(
      fs.readFileSync(ownerPath, 'utf8')
    )[1]
  );
  assert.equal(
    ownerEvidence.decision_sha256,
    crypto.createHash('sha256').update(fs.readFileSync(aliasPath)).digest('hex')
  );
});

test('version setter rolls back every source after each install boundary fails', (t) => {
  for (const failAt of [0, 1, 2, 3, 4]) {
    const values = fixture();
    t.after(() => fs.rmSync(values.root, { recursive: true, force: true }));
    const prior = versionSourceBytes(values.root, values.pluginRoot);
    assert.throws(() => setVersion('2.3.4', values.root, {
      beforeInstall({ index }) {
        if (index === failAt) throw new Error(`injected install failure ${failAt}`);
      }
    }), new RegExp(`injected install failure ${failAt}`));
    assertSourceBytes(prior);
    assert.equal(
      JSON.parse(fs.readFileSync(path.join(values.root, 'package.json'))).version,
      '0.1.0'
    );
    assert.equal(
      JSON.parse(fs.readFileSync(
        path.join(values.pluginRoot, '.codex-plugin', 'plugin.json')
      )).version,
      '0.1.0'
    );
    assert.match(
      fs.readFileSync(path.join(values.root, 'docs', 'PROJECT-MIGRATION-GUIDE.md'),
        'utf8'),
      /> Codex 版本：`sd0x-dev-flow-codex` `0\.1\.0`/
    );
    const manifestPath = path.join(values.pluginRoot, '.codex-plugin', 'plugin.json');
    assert.equal(
      JSON.parse(fs.readFileSync(path.join(
        values.root, 'migration', 'alias-capability.json'
      ))).plugin_fingerprint,
      crypto.createHash('sha256').update(fs.readFileSync(manifestPath)).digest('hex')
    );
  }
});

test('version setter preserves prior bytes when rollback installation also fails', (t) => {
  const values = fixture();
  t.after(() => fs.rmSync(values.root, { recursive: true, force: true }));
  let failure;
  try {
    setVersion('2.3.4', values.root, {
      beforeInstall({ index }) {
        if (index === 2) throw new Error('injected install failure');
      },
      beforeRollbackInstall({ index }) {
        if (index === 1) throw new Error('injected rollback failure');
      }
    });
  } catch (error) {
    failure = error;
  }
  assert.match(failure?.message || '',
    /injected install failure; version rollback failed: injected rollback failure/);
  const pluginDirectory = path.join(values.pluginRoot, '.codex-plugin');
  const artifacts = fs.readdirSync(pluginDirectory)
    .filter((name) => name.endsWith('.rollback'));
  assert.equal(artifacts.length, 1);
  assert.equal(
    JSON.parse(fs.readFileSync(path.join(pluginDirectory, artifacts[0]))).version,
    '0.1.0'
  );
  assert.match(failure.message, new RegExp(artifacts[0]));
  assert.equal(
    JSON.parse(fs.readFileSync(path.join(values.root, 'package.json'))).version,
    '0.1.0'
  );
  assert.equal(
    JSON.parse(fs.readFileSync(
      path.join(values.pluginRoot, '.codex-plugin', 'plugin.json')
    )).version,
    '2.3.4'
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

test('release check rejects a stale migration-guide version', (t) => {
  const values = fixture();
  t.after(() => fs.rmSync(values.root, { recursive: true, force: true }));
  const guidePath = path.join(values.root, 'docs', 'PROJECT-MIGRATION-GUIDE.md');
  fs.writeFileSync(guidePath,
    '> Codex 版本：`sd0x-dev-flow-codex` `0.0.9`\n');
  assert.throws(() => checkRelease(values.root), /migration guide and package versions/);
});

test('release check rejects a stale alias capability plugin fingerprint', (t) => {
  const values = fixture();
  t.after(() => fs.rmSync(values.root, { recursive: true, force: true }));
  const aliasPath = path.join(values.root, 'migration', 'alias-capability.json');
  const aliasCapability = JSON.parse(fs.readFileSync(aliasPath));
  aliasCapability.plugin_fingerprint = '0'.repeat(64);
  writeJson(aliasPath, aliasCapability);
  assert.throws(() => checkRelease(values.root), /alias capability plugin fingerprint/);
});

test('release check rejects stale alias capability owner evidence', (t) => {
  const values = fixture();
  t.after(() => fs.rmSync(values.root, { recursive: true, force: true }));
  const ownerPath = path.join(values.root, 'docs', 'features',
    'skill-toolkit-migration', 'requests', '2026-07-24-alias-owner.md');
  fs.writeFileSync(ownerPath, fs.readFileSync(ownerPath, 'utf8')
    .replace(/[0-9a-f]{64}/, '0'.repeat(64)));

  assert.throws(() => checkRelease(values.root),
    /owner evidence does not match the decision artifact/);
});

test('version setter rejects stale alias owner evidence before changing any source', (t) => {
  const values = fixture();
  t.after(() => fs.rmSync(values.root, { recursive: true, force: true }));
  const ownerPath = path.join(values.root, 'docs', 'features',
    'skill-toolkit-migration', 'requests', '2026-07-24-alias-owner.md');
  fs.writeFileSync(ownerPath, fs.readFileSync(ownerPath, 'utf8')
    .replace(/[0-9a-f]{64}/, '0'.repeat(64)));
  const prior = versionSourceBytes(values.root, values.pluginRoot);

  assert.throws(() => setVersion('2.3.4', values.root),
    /owner evidence does not match the decision artifact/);
  assertSourceBytes(prior);
});

test('version setter refuses to mutate a Completed alias owner request', (t) => {
  const values = fixture();
  t.after(() => fs.rmSync(values.root, { recursive: true, force: true }));
  const owner = aliasOwnerRecord(values.root);
  fs.writeFileSync(owner.ownerPath, owner.ownerRequest.replace(
    '# Alias Owner',
    '# Alias Owner\n\n> **Status**: Completed'
  ));
  const prior = versionSourceBytes(values.root, values.pluginRoot);

  assert.equal(checkRelease(values.root).version, '0.1.0');
  assert.throws(() => setVersion('2.3.4', values.root),
    /Completed; create and bind a replacement owner ticket/);
  assertSourceBytes(prior);
});

test('release preflight validates every alias owner evidence field exactly', (t) => {
  const mutations = [
    ['codex_version', 'codex-cli 9.9.9'],
    ['decision', 'manual-only'],
    ['registry_mechanism', 'implicitInvocationDisabled'],
    ['tested_at', '2026-07-24T01:00:00Z']
  ];
  for (const [field, value] of mutations) {
    const values = fixture();
    t.after(() => fs.rmSync(values.root, { recursive: true, force: true }));
    writeAliasOwnerEvidence(values.root, (evidence) => ({
      ...evidence,
      [field]: value
    }));
    const prior = versionSourceBytes(values.root, values.pluginRoot);

    assert.throws(() => checkRelease(values.root),
      /owner evidence does not match the decision artifact/);
    assert.throws(() => setVersion('2.3.4', values.root),
      /owner evidence does not match the decision artifact/);
    assertSourceBytes(prior);
  }

  const extraField = fixture();
  t.after(() => fs.rmSync(extraField.root, { recursive: true, force: true }));
  writeAliasOwnerEvidence(extraField.root, (evidence) => ({
    ...evidence,
    unexpected: true
  }));
  const prior = versionSourceBytes(extraField.root, extraField.pluginRoot);
  assert.throws(() => checkRelease(extraField.root),
    /owner evidence fields or decision hash are invalid/);
  assert.throws(() => setVersion('2.3.4', extraField.root),
    /owner evidence fields or decision hash are invalid/);
  assertSourceBytes(prior);
});

test('release preflight rejects traversing and symlinked alias owner paths', (t) => {
  const cases = [
    {
      pattern: /normalized repository-relative path/,
      configure(values) {
        const aliasPath = path.join(values.root, 'migration', 'alias-capability.json');
        const aliasCapability = JSON.parse(fs.readFileSync(aliasPath));
        const outsideName = `${path.basename(values.root)}-alias-owner.md`;
        const outsidePath = path.join(path.dirname(values.root), outsideName);
        fs.writeFileSync(outsidePath, 'outside owner\n');
        t.after(() => fs.rmSync(outsidePath, { force: true }));
        aliasCapability.owner_request_path = `../${outsideName}`;
        writeJson(aliasPath, aliasCapability);
      }
    },
    {
      pattern: /must not traverse symlinks/,
      configure(values) {
        const target = path.join(values.root, 'owner-target');
        fs.mkdirSync(target);
        fs.writeFileSync(path.join(target, 'alias-owner.md'), 'linked owner\n');
        const link = path.join(values.root, 'docs', 'linked-owner');
        fs.symlinkSync(target, link, 'dir');
        const aliasPath = path.join(values.root, 'migration', 'alias-capability.json');
        const aliasCapability = JSON.parse(fs.readFileSync(aliasPath));
        aliasCapability.owner_request_path = 'docs/linked-owner/alias-owner.md';
        writeJson(aliasPath, aliasCapability);
      }
    },
    {
      pattern: /must not traverse symlinks/,
      configure(values) {
        const aliasPath = path.join(values.root, 'migration', 'alias-capability.json');
        const aliasCapability = JSON.parse(fs.readFileSync(aliasPath));
        const priorOwner = path.join(
          values.root, ...aliasCapability.owner_request_path.split('/')
        );
        const link = path.join(values.root, 'docs', 'alias-owner-link.md');
        fs.symlinkSync(priorOwner, link);
        aliasCapability.owner_request_path = 'docs/alias-owner-link.md';
        writeJson(aliasPath, aliasCapability);
      }
    }
  ];

  for (const scenario of cases) {
    const values = fixture();
    t.after(() => fs.rmSync(values.root, { recursive: true, force: true }));
    scenario.configure(values);
    const prior = versionSourceBytes(values.root, values.pluginRoot);

    assert.throws(() => checkRelease(values.root), scenario.pattern);
    assert.throws(() => setVersion('2.3.4', values.root), scenario.pattern);
    assertSourceBytes(prior);
  }
});

test('version setter rejects stale alias evidence before changing any source', (t) => {
  const values = fixture();
  t.after(() => fs.rmSync(values.root, { recursive: true, force: true }));
  const aliasPath = path.join(values.root, 'migration', 'alias-capability.json');
  const aliasCapability = JSON.parse(fs.readFileSync(aliasPath));
  aliasCapability.plugin_fingerprint = '0'.repeat(64);
  writeJson(aliasPath, aliasCapability);
  const prior = versionSourceBytes(values.root, values.pluginRoot);

  assert.throws(() => setVersion('2.3.4', values.root),
    /alias capability plugin fingerprint/);
  assertSourceBytes(prior);
});

test('version setter preflights the complete release contract without mutation', (t) => {
  const values = fixture();
  t.after(() => fs.rmSync(values.root, { recursive: true, force: true }));
  const marketplacePath = path.join(values.root, '.agents', 'plugins', 'marketplace.json');
  const marketplace = JSON.parse(fs.readFileSync(marketplacePath));
  marketplace.plugins[0].policy.installation = 'BLOCKED';
  writeJson(marketplacePath, marketplace);
  const prior = versionSourceBytes(values.root, values.pluginRoot);

  assert.throws(() => setVersion('2.3.4', values.root), /must be installable/);
  assertSourceBytes(prior);
});

test('release check rejects metadata that presents Claude as the fixed primary', (t) => {
  const values = fixture();
  t.after(() => fs.rmSync(values.root, { recursive: true, force: true }));
  const manifestPath = path.join(values.pluginRoot, '.codex-plugin', 'plugin.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath));
  manifest.interface.longDescription =
    'A harness that combines a Claude MCP primary review with Codex reviewers.';
  writeJson(manifestPath, manifest);
  syncAliasFingerprint(values.root, values.pluginRoot);

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
