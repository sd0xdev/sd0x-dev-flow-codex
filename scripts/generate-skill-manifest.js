#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const INVENTORY_PATH = 'migration/source-inventory.generated.json';
const STAGING_PATH = 'migration/staging';
const BYTEWISE = (left, right) => Buffer.from(left).compare(Buffer.from(right));

const DEFAULT_CONFIG = Object.freeze({
  schema_version: 1,
  generator_version: 1,
  inventory_sha256: 'bd9d3f3aead8a0c421d0b9ceb0ab6270864c7d949b5fae2f201874c98c1ad775',
  repository: 'https://github.com/sd0xdev/sd0x-dev-flow.git',
  primary: {
    id: 'upstream-git',
    commit: 'f4187c53eb746b6f84eb1f413e7210bd506e6db9',
    totals: { skills: 98, skill_files: 263, references: 138, scripts: 25 }
  },
  overlay: {
    id: 'local-skill-overlay-2026-07-10',
    base_commit: 'f4187c53eb746b6f84eb1f413e7210bd506e6db9',
    observed_on: '2026-07-10',
    totals: { skills: 2, skill_files: 3, references: 1, scripts: 0 },
    files: [
      {
        path: 'skills/readme-i18n-sync/SKILL.md',
        size: 5890,
        sha256: '6de25877ad11f4da564261485849394018dda7637875e03b2911ec7eb28a5f0a'
      },
      {
        path: 'skills/readme-i18n-sync/references/glossary.md',
        size: 2781,
        sha256: 'a7151b3130ee0ddaf7382b05e5809f07469879db8401545b5b181d664946130c'
      },
      {
        path: 'skills/update-readme/SKILL.md',
        size: 3413,
        sha256: 'c2cea3d903e872ffb535c396764a47690cb8b112ce67fdcfe26fce4fac7fff95'
      }
    ]
  },
  external_roots: ['assets', 'rules', 'scripts', 'templates']
});

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function normalizeRelative(value, field = 'path') {
  assert(typeof value === 'string' && value.length > 0, `${field} must be non-empty`);
  assert(!value.includes('\\'), `${field} must use POSIX separators: ${value}`);
  assert(!path.posix.isAbsolute(value), `${field} must be relative: ${value}`);
  const normalized = path.posix.normalize(value);
  assert(normalized === value && normalized !== '..' && !normalized.startsWith('../'),
    `${field} must be normalized and contained: ${value}`);
  return normalized;
}

function runGit(repository, args, options = {}) {
  const env = {
    ...process.env,
    GIT_CONFIG_GLOBAL: os.devNull,
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_NO_REPLACE_OBJECTS: '1'
  };
  for (const key of [
    'GIT_ALTERNATE_OBJECT_DIRECTORIES',
    'GIT_COMMON_DIR',
    'GIT_CONFIG_PARAMETERS',
    'GIT_CONFIG_COUNT',
    'GIT_CEILING_DIRECTORIES',
    'GIT_DIR',
    'GIT_INDEX_FILE',
    'GIT_NAMESPACE',
    'GIT_OBJECT_DIRECTORY',
    'GIT_QUARANTINE_PATH',
    'GIT_REPLACE_REF_BASE',
    'GIT_SHALLOW_FILE',
    'GIT_WORK_TREE'
  ]) delete env[key];
  for (const key of Object.keys(env)) {
    if (/^GIT_CONFIG_(?:KEY|VALUE)_\d+$/.test(key)) delete env[key];
  }
  try {
    return execFileSync('git', ['--no-replace-objects', ...args], {
      cwd: repository,
      encoding: options.encoding,
      maxBuffer: 32 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
      env
    });
  } catch (error) {
    const detail = error.stderr ? String(error.stderr).trim() : error.message;
    throw new Error(`git ${args[0]} failed in source repository: ${detail}`);
  }
}

function parseTree(buffer) {
  const records = [];
  for (const raw of buffer.toString('utf8').split('\0')) {
    if (!raw) continue;
    const match = /^(\d+) (\w+) ([0-9a-f]+)\t(.+)$/.exec(raw);
    assert(match, `unexpected git ls-tree record: ${raw}`);
    const record = {
      mode: match[1],
      type: match[2],
      object: match[3],
      path: normalizeRelative(match[4], 'Git tree path')
    };
    assert(record.type === 'blob' && /^100(?:644|755)$/.test(record.mode),
      `source snapshot only accepts regular files: ${record.path}`);
    records.push(record);
  }
  return records.sort((left, right) => BYTEWISE(left.path, right.path));
}

function gitTree(repository, commit, pathspecs) {
  return parseTree(runGit(repository, [
    'ls-tree', '-r', '-z', '--full-tree', commit, '--', ...pathspecs
  ], { encoding: null }));
}

function gitBlob(repository, object) {
  return runGit(repository, ['cat-file', 'blob', object], { encoding: null });
}

function totalsFor(files) {
  const names = new Set();
  let references = 0;
  let scripts = 0;
  for (const file of files) {
    const match = /^skills\/([^/]+)\/(.+)$/.exec(file.path);
    assert(match, `skill payload file is outside a source skill: ${file.path}`);
    names.add(match[1]);
    if (match[2].startsWith('references/')) references += 1;
    if (match[2].startsWith('scripts/')) scripts += 1;
  }
  return {
    skills: names.size,
    skill_files: files.length,
    references,
    scripts
  };
}

function assertTotals(actual, expected, label) {
  for (const field of ['skills', 'skill_files', 'references', 'scripts']) {
    assert(Number.isInteger(expected?.[field]), `${label} expected ${field} is required`);
    assert(actual[field] === expected[field],
      `${label} ${field} mismatch: expected ${expected[field]}, got ${actual[field]}`);
  }
}

function fileRecord(file, bytes) {
  return {
    path: file.path,
    size: bytes.length,
    sha256: sha256(bytes)
  };
}

function skillName(filePath) {
  const match = /^skills\/([^/]+)\//.exec(filePath);
  assert(match, `invalid skill path: ${filePath}`);
  return match[1];
}

function ensureRegularFile(filePath, label) {
  let stat;
  try {
    stat = fs.lstatSync(filePath);
  } catch (error) {
    throw new Error(`${label} is missing: ${filePath}`);
  }
  assert(stat.isFile() && !stat.isSymbolicLink(), `${label} must be a regular file: ${filePath}`);
}

function lstatIfPresent(filePath) {
  try {
    return fs.lstatSync(filePath);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

function assertDirectory(filePath, label) {
  const stat = lstatIfPresent(filePath);
  assert(stat && stat.isDirectory() && !stat.isSymbolicLink(),
    `${label} must be a real directory: ${filePath}`);
  return fs.realpathSync(filePath);
}

function assertContainedComponents(root, relative, label) {
  const rootReal = assertDirectory(root, `${label} root`);
  let current = root;
  for (const component of normalizeRelative(relative, label).split('/')) {
    current = path.join(current, component);
    const stat = lstatIfPresent(current);
    assert(stat, `${label} is missing: ${current}`);
    assert(!stat.isSymbolicLink(), `${label} must not contain symlinks: ${current}`);
  }
  const resolved = fs.realpathSync(current);
  assert(resolved.startsWith(`${rootReal}${path.sep}`), `${label} escapes its root: ${relative}`);
  return current;
}

function prepareMigrationRoot(outputRoot) {
  fs.mkdirSync(outputRoot, { recursive: true });
  const outputReal = assertDirectory(outputRoot, 'output root');
  const migrationRoot = path.join(outputRoot, 'migration');
  const migrationStat = lstatIfPresent(migrationRoot);
  if (migrationStat) {
    assert(migrationStat.isDirectory() && !migrationStat.isSymbolicLink(),
      `migration root must be a real directory: ${migrationRoot}`);
  } else {
    fs.mkdirSync(migrationRoot);
  }
  const migrationReal = fs.realpathSync(migrationRoot);
  assert(migrationReal.startsWith(`${outputReal}${path.sep}`),
    `migration root escapes output root: ${migrationRoot}`);
  return migrationRoot;
}

function existingMigrationRoot(outputRoot) {
  const outputReal = assertDirectory(outputRoot, 'output root');
  const migrationRoot = path.join(outputRoot, 'migration');
  const migrationReal = assertDirectory(migrationRoot, 'migration root');
  assert(migrationReal.startsWith(`${outputReal}${path.sep}`),
    `migration root escapes output root: ${migrationRoot}`);
  return migrationRoot;
}

function assertPublishDestination(filePath, kind) {
  const stat = lstatIfPresent(filePath);
  if (!stat) return false;
  assert(!stat.isSymbolicLink(), `publish destination must not be a symlink: ${filePath}`);
  if (kind === 'directory') assert(stat.isDirectory(), `publish destination must be a directory: ${filePath}`);
  else assert(stat.isFile(), `publish destination must be a regular file: ${filePath}`);
  return true;
}

function kindForExternal(filePath) {
  if (filePath.startsWith('rules/')) return 'rule';
  if (filePath.startsWith('scripts/')) return 'root-script';
  if (filePath.startsWith('templates/')) return 'template';
  if (filePath.startsWith('assets/')) return 'asset';
  return 'other';
}

function referencedSharedPaths(text) {
  const references = new Set();
  const pattern = /(?:@)?\b((?:assets|rules|scripts|templates)\/[A-Za-z0-9._/-]+\.[A-Za-z0-9._-]+)\b/g;
  for (const match of text.matchAll(pattern)) {
    references.add(normalizeRelative(match[1], 'shared dependency path'));
  }
  return [...references].sort(BYTEWISE);
}

function inventoryBytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
}

function buildSnapshot(options = {}) {
  const config = options.config || DEFAULT_CONFIG;
  const sourceRepo = path.resolve(options.sourceRepo || path.join(ROOT, '..', 'sd0x-dev-flow'));
  const targetRoot = path.resolve(options.outputRoot || ROOT);
  const primary = config.primary;
  const overlay = config.overlay;
  assert(primary && overlay, 'primary and overlay configuration are required');

  const commit = String(runGit(sourceRepo, [
    'rev-parse', '--verify', `${primary.commit}^{commit}`
  ], { encoding: 'utf8' })).trim();
  assert(commit === primary.commit,
    `primary commit did not resolve exactly: expected ${primary.commit}, got ${commit}`);

  const primaryTree = gitTree(sourceRepo, commit, ['skills']);
  const primaryFiles = primaryTree.map((entry) => {
    const bytes = gitBlob(sourceRepo, entry.object);
    return { ...fileRecord(entry, bytes), bytes };
  });
  const primaryTotals = totalsFor(primaryFiles);
  assertTotals(primaryTotals, primary.totals, 'primary source');

  const primaryNames = new Set(primaryFiles.map((file) => skillName(file.path)));
  for (const name of primaryNames) {
    assert(primaryFiles.some((file) => file.path === `skills/${name}/SKILL.md`),
      `primary source skill is missing SKILL.md: ${name}`);
  }

  const observedHead = String(runGit(sourceRepo, ['rev-parse', 'HEAD'], {
    encoding: 'utf8'
  })).trim();
  assert(observedHead === overlay.base_commit,
    `local overlay HEAD mismatch: expected ${overlay.base_commit}, got ${observedHead}`);

  const overlayFiles = [...overlay.files]
    .sort((left, right) => BYTEWISE(left.path, right.path))
    .map((expected) => {
      const relative = normalizeRelative(expected.path, 'overlay path');
      assert(relative.startsWith('skills/'), `overlay path must be under skills/: ${relative}`);
      assert(!primaryNames.has(skillName(relative)),
        `overlay source skill collides with primary Git tree: ${skillName(relative)}`);
      const absolute = assertContainedComponents(sourceRepo, relative, 'overlay path');
      ensureRegularFile(absolute, 'local overlay file');
      const bytes = fs.readFileSync(absolute);
      assert(bytes.length === expected.size,
        `local overlay size mismatch for ${relative}: expected ${expected.size}, got ${bytes.length}`);
      const actualHash = sha256(bytes);
      assert(actualHash === expected.sha256,
        `local overlay hash mismatch for ${relative}: expected ${expected.sha256}, got ${actualHash}`);
      return { path: relative, size: bytes.length, sha256: actualHash, bytes };
    });
  const overlayTotals = totalsFor(overlayFiles);
  assertTotals(overlayTotals, overlay.totals, 'local overlay');
  const overlayNames = new Set(overlayFiles.map((file) => skillName(file.path)));
  for (const name of overlayNames) {
    assert(overlayFiles.some((file) => file.path === `skills/${name}/SKILL.md`),
      `overlay source skill is missing SKILL.md: ${name}`);
  }

  const licenseTree = gitTree(sourceRepo, commit, ['LICENSE']);
  assert(licenseTree.length === 1 && licenseTree[0].path === 'LICENSE',
    'primary source must contain exactly one root LICENSE file');
  const licenseBytes = gitBlob(sourceRepo, licenseTree[0].object);
  const license = {
    path: 'LICENSE',
    staged_path: `${STAGING_PATH}/LICENSE.upstream`,
    size: licenseBytes.length,
    sha256: sha256(licenseBytes)
  };

  const rootTree = gitTree(sourceRepo, commit, ['.']);
  const notices = rootTree
    .filter((entry) => /^NOTICE(?:\..+)?$/.test(entry.path))
    .map((entry) => {
      const bytes = gitBlob(sourceRepo, entry.object);
      return {
        path: entry.path,
        staged_path: `${STAGING_PATH}/${entry.path}.upstream`,
        size: bytes.length,
        sha256: sha256(bytes),
        bytes
      };
    });

  const allFiles = [...primaryFiles, ...overlayFiles]
    .sort((left, right) => BYTEWISE(left.path, right.path));
  const payloadPaths = new Set(allFiles.map((file) => file.path));
  const externalTree = gitTree(sourceRepo, commit, config.external_roots || []);
  const externalByPath = new Map(externalTree.map((entry) => [entry.path, entry]));
  const searchableSkills = allFiles.map((file) => ({
    source_name: skillName(file.path),
    text: file.bytes.toString('utf8')
  }));
  const consumersByExternal = new Map();
  for (const file of searchableSkills) {
    for (const referenced of referencedSharedPaths(file.text)) {
      if (payloadPaths.has(`skills/${file.source_name}/${referenced}`)) continue;
      // Source docs also contain placeholders such as scripts/xxx.sh. Only a
      // literal path present in the pinned tree is an inventory dependency.
      if (!externalByPath.has(referenced)) continue;
      if (!consumersByExternal.has(referenced)) consumersByExternal.set(referenced, new Set());
      consumersByExternal.get(referenced).add(file.source_name);
    }
  }
  const externalDependencies = [];
  for (const entry of externalTree) {
    const consumers = [...(consumersByExternal.get(entry.path) || [])].sort(BYTEWISE);
    if (consumers.length === 0) continue;
    const bytes = gitBlob(sourceRepo, entry.object);
    externalDependencies.push({
      path: entry.path,
      kind: kindForExternal(entry.path),
      size: bytes.length,
      sha256: sha256(bytes),
      consumers
    });
  }

  const skills = [...new Set(allFiles.map((file) => skillName(file.path)))]
    .sort(BYTEWISE)
    .map((name) => {
      const sourceId = primaryNames.has(name) ? primary.id : overlay.id;
      return {
        source_id: sourceId,
        source_name: name,
        source_dir: `skills/${name}`,
        source_files: allFiles
          .filter((file) => skillName(file.path) === name)
          .map(({ path: filePath, size, sha256: hash }) => ({
            path: filePath,
            size,
            sha256: hash
          }))
      };
    });
  const totals = totalsFor(allFiles);
  assertTotals(totals, {
    skills: primary.totals.skills + overlay.totals.skills,
    skill_files: primary.totals.skill_files + overlay.totals.skill_files,
    references: primary.totals.references + overlay.totals.references,
    scripts: primary.totals.scripts + overlay.totals.scripts
  }, 'composite source');

  const inventory = {
    schema_version: config.schema_version,
    generator_version: config.generator_version,
    sources: [
      {
        id: primary.id,
        kind: 'git',
        repository: config.repository,
        commit,
        totals: primaryTotals,
        license,
        notices: notices.map(({ bytes, ...notice }) => notice)
      },
      {
        id: overlay.id,
        kind: 'local-overlay',
        base_commit: overlay.base_commit,
        acquisition: {
          origin: 'sibling-repository-working-tree',
          repository: config.repository,
          relative_path_from_target: path.relative(targetRoot, sourceRepo).split(path.sep).join('/'),
          observed_head: observedHead,
          observed_on: overlay.observed_on
        },
        totals: overlayTotals,
        license_source_id: primary.id,
        files: overlayFiles.map(({ bytes, ...file }) => file)
      }
    ],
    hash_algorithm: 'sha256',
    totals,
    external_dependencies: externalDependencies,
    skills
  };

  return {
    inventory,
    inventoryBytes: inventoryBytes(inventory),
    stagedFiles: [
      { path: 'LICENSE.upstream', bytes: licenseBytes },
      ...notices.map((notice) => ({
        path: `${notice.path}.upstream`,
        bytes: notice.bytes
      })),
      ...allFiles.map((file) => ({
        path: file.path.replace(/^skills\//, ''),
        bytes: file.bytes
      }))
    ]
  };
}

function writeFileContained(root, relative, bytes) {
  const safe = normalizeRelative(relative, 'staging path');
  const destination = path.resolve(root, ...safe.split('/'));
  assert(destination.startsWith(`${root}${path.sep}`), `staging path escapes root: ${relative}`);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, bytes, { flag: 'wx' });
}

function materialize(snapshot, outputRoot = ROOT, io = {}) {
  const migrationRoot = prepareMigrationRoot(path.resolve(outputRoot));
  const renameSync = io.renameSync || fs.renameSync;
  const temporary = fs.mkdtempSync(path.join(migrationRoot, '.source-snapshot-'));
  const proposedStaging = path.join(temporary, 'staging');
  const proposedInventory = path.join(temporary, 'source-inventory.generated.json');
  let preserveTemporary = false;
  try {
    fs.mkdirSync(proposedStaging);
    for (const file of snapshot.stagedFiles) {
      writeFileContained(proposedStaging, file.path, file.bytes);
    }
    fs.writeFileSync(proposedInventory, snapshot.inventoryBytes, { flag: 'wx' });

    const staging = path.join(migrationRoot, 'staging');
    const inventory = path.join(migrationRoot, 'source-inventory.generated.json');
    const hadStaging = assertPublishDestination(staging, 'directory');
    const hadInventory = assertPublishDestination(inventory, 'file');
    const backupStaging = path.join(temporary, 'previous-staging');
    const backupInventory = path.join(temporary, 'previous-inventory.json');
    let movedStaging = false;
    let movedInventory = false;
    let installedStaging = false;
    let installedInventory = false;
    try {
      if (hadStaging) {
        renameSync(staging, backupStaging);
        movedStaging = true;
      }
      if (hadInventory) {
        renameSync(inventory, backupInventory);
        movedInventory = true;
      }
      renameSync(proposedStaging, staging);
      installedStaging = true;
      renameSync(proposedInventory, inventory);
      installedInventory = true;
    } catch (publishError) {
      try {
        if (installedInventory && lstatIfPresent(inventory)) fs.rmSync(inventory, { force: true });
        if (installedStaging && lstatIfPresent(staging)) {
          fs.rmSync(staging, { recursive: true, force: true });
        }
        if (movedInventory && lstatIfPresent(backupInventory)) {
          renameSync(backupInventory, inventory);
        }
        if (movedStaging && lstatIfPresent(backupStaging)) {
          renameSync(backupStaging, staging);
        }
      } catch (rollbackError) {
        preserveTemporary = true;
        throw new Error(
          `snapshot publication failed (${publishError.message}) and rollback failed (${rollbackError.message}); recovery artifacts remain at ${temporary}`
        );
      }
      throw publishError;
    }
  } finally {
    if (!preserveTemporary && lstatIfPresent(temporary)) {
      fs.rmSync(temporary, { recursive: true, force: true });
    }
  }
}

function directoryFiles(root, prefix = '') {
  if (!fs.existsSync(root)) return [];
  if (!prefix) assertDirectory(root, 'tracked staging root');
  const files = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    const absolute = path.join(root, entry.name);
    assert(!entry.isSymbolicLink(), `tracked staging must not contain symlinks: ${relative}`);
    if (entry.isDirectory()) files.push(...directoryFiles(absolute, relative));
    else if (entry.isFile()) files.push(relative);
    else throw new Error(`tracked staging contains a non-regular entry: ${relative}`);
  }
  return files.sort(BYTEWISE);
}

function checkTrackedSnapshot(outputRoot = ROOT, config = DEFAULT_CONFIG) {
  const root = path.resolve(outputRoot);
  const migrationRoot = existingMigrationRoot(root);
  const inventoryPath = path.join(migrationRoot, 'source-inventory.generated.json');
  ensureRegularFile(inventoryPath, 'generated inventory');
  const rawInventory = fs.readFileSync(inventoryPath);
  assert(sha256(rawInventory) === config.inventory_sha256,
    `${INVENTORY_PATH} does not match the approved pinned inventory hash`);
  const inventory = JSON.parse(rawInventory.toString('utf8'));
  const stagingRoot = path.join(migrationRoot, 'staging');
  const expected = new Map();
  expected.set('LICENSE.upstream', inventory.sources[0].license);
  for (const notice of inventory.sources[0].notices) {
    expected.set(path.basename(notice.staged_path), notice);
  }
  for (const skill of inventory.skills) {
    for (const file of skill.source_files) {
      expected.set(file.path.replace(/^skills\//, ''), file);
    }
  }
  const actual = directoryFiles(stagingRoot);
  const expectedPaths = [...expected.keys()].sort(BYTEWISE);
  assert(JSON.stringify(actual) === JSON.stringify(expectedPaths),
    `${STAGING_PATH} file set differs from the approved inventory`);
  for (const relative of expectedPaths) {
    const bytes = fs.readFileSync(path.join(stagingRoot, ...relative.split('/')));
    const record = expected.get(relative);
    assert(bytes.length === record.size && sha256(bytes) === record.sha256,
      `${STAGING_PATH}/${relative} differs from the approved inventory`);
  }
  assertTotals(totalsFor(inventory.skills.flatMap((skill) => skill.source_files)),
    inventory.totals, 'tracked composite source');
  return inventory;
}

function checkSnapshot(snapshot, outputRoot = ROOT) {
  const root = path.resolve(outputRoot);
  const migrationRoot = existingMigrationRoot(root);
  const inventoryPath = path.join(migrationRoot, 'source-inventory.generated.json');
  ensureRegularFile(inventoryPath, 'generated inventory');
  assert(fs.readFileSync(inventoryPath).equals(snapshot.inventoryBytes),
    `${INVENTORY_PATH} is stale; rerun the generator`);

  const stagingRoot = path.join(migrationRoot, 'staging');
  const expected = snapshot.stagedFiles.map((file) => file.path).sort(BYTEWISE);
  const actual = directoryFiles(stagingRoot);
  assert(JSON.stringify(actual) === JSON.stringify(expected),
    `${STAGING_PATH} file set is stale; rerun the generator`);
  const byPath = new Map(snapshot.stagedFiles.map((file) => [file.path, file.bytes]));
  for (const relative of expected) {
    assert(fs.readFileSync(path.join(stagingRoot, ...relative.split('/'))).equals(byPath.get(relative)),
      `${STAGING_PATH}/${relative} differs from the pinned source`);
  }
  return snapshot.inventory;
}

function parseArguments(argv) {
  const options = { check: false, checkTracked: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--check') options.check = true;
    else if (value === '--check-tracked') options.checkTracked = true;
    else if (value === '--source-repo') options.sourceRepo = argv[++index];
    else if (value === '--output-root') options.outputRoot = argv[++index];
    else if (value === '--config') options.configPath = argv[++index];
    else throw new Error(`unknown argument: ${value}`);
  }
  assert(!(options.check && options.checkTracked), '--check and --check-tracked are mutually exclusive');
  for (const field of ['sourceRepo', 'outputRoot', 'configPath']) {
    if (field in options) assert(options[field], `missing value for --${field.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`);
  }
  return options;
}

function main(argv = process.argv.slice(2)) {
  const options = parseArguments(argv);
  const config = options.configPath
    ? JSON.parse(fs.readFileSync(path.resolve(options.configPath), 'utf8'))
    : DEFAULT_CONFIG;
  const outputRoot = path.resolve(options.outputRoot || ROOT);
  if (options.checkTracked) {
    const inventory = checkTrackedSnapshot(outputRoot, config);
    process.stdout.write(`checked tracked ${inventory.totals.skills} skills / ${inventory.totals.skill_files} files\n`);
    return;
  }
  const snapshot = buildSnapshot({ ...options, outputRoot, config });
  const inventory = options.check
    ? checkSnapshot(snapshot, outputRoot)
    : (materialize(snapshot, outputRoot), snapshot.inventory);
  process.stdout.write(`${options.check ? 'checked' : 'generated'} ${inventory.totals.skills} skills / ${inventory.totals.skill_files} files\n`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`generate-skill-manifest: ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  DEFAULT_CONFIG,
  buildSnapshot,
  checkSnapshot,
  checkTrackedSnapshot,
  directoryFiles,
  materialize,
  parseArguments,
  referencedSharedPaths,
  totalsFor
};
