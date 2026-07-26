#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { openBoundDirectory } = require('./bound-directory');
const { atomicWriteContainedFile } = require('./contained-file');
const { captureRegularTree } = require('./promote-skill-wave');
const { createRecoveryDirectory } = require('./recovery-directory');
const {
  routingContractBlock,
  routingDescription,
  routingTestSource
} = require('./skill-routing-test');

const ROOT = path.resolve(__dirname, '..');
const PLAN_PATH = path.join(ROOT, 'scripts', 'skill-wave-plans.json');
const DISPOSITION_PATH = path.join(ROOT, 'migration', 'source-disposition.json');
const AUTHORIZATION_POLICY = 'later-turn-separate-explicit-user-approval-v1';
const BYTEWISE = (left, right) => Buffer.from(left).compare(Buffer.from(right));

function fail(message) {
  throw new Error(message);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeText(filePath, bytes, options = {}) {
  atomicWriteContainedFile(options.root || ROOT, filePath, bytes, options);
}

function canonicalJson(value) {
  const canonical = (item) => {
    if (Array.isArray(item)) return item.map(canonical);
    if (item && typeof item === 'object') {
      return Object.fromEntries(Object.keys(item).sort().map((key) => [
        key, canonical(item[key])
      ]));
    }
    return item;
  };
  return `${JSON.stringify(canonical(value), null, 2)}\n`;
}

function sorted(values) {
  return [...new Set(values)].sort(BYTEWISE);
}

function normalizedRouting(routing) {
  return {
    negative_boundaries: sorted(routing.negative_boundaries),
    positive_triggers: sorted(routing.positive_triggers)
  };
}

function parseArgs(argv) {
  const [wave] = argv;
  if (!/^[1-7]$/.test(wave || '') || argv.length !== 1) {
    fail('usage: prepare-skill-wave.js <wave>');
  }
  return wave;
}

function requestSlug(unit) {
  return unit.replace('/', '-');
}

function requestPath(wave, date, unit, targetPackage) {
  const action = targetPackage === 'core' ? 'promotion' : 'pack-ready';
  return `docs/features/skill-toolkit-migration/requests/${date}-wave${wave}-${requestSlug(unit)}-${action}.md`;
}

function requestTitle(wave, unit, targetPackage) {
  const label = unit.split('/').map((value) =>
    value.split('-').map((part) =>
      `${part.charAt(0).toUpperCase()}${part.slice(1)}`
    ).join(' ')
  ).join(' ');
  return `Wave ${wave} ${label} ${targetPackage === 'core' ? 'Core Promotion' : 'Pack Readiness'}`;
}

function renderRequest(wave, plan, target, unit, request) {
  const aliases = unit.source_names.filter((source) => source !== target.target);
  const dependencies = [
    `[R4 — Alias Registry Capability](${plan.dependency})`
  ];
  if (unit.target_mode !== null) {
    const defaultUnit = target.units.find((entry) => entry.target_mode === null);
    if (!defaultUnit) fail(`${unit.promotion_unit_id}: mode target requires a default unit`);
    const defaultRequest = requestPath(
      wave, plan.date, defaultUnit.promotion_unit_id, target.target_package
    );
    dependencies.push(
      `[${requestTitle(wave, defaultUnit.promotion_unit_id, target.target_package)}]` +
      `(./${path.posix.basename(defaultRequest)})`
    );
  }
  const finalPath = target.target_package === 'core'
    ? `plugin/sd0x-dev-flow-codex/skills/${target.target}/`
    : `migration/packs/${target.target_package}/${target.target}/`;
  const action = target.target_package === 'core' ? 'promote' : 'prepare';
  return [
    `# ${requestTitle(wave, unit.promotion_unit_id, target.target_package)}`,
    '',
    '> **Doc class**: Request ticket (date-prefixed non-lifecycle)',
    `> **Created**: ${plan.date}`,
    `> **Implementation Base SHA**: \`${plan.implementation_base_sha}\``,
    '> **Status**: In Progress',
    '> **Priority**: P0',
    `> **Depends On**: ${dependencies.join(', ')}`,
    '> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)',
    '',
    '## Background',
    '',
    `${unit.source_names.map((source) => `\`${source}\``).join(' and ')} source behavior is assigned to the canonical \`${unit.promotion_unit_id}\` owner. This ticket owns that exact promotion unit and its Codex-native delivery evidence.`,
    '',
    '## Requirements',
    '',
    `- Preserve the bounded ${target.summary} workflow while replacing source-runtime assumptions with Codex-native tools, authority, and evidence contracts.`,
    `- Keep \`${unit.promotion_unit_id}\` as the only positive owner for its exact prompt contract.`,
    ...(aliases.length > 0
      ? [`- Keep ${aliases.map((source) => `\`${source}\``).join(', ')} mapping-only without discovered compatibility entrypoints.`]
      : []),
    '',
    '## Scope',
    '',
    '| Scope | Description |',
    '|---|---|',
    `| In | Audit and ${action} the \`${unit.promotion_unit_id}\` payload, routing contract, and durable completion evidence. |`,
    '| Out | Other wave units, compatibility entrypoints, and publication of separate pack repositories |',
    '',
    '## Related Files',
    '',
    '| File | Action | Description |',
    '|---|---|---|',
    `| \`migration/staging/${unit.source_names[0]}/\` | Read | Canonical source evidence |`,
    `| \`migration/candidates/${target.target}/\` | New | Audited Codex-native candidate |`,
    `| \`${finalPath}\` | ${target.target_package === 'core' ? 'Update' : 'New'} | Final ${target.target_package} payload |`,
    `| \`test/${unit.promotion_unit_id.replace('/', '-')}-routing.test.js\` | New | Trusted routing contract |`,
    '| `migration/source-disposition.json` | Update | Unit ownership and delivery evidence |',
    '',
    '## Acceptance Criteria',
    '',
    `- [ ] Candidate preserves the complete ${target.summary} workflow and its meaningful failure boundaries.`,
    '- [ ] Contract binds every assigned source name to this single canonical promotion unit.',
    '- [ ] Compatibility aliases remain mapping-only and add no discovered skill entrypoints.',
    '- [ ] Trusted routing tests distinguish positive prompts from adjacent skill boundaries.',
    '- [ ] Candidate preflight binds exact payload and behavioral-test identity.',
    `- [ ] Final ${target.target_package === 'core' ? 'core' : 'pack'} destination and move-window comparison are fixed for the accepted candidate bytes.`,
    '- [ ] R3 closure inputs identify this exact request, promotion unit, evidence kind, and final-fingerprint fields.',
    '',
    '## Progress',
    '',
    '| Phase | Status | Note |',
    '|---|---|---|',
    '| Analysis | Complete | Source ownership, mode boundary, and target package are fixed by the migration registry. |',
    '| Development | In Progress | Codex-native candidate and closed behavior contract are being prepared. |',
    '| Testing | Pending | Candidate preflight and final audit evidence are not recorded yet. |',
    '| Acceptance | Pending | Durable request closure and completion evidence are not recorded yet. |',
    '',
    '## References',
    '',
    '- Tech Spec: [Skill Toolkit Migration](../2-tech-spec.md)',
    ''
  ].join('\n');
}

function stripFrontmatter(text) {
  const match = /^---\n[\s\S]*?\n---\n?/.exec(text);
  if (!match) fail('preserved SKILL.md requires frontmatter');
  return text.slice(match[0].length)
    .replace(
      'native `SubagentStart`/`SubagentStop` hooks remain authoritative where supported',
      'native reviewer lifecycle evidence remains authoritative where supported'
    )
    .replace(
      'The MCP PostToolUse hook records the structured Claude evidence',
      'The nested Claude evidence recorder stores the structured result'
    )
    .replace(
      'This keeps the gate failed while allowing the Stop hook to yield.',
      'This keeps the gate failed while allowing the review lifecycle to yield.'
    )
    .replace(
      'Ask the user before running `$sd0x-dev-flow-codex:reset`',
      'Ask the user before running the sd0x Dev Flow reset skill'
    )
    .trim();
}

function renderSkill(target, preservedBody = null) {
  const registry = target.units.map((unit) => ({
    unit: unit.promotion_unit_id,
    routing: normalizedRouting(unit.routing)
  }));
  if (!Array.isArray(target.body_lines) ||
      target.body_lines.some((line) => typeof line !== 'string')) {
    fail(`${target.target}: body_lines must be an array of strings`);
  }
  let body = target.body_lines.join('\n').trim();
  if (target.preserve_live_body) {
    if (typeof preservedBody !== 'string') {
      fail(`${target.target}: preserved live body snapshot is unavailable`);
    }
    body = `${stripFrontmatter(preservedBody)}\n\n${body}`;
  }
  return [
    '---',
    `name: ${target.target}`,
    `description: ${routingDescription(target.target, registry)}`,
    '---',
    '',
    body,
    '',
    ...registry.flatMap((entry) => [
      routingContractBlock(entry.unit, entry.routing),
      ''
    ])
  ].join('\n');
}

function statIdentity(stat) {
  return [stat.dev, stat.ino, stat.mode, stat.size].map(String).join(':');
}

function assertPreservedSnapshot(liveRoot, snapshot) {
  if (JSON.stringify(captureRegularTree(liveRoot)) !== JSON.stringify(snapshot)) {
    fail(`preserved resource tree changed during copy: ${liveRoot}`);
  }
}

function readCapturedFile(parent, name, entry) {
  return parent.run((child) => {
    const descriptor = fs.openSync(child(name),
      fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
    try {
      const opened = fs.fstatSync(descriptor, { bigint: true });
      if (!opened.isFile() || statIdentity(opened) !== entry.identity) {
        fail(`preserved resource identity changed before copy: ${entry.relative}`);
      }
      const bytes = fs.readFileSync(descriptor);
      const digest = crypto.createHash('sha256').update(bytes).digest('hex');
      if (digest !== entry.sha256) {
        fail(`preserved resource content changed before copy: ${entry.relative}`);
      }
      return bytes;
    } finally {
      fs.closeSync(descriptor);
    }
  });
}

function capturePreservedLive(target) {
  if (!target.preserve_live_body && !target.preserve_live_resources) return null;
  const liveRoot = path.join(
    ROOT, 'plugin', 'sd0x-dev-flow-codex', 'skills', target.target
  );
  const snapshot = captureRegularTree(liveRoot);
  const rootStat = fs.lstatSync(liveRoot, { throwIfNoEntry: false });
  if (!rootStat || rootStat.isSymbolicLink() || !rootStat.isDirectory() ||
      statIdentity(rootStat) !== snapshot.root) {
    fail(`${target.target}: preserved live root changed during capture`);
  }
  const rootDirectory = openBoundDirectory(liveRoot, { identity: rootStat });
  try {
    const skill = snapshot.entries.find((entry) =>
      entry.relative === 'SKILL.md' && entry.kind === 'file');
    if (target.preserve_live_body && !skill) {
      fail(`${target.target}: preserved SKILL.md is unavailable`);
    }
    const body = skill ? readCapturedFile(rootDirectory, 'SKILL.md', skill)
      .toString('utf8') : null;
    assertPreservedSnapshot(liveRoot, snapshot);
    return { liveRoot, snapshot, body, rootStat };
  } finally {
    rootDirectory.close();
  }
}

function copyPreservedLiveFiles(target, candidateDirectory, preserved, hooks = {}) {
  if (!preserved || !target.preserve_live_resources) return;
  const { liveRoot, snapshot, rootStat } = preserved;
  const sourceRoot = openBoundDirectory(liveRoot, { identity: rootStat });
  const opened = [sourceRoot];
  const sources = new Map([['', sourceRoot]]);
  const destinations = new Map([['', candidateDirectory]]);
  try {
    for (const entry of snapshot.entries) {
      const top = entry.relative.split('/')[0];
      if (top === 'SKILL.md' || top === 'migration-contract.json') continue;
      const parentRelative = path.posix.dirname(entry.relative) === '.'
        ? ''
        : path.posix.dirname(entry.relative);
      const sourceParent = sources.get(parentRelative);
      const destinationParent = destinations.get(parentRelative);
      if (!sourceParent || !destinationParent) {
        fail(`preserved resource parent is unavailable: ${entry.relative}`);
      }
      const name = path.posix.basename(entry.relative);
      if (entry.kind === 'directory') {
        const sourceIdentity = sourceParent.run((child) => {
          const stat = fs.lstatSync(child(name), { throwIfNoEntry: false });
          if (!stat || stat.isSymbolicLink() || !stat.isDirectory() ||
              statIdentity(stat) !== entry.identity) {
            fail(`preserved directory changed before copy: ${entry.relative}`);
          }
          return stat;
        });
        let destinationIdentity;
        destinationParent.run((child) => {
          const destination = child(name);
          fs.mkdirSync(destination);
          destinationIdentity = fs.lstatSync(destination);
        });
        const source = openBoundDirectory(
          path.join(liveRoot, ...entry.relative.split('/')),
          { identity: sourceIdentity }
        );
        const destination = openBoundDirectory(
          path.join(candidateDirectory.directory, ...entry.relative.split('/')),
          { identity: destinationIdentity }
        );
        opened.push(source, destination);
        sources.set(entry.relative, source);
        destinations.set(entry.relative, destination);
        if (typeof hooks.afterSourceDirectoryOpen === 'function') {
          hooks.afterSourceDirectoryOpen({ relative: entry.relative });
        }
      } else {
        if (typeof hooks.beforeSourceFileRead === 'function') {
          hooks.beforeSourceFileRead({ relative: entry.relative });
        }
        const bytes = readCapturedFile(sourceParent, name, entry);
        destinationParent.run((child) =>
          fs.writeFileSync(child(name), bytes, { flag: 'wx' }));
      }
      if (typeof hooks.afterEntryCopy === 'function') {
        hooks.afterEntryCopy({ relative: entry.relative });
      }
    }
    assertPreservedSnapshot(liveRoot, snapshot);
  } finally {
    for (const directory of opened.reverse()) {
      if (directory !== candidateDirectory) directory.close();
    }
  }
}

function captureContainedDirectory(root, directory, label) {
  const rootReal = fs.realpathSync(root);
  const relative = path.relative(root, directory);
  if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relative)) {
    fail(`${label} must be a contained descendant`);
  }
  let current = root;
  for (const part of relative.split(path.sep)) {
    current = path.join(current, part);
    const stat = fs.lstatSync(current, { throwIfNoEntry: false });
    if (!stat || stat.isSymbolicLink() || !stat.isDirectory()) {
      fail(`${label} path ancestors must be real directories: ${current}`);
    }
    const resolved = fs.realpathSync(current);
    const containment = path.relative(rootReal, resolved);
    if (containment === '..' || containment.startsWith(`..${path.sep}`) ||
        path.isAbsolute(containment)) {
      fail(`${label} escapes the repository: ${current}`);
    }
  }
}

function withPreparedCandidateDirectory(root, target, callback, options = {}) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(target || '')) {
    fail('candidate target must be canonical');
  }
  const migration = path.join(root, 'migration');
  captureContainedDirectory(root, migration, 'candidate preparation');
  const migrationDirectory = openBoundDirectory(migration);
  const candidates = path.join(migration, 'candidates');
  try {
    migrationDirectory.run((child) => {
      const name = child('candidates');
      const existing = fs.lstatSync(name, { throwIfNoEntry: false });
      if (!existing) fs.mkdirSync(name);
      else if (existing.isSymbolicLink() || !existing.isDirectory()) {
        fail('candidate preparation path ancestors must be real directories');
      }
    });
  } finally {
    migrationDirectory.close();
  }
  captureContainedDirectory(root, candidates, 'candidate preparation');
  const candidatesDirectory = openBoundDirectory(candidates);
  const candidateRoot = path.join(candidates, target);
  let identity;
  const hadExisting = candidatesDirectory.run((child) => {
    const existing = fs.lstatSync(child(target), { throwIfNoEntry: false });
    if (existing && (existing.isSymbolicLink() || !existing.isDirectory())) {
      fail(`${target}: existing candidate must be a real directory`);
    }
    return Boolean(existing);
  });
  const retirement = hadExisting
    ? createRecoveryDirectory(root, 'candidate-preparation-')
    : null;
  try {
    candidatesDirectory.run((child) => {
      const name = child(target);
      const existing = fs.lstatSync(name, { throwIfNoEntry: false });
      if (hadExisting) {
        if (!existing || existing.isSymbolicLink() || !existing.isDirectory()) {
          fail(`${target}: existing candidate changed before retirement`);
        }
        if (typeof options.afterCandidateCapture === 'function') {
          options.afterCandidateCapture({ candidate: candidateRoot });
        }
        retirement.assertSafe();
        const retiredCandidate = path.join(retirement.directory, 'retired-candidate');
        fs.renameSync(name, retiredCandidate);
        if (typeof options.afterCandidateQuarantine === 'function') {
          options.afterCandidateQuarantine({ retiredCandidate });
        }
        retirement.run(() => {
          const moved = fs.lstatSync('retired-candidate', {
            throwIfNoEntry: false
          });
          if (!moved || moved.isSymbolicLink() || !moved.isDirectory() ||
              moved.dev !== existing.dev || moved.ino !== existing.ino) {
            fail(`${target}: retired candidate identity changed after quarantine`);
          }
          fs.writeFileSync('retirement.json', `${JSON.stringify({
            schema_version: 1,
            target,
            retired_candidate: 'retired-candidate',
            original_identity: {
              dev: String(existing.dev),
              ino: String(existing.ino)
            }
          }, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
        });
      } else if (existing) {
        fail(`${target}: candidate appeared during preparation`);
      }
      fs.mkdirSync(name);
      identity = fs.lstatSync(name);
    });
    const candidateDirectory = openBoundDirectory(candidateRoot, { identity });
    try {
      return candidateDirectory.run(() => callback(candidateRoot, candidateDirectory));
    } finally {
      candidateDirectory.close();
    }
  } finally {
    candidatesDirectory.close();
  }
}

function renderContract(target) {
  return {
    schema_version: 1,
    target_skill: target.target,
    target_package: target.target_package,
    authorization: {
      policy: AUTHORIZATION_POLICY,
      sensitive_operations: []
    },
    units: target.units.map((unit) => ({
      promotion_unit_id: unit.promotion_unit_id,
      target_mode: unit.target_mode,
      source_names: unit.source_names,
      routing: normalizedRouting(unit.routing),
      behavior_tests: [
        `test/${unit.promotion_unit_id.replace('/', '-')}-routing.test.js`
      ]
    }))
  };
}

function main(argv = process.argv.slice(2)) {
  const wave = parseArgs(argv);
  const plans = readJson(PLAN_PATH);
  if (plans.schema_version !== 1 || !plans.waves?.[wave]) {
    fail(`wave ${wave} plan is unavailable`);
  }
  const plan = plans.waves[wave];
  const disposition = readJson(DISPOSITION_PATH);
  const seenUnits = new Set();
  for (const target of plan.targets) {
    target.units.sort((left, right) =>
      BYTEWISE(left.promotion_unit_id, right.promotion_unit_id)
    );
    const preserved = capturePreservedLive(target);
    withPreparedCandidateDirectory(ROOT, target.target,
      (_candidateRoot, candidateDirectory) => {
        copyPreservedLiveFiles(target, candidateDirectory, preserved);
        fs.writeFileSync(candidateDirectory.child('SKILL.md'),
          renderSkill(target, preserved?.body), {
          flag: 'wx'
        });
        fs.writeFileSync(candidateDirectory.child('migration-contract.json'),
          canonicalJson(renderContract(target)), { flag: 'wx' });
      });
    const registry = target.units.map((unit) => ({
      unit: unit.promotion_unit_id,
      routing: normalizedRouting(unit.routing)
    }));
    for (const unit of target.units) {
      if (seenUnits.has(unit.promotion_unit_id)) {
        fail(`duplicate plan unit: ${unit.promotion_unit_id}`);
      }
      seenUnits.add(unit.promotion_unit_id);
      const rows = disposition.skills.filter((row) =>
        row.promotion_unit_id === unit.promotion_unit_id
      );
      if (rows.length === 0) fail(`missing disposition unit: ${unit.promotion_unit_id}`);
      const request = requestPath(
        wave, plan.date, unit.promotion_unit_id, target.target_package
      );
      const expectedSources = rows.map((row) => row.source_name).sort(BYTEWISE);
      if (JSON.stringify(expectedSources) !== JSON.stringify(unit.source_names)) {
        fail(`${unit.promotion_unit_id}: plan source names differ from disposition`);
      }
      for (const row of rows) {
        if (row.delivery_state === 'candidate' &&
            row.promotion_request !== request) {
          fail(`${unit.promotion_unit_id}: active candidate belongs to another request`);
        }
        if (!['planned', 'candidate'].includes(row.delivery_state)) {
          fail(`${unit.promotion_unit_id}: expected planned or matching candidate state`);
        }
        row.delivery_state = 'candidate';
        row.capabilities = sorted(target.capabilities);
        row.operations = sorted(target.operations);
        row.promotion_request = request;
      }
      writeText(path.join(ROOT, request),
        renderRequest(wave, plan, target, unit, request));
      writeText(path.join(
        ROOT, 'test', `${unit.promotion_unit_id.replace('/', '-')}-routing.test.js`
      ), routingTestSource({
        target: target.target,
        targetPackage: target.target_package,
        unit: unit.promotion_unit_id,
        registry,
        routing: normalizedRouting(unit.routing)
      }));
    }
  }
  writeText(DISPOSITION_PATH, `${JSON.stringify(disposition, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({
    ok: true,
    wave: Number(wave),
    targets: plan.targets.length,
    units: seenUnits.size
  }, null, 2)}\n`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`prepare-skill-wave: ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  capturePreservedLive,
  copyPreservedLiveFiles,
  main,
  renderContract,
  renderRequest,
  renderSkill,
  withPreparedCandidateDirectory,
  writeText
};
