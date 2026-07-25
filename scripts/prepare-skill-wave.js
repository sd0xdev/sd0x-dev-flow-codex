#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
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

function writeText(filePath, bytes) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, bytes);
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

function renderSkill(target) {
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
    const live = path.join(
      ROOT, 'plugin', 'sd0x-dev-flow-codex', 'skills', target.target, 'SKILL.md'
    );
    body = `${stripFrontmatter(fs.readFileSync(live, 'utf8'))}\n\n${body}`;
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

function copyPreservedLiveFiles(target, candidateRoot) {
  if (!target.preserve_live_body && !target.preserve_live_resources) return;
  const liveRoot = path.join(
    ROOT, 'plugin', 'sd0x-dev-flow-codex', 'skills', target.target
  );
  for (const entry of fs.readdirSync(liveRoot, { withFileTypes: true })) {
    if (entry.name === 'SKILL.md' ||
        entry.name === 'migration-contract.json') continue;
    fs.cpSync(path.join(liveRoot, entry.name), path.join(candidateRoot, entry.name), {
      recursive: true
    });
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
    const candidateRoot = path.join(
      ROOT, 'migration', 'candidates', target.target
    );
    if (fs.existsSync(candidateRoot)) {
      fs.rmSync(candidateRoot, { recursive: true, force: true });
    }
    fs.mkdirSync(candidateRoot, { recursive: true });
    copyPreservedLiveFiles(target, candidateRoot);
    writeText(path.join(candidateRoot, 'SKILL.md'), renderSkill(target));
    writeText(path.join(candidateRoot, 'migration-contract.json'),
      canonicalJson(renderContract(target)));
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
  main,
  renderContract,
  renderRequest,
  renderSkill
};
