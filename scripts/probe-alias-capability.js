#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const EXPECTED_HOME = path.join(ROOT, '.codex-dev-home');
const FIXTURE_ROOT = path.join(ROOT, 'test', 'fixtures', 'alias-capability', 'plugin');
const COMMITTED_DUMP = path.join(ROOT, 'migration', 'evidence', 'alias-registry-dump.json');
const ALIAS = 'r4-alias-probe';
const MARKER = 'R4_ALIAS_PROBE_INVOKED';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function canonicalJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function codexRunner(home, executable = 'codex') {
  return (args, cwd = ROOT) => execFileSync(executable, args, {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, CODEX_HOME: home },
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 32 * 1024 * 1024
  });
}

function objectWithTitle(value, title) {
  if (!value || typeof value !== 'object') return null;
  if (value.title === title) return value;
  for (const child of Object.values(value)) {
    const found = objectWithTitle(child, title);
    if (found) return found;
  }
  return null;
}

function fields(value) {
  return Object.keys(value?.properties || {}).sort();
}

function readFixture(fixtureRoot = FIXTURE_ROOT) {
  const manifestPath = path.join(fixtureRoot, '.codex-plugin', 'plugin.json');
  const manifestBytes = fs.readFileSync(manifestPath);
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  assert(manifest.name === 'sd0x-alias-capability-fixture',
    'fixture manifest name drift');
  assert(manifest.skills === './skills/', 'fixture manifest skills path drift');
  const skillPath = path.resolve(fixtureRoot, manifest.skills, ALIAS, 'SKILL.md');
  const skillRoot = path.resolve(fixtureRoot, manifest.skills);
  assert(skillPath.startsWith(`${skillRoot}${path.sep}`), 'fixture skill escapes manifest root');
  const skillBytes = fs.readFileSync(skillPath);
  assert(skillBytes.toString('utf8').includes(MARKER), 'fixture skill marker is missing');
  return {
    manifestPath,
    manifestBytes,
    skillPath,
    skillBytes,
    manifestRelative: 'test/fixtures/alias-capability/plugin/.codex-plugin/plugin.json',
    skillRelative: 'test/fixtures/alias-capability/plugin/skills/r4-alias-probe/SKILL.md'
  };
}

function ensureRealDirectory(directory, options = {}) {
  if (options.create && !fs.existsSync(directory)) fs.mkdirSync(directory);
  const stat = fs.lstatSync(directory);
  assert(stat.isDirectory() && !stat.isSymbolicLink(),
    `probe path must be a real directory: ${directory}`);
  return stat;
}

function pathNodeExists(filePath) {
  try {
    fs.lstatSync(filePath);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

function acquireProbeLease(home = EXPECTED_HOME, options = {}) {
  ensureRealDirectory(home);
  const lockParent = path.join(home, '.tmp');
  if (!fs.existsSync(lockParent)) fs.mkdirSync(lockParent);
  ensureRealDirectory(lockParent);
  const lockPath = path.join(lockParent, 'r4-alias-probe.lock');
  fs.mkdirSync(lockPath);
  const lockIdentity = identity(fs.lstatSync(lockPath));
  const nonce = crypto.randomUUID();
  const ownerPath = path.join(lockPath, 'owner');
  const ownerBytes = Buffer.from(`${process.pid}:${nonce}\n`);
  let ownerFd = null;
  let ownerIdentity = null;
  try {
    ownerFd = (options.openOwner || fs.openSync)(ownerPath,
      fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL, 0o600);
    ownerIdentity = identity(fs.fstatSync(ownerFd));
    (options.writeOwner || fs.writeFileSync)(ownerFd, ownerBytes);
    fs.fsyncSync(ownerFd);
    fs.closeSync(ownerFd);
    ownerFd = null;
  } catch (error) {
    if (ownerFd !== null) {
      try {
        fs.closeSync(ownerFd);
      } catch {
        // The captured inode below remains the authority for path cleanup.
      }
      ownerFd = null;
    }
    try {
      const ownerStat = fs.lstatSync(ownerPath);
      if (ownerIdentity && ownerStat.isFile() && !ownerStat.isSymbolicLink() &&
          sameIdentity(ownerStat, ownerIdentity)) fs.unlinkSync(ownerPath);
    } catch (ownerError) {
      if (ownerError.code !== 'ENOENT') throw ownerError;
    }
    try {
      const rollbackLock = fs.lstatSync(lockPath);
      if (rollbackLock.isDirectory() && !rollbackLock.isSymbolicLink() &&
          sameIdentity(rollbackLock, lockIdentity) &&
          fs.readdirSync(lockPath).length === 0) fs.rmdirSync(lockPath);
    } catch (cleanupError) {
      if (!['ENOENT', 'ENOTEMPTY'].includes(cleanupError.code)) throw cleanupError;
    }
    throw error;
  }
  return {
    lockPath,
    lockIdentity,
    ownerPath,
    ownerIdentity,
    ownerBytes,
    nonce,
    releaseContainer: path.join(lockParent, `r4-alias-probe.release-${nonce}`)
  };
}

function releaseProbeLease(lease, options = {}) {
  const lockStat = fs.lstatSync(lease.lockPath);
  assert(lockStat.isDirectory() && !lockStat.isSymbolicLink() &&
    sameIdentity(lockStat, lease.lockIdentity), 'probe lock directory identity changed');
  const ownerStat = fs.lstatSync(lease.ownerPath);
  assert(ownerStat.isFile() && !ownerStat.isSymbolicLink() &&
    sameIdentity(ownerStat, lease.ownerIdentity) &&
    fs.readFileSync(lease.ownerPath).equals(lease.ownerBytes),
  'probe lease owner identity changed');
  assert(JSON.stringify(fs.readdirSync(lease.lockPath).sort()) ===
    JSON.stringify(['owner']), 'probe lease directory manifest changed');
  fs.mkdirSync(lease.releaseContainer);
  const payload = path.join(lease.releaseContainer, 'payload');
  fs.renameSync(lease.lockPath, payload);
  if (typeof options.afterQuarantine === 'function') {
    options.afterQuarantine({ lease, payload });
  }
  const movedOwner = path.join(payload, 'owner');
  const movedLockStat = fs.lstatSync(payload);
  const movedOwnerStat = fs.lstatSync(movedOwner);
  const stillOwned = movedLockStat.isDirectory() && !movedLockStat.isSymbolicLink() &&
    sameIdentity(movedLockStat, lease.lockIdentity) &&
    movedOwnerStat.isFile() && !movedOwnerStat.isSymbolicLink() &&
    sameIdentity(movedOwnerStat, lease.ownerIdentity) &&
    fs.readFileSync(movedOwner).equals(lease.ownerBytes) &&
    JSON.stringify(fs.readdirSync(payload).sort()) === JSON.stringify(['owner']);
  if (!stillOwned) {
    if (!pathNodeExists(lease.lockPath)) {
      try {
        fs.renameSync(payload, lease.lockPath);
        fs.rmdirSync(lease.releaseContainer);
      } catch {
        // Preserve the complete moved lock when a concurrent path blocks restore.
      }
    }
    throw new Error('probe lease identity changed during release');
  }
  const foreignReplacement = pathNodeExists(lease.lockPath);
  fs.unlinkSync(movedOwner);
  fs.rmdirSync(payload);
  fs.rmdirSync(lease.releaseContainer);
  assert(!foreignReplacement, 'probe lock path was replaced during release');
}

function identity(stat) {
  return { dev: stat.dev, ino: stat.ino };
}

function sameIdentity(stat, expected) {
  return stat.dev === expected.dev && stat.ino === expected.ino;
}

function installFixtureSkill(fixture, home = EXPECTED_HOME, lease = null) {
  const skillsRoot = path.join(home, 'skills');
  if (!fs.existsSync(skillsRoot)) fs.mkdirSync(skillsRoot);
  ensureRealDirectory(skillsRoot);
  const directory = path.join(skillsRoot, ALIAS);
  fs.mkdirSync(directory);
  const directoryIdentity = identity(fs.lstatSync(directory));
  const filePath = path.join(directory, 'SKILL.md');
  try {
    fs.copyFileSync(fixture.skillPath, filePath, fs.constants.COPYFILE_EXCL);
  } catch (error) {
    try {
      fs.rmdirSync(directory);
    } catch (cleanupError) {
      if (!['ENOENT', 'ENOTEMPTY'].includes(cleanupError.code)) throw cleanupError;
    }
    throw error;
  }
  const fileStat = fs.lstatSync(filePath);
  assert(fileStat.isFile() && !fileStat.isSymbolicLink(),
    'installed probe skill must be a regular file');
  return {
    directory,
    directoryIdentity,
    filePath,
    fileIdentity: identity(fileStat),
    quarantineContainer: lease
      ? path.join(lease.lockPath, `quarantine-${lease.nonce}`)
      : null,
    sha256: sha256(fixture.skillBytes)
  };
}

function validateInstallation(installation) {
  try {
    const directoryStat = fs.lstatSync(installation.directory);
    const fileStat = fs.lstatSync(installation.filePath);
    return directoryStat.isDirectory() && !directoryStat.isSymbolicLink() &&
      sameIdentity(directoryStat, installation.directoryIdentity) &&
      fileStat.isFile() && !fileStat.isSymbolicLink() &&
      sameIdentity(fileStat, installation.fileIdentity) &&
      sha256(fs.readFileSync(installation.filePath)) === installation.sha256 &&
      JSON.stringify(fs.readdirSync(installation.directory).sort()) ===
        JSON.stringify(['SKILL.md']);
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

function cleanupFixtureSkill(installation, options = {}) {
  if (!validateInstallation(installation) || !installation.quarantineContainer) return false;
  if (typeof options.beforeQuarantine === 'function') options.beforeQuarantine(installation);
  fs.mkdirSync(installation.quarantineContainer);
  const payload = path.join(installation.quarantineContainer, 'payload');
  try {
  fs.renameSync(installation.directory, payload);
  if (typeof options.afterQuarantine === 'function') {
    options.afterQuarantine({ installation, payload });
  }
  } catch (error) {
    try {
      fs.rmdirSync(installation.quarantineContainer);
    } catch (cleanupError) {
      if (cleanupError.code !== 'ENOTEMPTY') throw cleanupError;
    }
    return false;
  }
  const movedFile = path.join(payload, 'SKILL.md');
  let owned = false;
  try {
    const directoryStat = fs.lstatSync(payload);
    const fileStat = fs.lstatSync(movedFile);
    owned = directoryStat.isDirectory() && !directoryStat.isSymbolicLink() &&
      sameIdentity(directoryStat, installation.directoryIdentity) &&
      fileStat.isFile() && !fileStat.isSymbolicLink() &&
      sameIdentity(fileStat, installation.fileIdentity) &&
      sha256(fs.readFileSync(movedFile)) === installation.sha256 &&
      JSON.stringify(fs.readdirSync(payload).sort()) === JSON.stringify(['SKILL.md']);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (!owned) {
    if (!pathNodeExists(installation.directory)) {
      try {
        fs.renameSync(payload, installation.directory);
        fs.rmdirSync(installation.quarantineContainer);
      } catch {
        // Preserve the complete quarantined directory when a concurrent path blocks restore.
      }
    }
    return false;
  }
  fs.unlinkSync(movedFile);
  fs.rmdirSync(payload);
  fs.rmdirSync(installation.quarantineContainer);
  return true;
}

function markerFromJsonl(output) {
  const messages = [];
  for (const line of output.split('\n')) {
    if (!line.trim()) continue;
    const event = JSON.parse(line);
    if (event.type === 'item.completed' && event.item?.type === 'agent_message') {
      messages.push(event.item.text);
    }
  }
  return messages.some((message) => message.trim() === MARKER);
}

function buildDump(input) {
  const { codexVersion, fixture, metadata, skillInterface, config, skillInput,
    explicitText, neutralText, markerObserved } = input;
  const exclusionFields = [...new Set([
    ...fields(metadata), ...fields(skillInterface), ...fields(config), ...fields(skillInput)
  ].filter((field) => /implicit|automatic|candidate|exclude/i.test(field)))].sort();
  const dump = {
    schema_version: 1,
    codex_version: codexVersion,
    normalized: true,
    redactions: {
      absolute_paths: 'removed',
      account_data: 'removed'
    },
    fixture: {
      alias: ALIAS,
      manifest_path: fixture.manifestRelative,
      manifest_sha256: sha256(fixture.manifestBytes),
      skill_path: fixture.skillRelative,
      skill_sha256: sha256(fixture.skillBytes)
    },
    registry_schema: {
      source: 'codex app-server generate-json-schema --experimental',
      skills_list_metadata_fields: fields(metadata),
      skills_list_interface_fields: fields(skillInterface),
      skills_config_write_fields: fields(config),
      explicit_invocation_input_fields: fields(skillInput),
      automatic_candidate_exclusion_fields: exclusionFields
    },
    observations: {
      manual_invocation: {
        supported: markerObserved,
        selector: `$${ALIAS}`,
        evidence: `An isolated ephemeral read-only codex exec returned the exact ${MARKER} fixture marker.`
      },
      implicit_routing: {
        candidate_source: 'Every enabled skill description in the model-visible skill catalog',
        evidence: 'Official Codex documentation states that implicit invocation matches the skill description.'
      },
      manual_only_exclusion: {
        supported: false,
        inspectable_mechanism: null,
        evidence: exclusionFields.length === 0
          ? 'SkillMetadata and SkillInterface expose no implicit-routing exclusion field; SkillsConfigWrite exposes only the whole-skill enabled flag.'
          : 'Candidate-like fields exist, but no behavior test proves that they exclude implicit routing while preserving explicit invocation.'
      },
      negative_prompt_regression: {
        role: 'negative-only',
        can_upgrade_policy: false
      },
      repository_probe: {
        explicit_selector_present: explicitText.includes(`$${ALIAS}`),
        explicit_catalog_has_alias: explicitText.includes(`- ${ALIAS}:`),
        neutral_catalog_has_alias: neutralText.includes(`- ${ALIAS}:`),
        manual_invocation_marker_observed: markerObserved,
        user_or_account_data_retained: false,
        absolute_paths_retained: false
      }
    },
    conclusion: 'The repository-only fixture is explicitly invokable but remains in the model-visible catalog for neutral prompts, and no inspectable registry mechanism separates explicit invocation from implicit routing candidates in this Codex version.'
  };
  const normalizedBeforePrivacy = JSON.stringify(dump);
  dump.observations.repository_probe.user_or_account_data_retained =
    /@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(normalizedBeforePrivacy);
  dump.observations.repository_probe.absolute_paths_retained =
    /(?:\/Users\/|\/home\/|[A-Za-z]:\\\\)/.test(normalizedBeforePrivacy);
  return dump;
}

function runProbe(options = {}) {
  const home = options.home || EXPECTED_HOME;
  const fixtureRoot = options.fixtureRoot || FIXTURE_ROOT;
  const committedDump = options.committedDump || COMMITTED_DUMP;
  const runCodex = options.runCodex || codexRunner(home);
  const fixture = readFixture(fixtureRoot);
  const temporary = (options.makeTemporary || fs.mkdtempSync)(path.join(
    options.temporaryRoot || os.tmpdir(), 'sd0x-alias-probe-'
  ));
  let lease = null;
  let installation = null;
  let cleanupFailure = false;
  try {
    lease = acquireProbeLease(home, options.leaseOptions);
    installation = installFixtureSkill(fixture, home, lease);
    assert(validateInstallation(installation), 'installed fixture identity drifted');
    const schemaOut = path.join(temporary, 'schema');
    runCodex(['app-server', 'generate-json-schema', '--experimental', '--out', schemaOut]);
    const schemas = path.join(schemaOut, 'v2');
    const list = JSON.parse(fs.readFileSync(path.join(schemas, 'SkillsListResponse.json')));
    const config = JSON.parse(fs.readFileSync(path.join(schemas, 'SkillsConfigWriteParams.json')));
    const turn = JSON.parse(fs.readFileSync(path.join(schemas, 'TurnStartParams.json')));
    const explicitText = JSON.stringify(JSON.parse(runCodex([
      'debug', 'prompt-input', `$${ALIAS}`
    ])));
    assert(validateInstallation(installation), 'fixture drifted before catalog probe');
    const neutralText = JSON.stringify(JSON.parse(runCodex([
      'debug', 'prompt-input', 'Summarize the repository status.'
    ])));
    const executionRoot = path.join(temporary, 'execution');
    fs.mkdirSync(executionRoot);
    const execution = runCodex([
      'exec', '--ephemeral', '--sandbox', 'read-only', '--json',
      '--skip-git-repo-check', '-C', executionRoot,
      `$${ALIAS} Follow the skill exactly and respond with only its required output.`
    ], executionRoot);
    if (typeof options.afterExecution === 'function') {
      options.afterExecution({ installation, lease });
    }
    assert(validateInstallation(installation), 'fixture drifted during execution');
    const dump = buildDump({
      codexVersion: runCodex(['--version']).trim(),
      fixture,
      metadata: list.definitions.SkillMetadata,
      skillInterface: list.definitions.SkillInterface,
      config,
      skillInput: objectWithTitle(turn, 'SkillUserInput'),
      explicitText,
      neutralText,
      markerObserved: markerFromJsonl(execution)
    });
    assert(dump.observations.manual_invocation.supported,
      'manual invocation did not return the exact fixture marker');
    assert(dump.observations.repository_probe.explicit_selector_present &&
      dump.observations.repository_probe.explicit_catalog_has_alias &&
      dump.observations.repository_probe.neutral_catalog_has_alias,
    'repository catalogs do not prove explicit and implicit candidate visibility');
    assert(!dump.observations.repository_probe.user_or_account_data_retained &&
      !dump.observations.repository_probe.absolute_paths_retained,
    'normalized dump retains private path or account data');
    const output = canonicalJson(dump);
    if (options.check) {
      assert(fs.readFileSync(committedDump, 'utf8') === output,
        'fresh normalized registry dump differs from committed evidence');
    }
    return { dump, output };
  } finally {
    try {
      if (installation && !cleanupFixtureSkill(installation)) cleanupFailure = true;
    } finally {
      try {
        if (lease) releaseProbeLease(lease);
      } finally {
        fs.rmSync(temporary, { recursive: true, force: true });
      }
    }
    if (cleanupFailure) throw new Error('probe fixture cleanup lost ownership or found foreign paths');
  }
}

function main(argv = process.argv.slice(2)) {
  if (process.env.CODEX_HOME && path.resolve(process.env.CODEX_HOME) !== EXPECTED_HOME) {
    throw new Error(`CODEX_HOME must equal repository-only ${EXPECTED_HOME}`);
  }
  assert(argv.length === 0 || (argv.length === 1 && argv[0] === '--check'),
    'usage: probe-alias-capability.js [--check]');
  const result = runProbe({ check: argv[0] === '--check' });
  process.stdout.write(result.output);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`alias-capability-probe: ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  acquireProbeLease,
  buildDump,
  cleanupFixtureSkill,
  fields,
  installFixtureSkill,
  markerFromJsonl,
  objectWithTitle,
  releaseProbeLease,
  runProbe,
  validateInstallation
};
