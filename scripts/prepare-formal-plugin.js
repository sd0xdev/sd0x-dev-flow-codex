#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {
  routingDescription,
  routingTestSource
} = require('./skill-routing-test');
const {
  semanticTestSource
} = require('./research-contract-test');
const {
  withPreparedCandidateDirectory,
  writeText
} = require('./prepare-skill-wave');
const {
  captureRegularTree,
  copyCapturedTree
} = require('./promote-skill-wave');

const ROOT = path.resolve(__dirname, '..');
const DISPOSITION_PATH = path.join(ROOT, 'migration', 'source-disposition.json');
const FORMAL_REQUEST = './2026-07-28-formal-plugin-delivery-model.md';
const BYTEWISE = (left, right) => Buffer.from(left).compare(Buffer.from(right));

function fail(message) {
  throw new Error(message);
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort(BYTEWISE).map((key) => [
      key, canonical(value[key])
    ]));
  }
  return value;
}

function canonicalJson(value, pretty = false) {
  return `${JSON.stringify(canonical(value), null, pretty ? 2 : 0)}\n`;
}

function titleCase(value) {
  return value.split(/[-/]/).map((part) =>
    `${part.charAt(0).toUpperCase()}${part.slice(1)}`).join(' ');
}

const CORE_BOUNDARY_REPLACEMENTS = new Map([
  [
    'This repository payload is research-pack-ready source material only. It remains outside the core plugin manifest and live skill discovery, and it is not released here. A later separate-plugin repository must provide its own manifest, dependency declaration, installation tests, fingerprint-bound review and verification gates, and release authorization.',
    'This canonical skill is distributed from the core plugin. Its legacy research-pack payload and pack-ready evidence remain immutable migration provenance and are not a runtime routing surface.'
  ],
  [
    'This payload is development-pack-ready source material. It stays outside core discovery and is not published from this repository.',
    'This canonical skill is distributed from the core plugin. Its legacy development-pack payload remains immutable migration provenance and is not a runtime routing surface.'
  ],
  [
    'This repository payload is pack-ready source material only; it is not a core skill and is not a released separate plugin.',
    'This canonical skill is distributed from the core plugin; the linked planning-pack handoff is retained only as immutable migration provenance.'
  ]
]);

function adaptCorePackageBoundary(text) {
  let next = text;
  for (const [legacy, replacement] of CORE_BOUNDARY_REPLACEMENTS) {
    next = next.split(legacy).join(replacement);
  }
  next = next.replace(
    /A later separate-plugin repository must provide its own manifest,[^.]+(?:distinct from the core worktree review gate|distinct from plan and code review|transferable payload integrity only|does not claim publication or live installation|distinct from core request mutation)\./g,
    'This historical handoff records the former separate-package boundary; the canonical skill is now distributed from the core plugin, while the legacy pack remains provenance only.'
  );
  next = next.replace(
    /A later separate-plugin repository must provide its own manifest, dependencies, lifecycle fixtures, installation tests, review\/verification gates, and release authorization\. It must keep spec review distinct from plan and code review\./g,
    'This historical handoff records the former separate-package boundary; the canonical skill is now distributed from the core plugin, while the legacy pack remains provenance only.'
  );
  next = next.replace(
    /A later separate-plugin repository must provide its own manifest, dependency declaration, installation test, review\/verification gates, and release authorization\. Pack-ready evidence in this repository proves transferable payload integrity only; it does not claim installation or publication\./g,
    'This historical handoff records the former separate-package boundary; the canonical skill is now distributed from the core plugin, while the legacy pack remains provenance only.'
  );
  next = next.replace(
    /A later separate-plugin repository must provide its own manifest, dependencies,(?: parser fixtures,)? installation tests, review\/verification gates, and release authorization\. (?:Its readiness verdict must remain distinct from the core worktree review gate|This handoff does not claim publication or live installation|It must keep portfolio reporting distinct from core request mutation|This handoff proves transferable payload integrity only)\./g,
    'This historical handoff records the former separate-package boundary; the canonical skill is now distributed from the core plugin, while the legacy pack remains provenance only.'
  );
  return next;
}

function adaptCandidateMarkdown(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      adaptCandidateMarkdown(absolute);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      const current = fs.readFileSync(absolute, 'utf8');
      const next = adaptCorePackageBoundary(current);
      if (next !== current) writeText(absolute, next);
    }
  }
}

function requestPath(wave, unit) {
  return `docs/features/skill-toolkit-migration/requests/2026-07-28-wave${wave}-${unit.replace('/', '-')}-formal-promotion.md`;
}

function requestMarkdown(details) {
  const oldRequest = path.posix.basename(details.old_request);
  const oldTitle = `${titleCase(details.unit)} Pack-Ready Completion`;
  const targetPath = `plugin/sd0x-dev-flow-codex/skills/${details.target}/`;
  return [
    `# Wave ${details.wave} ${titleCase(details.unit)} Formal Plugin Promotion`,
    '',
    '> **Doc class**: Request ticket (date-prefixed non-lifecycle)',
    '> **Created**: 2026-07-28',
    '> **Implementation Base SHA**: `6bbdfbcf1294fb8cacd4efaa712ed3c51dfabc20`',
    '> **Status**: In Progress',
    '> **Priority**: P0',
    `> **Depends On**: [${oldTitle}](./${oldRequest}), [Formal Plugin Delivery Model](${FORMAL_REQUEST})`,
    '> **Tech Spec**: [Skill Toolkit Migration](../2-tech-spec.md)',
    '',
    '## Background',
    '',
    `The canonical \`${details.unit}\` payload completed the legacy repository-only ` +
      `\`${details.legacy_package}\` handoff. This replacement owner promotes those ` +
      'audited bytes into the distributable plugin without rewriting historical evidence.',
    '',
    '## Requirements',
    '',
    `- Preserve the accepted behavior and routing boundary for \`${details.unit}\`.`,
    '- Rebind the candidate contract and routing evidence to the formal plugin package.',
    '- Keep the prior pack-ready payload, request, and evidence immutable.',
    '',
    '## Scope',
    '',
    '| Scope | Description |',
    '|---|---|',
    `| In | Upgrade and promote only \`${details.unit}\` into the distributable plugin. |`,
    '| Out | Other promotion units、external service authentication、compatibility alias entrypoints |',
    '',
    '## Related Files',
    '',
    '| File | Action | Description |',
    '|---|---|---|',
    `| \`migration/packs/${details.legacy_package}/${details.target}/\` | Read | Immutable accepted predecessor payload |`,
    `| \`migration/candidates/${details.target}/\` | New | Formal plugin candidate revision |`,
    `| \`${targetPath}\` | New | Distributable canonical target |`,
    `| \`${details.behavior_tests.join('`, `')}\` | Update | Formal-package routing and semantic contracts |`,
    '| `migration/source-disposition.json` | Update | Current package、owner and delivery transition |',
    '',
    '## Acceptance Criteria',
    '',
    '- [ ] Candidate bytes preserve the complete accepted workflow and meaningful failure boundaries.',
    '- [ ] Contract binds all assigned source names to one canonical promotion unit.',
    '- [ ] Legacy pack payload, Completed request, and durable pack-ready evidence remain unchanged.',
    '- [ ] Routing and semantic tests bind the formal plugin package and canonical owner.',
    '- [ ] Candidate preflight binds exact payload, disposition, and trusted test identity.',
    '- [ ] Final plugin destination matches the accepted candidate bytes.',
    '- [ ] Closure and promotion evidence extend the latest durable owner lineage.',
    '',
    '## Progress',
    '',
    '| Phase | Status | Note |',
    '|---|---|---|',
    '| Analysis | Complete | The immutable pack-ready predecessor and current canonical owner were resolved. |',
    '| Development | In Progress | Rebinding the accepted payload to the formal plugin package. |',
    '| Testing | Pending | Candidate preflight and final audit evidence are not recorded yet. |',
    '| Acceptance | Pending | Durable closure and promotion evidence are not recorded yet. |',
    '',
    '## References',
    '',
    '- Tech Spec: [Skill Toolkit Migration](../2-tech-spec.md)',
    ''
  ].join('\n');
}

function routingCatalogHash(disposition) {
  const fields = [
    'source_name', 'disposition', 'target_package', 'target_skill', 'target_mode',
    'wave', 'routing_owner', 'promotion_unit_id'
  ];
  const catalog = disposition.skills.map((row) => Object.fromEntries(
    fields.map((field) => [field, row[field]])
  ));
  return crypto.createHash('sha256').update(canonicalJson(catalog)).digest('hex');
}

function prepareLegacyTarget(disposition, rows) {
  const target = rows[0].target_skill;
  const unit = rows[0].promotion_unit_id;
  const legacyPackages = [...new Set(rows.map((row) => row.target_package))];
  const oldRequests = [...new Set(rows.map((row) => row.promotion_request))];
  if (legacyPackages.length !== 1 || !legacyPackages[0].endsWith('-pack')) {
    fail(`${unit}: legacy package is ambiguous`);
  }
  if (oldRequests.length !== 1 || !oldRequests[0]) {
    fail(`${unit}: legacy owner is ambiguous`);
  }
  const source = path.join(ROOT, 'migration', 'packs', legacyPackages[0], target);
  const sourceSnapshot = captureRegularTree(source);
  let contract;
  withPreparedCandidateDirectory(ROOT, target, (candidate) => {
    copyCapturedTree(source, candidate, sourceSnapshot, {
      useExistingDestination: true
    });
    adaptCandidateMarkdown(candidate);
    const contractPath = path.join(candidate, 'migration-contract.json');
    contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
    if (contract.target_skill !== target) fail(`${unit}: predecessor target mismatch`);
    contract.target_package = 'core';
    writeText(contractPath, canonicalJson(contract, true));
    const registry = contract.units.map((entry) => ({
      unit: entry.promotion_unit_id,
      routing: canonical(entry.routing)
    }));
    const skillPath = path.join(candidate, 'SKILL.md');
    const skill = adaptCorePackageBoundary(fs.readFileSync(skillPath, 'utf8'));
    const description = `description: ${routingDescription(target, registry)}`;
    if (!/^description: .*$/m.test(skill)) fail(`${unit}: description is missing`);
    writeText(skillPath, skill.replace(/^description: .*$/m, description));
  });
  const units = contract.units.map((entry) => ({
    unit: entry.promotion_unit_id,
    routing: entry.routing
  }));
  for (const entry of contract.units) {
    const testPath = entry.behavior_tests.find((file) => file.endsWith('-routing.test.js'));
    if (!testPath) fail(`${entry.promotion_unit_id}: routing test is missing`);
    writeText(path.join(ROOT, testPath), routingTestSource({
      target,
      targetPackage: 'core',
      unit: entry.promotion_unit_id,
      registry: units,
      routing: entry.routing
    }));
    if (contract.schema_version === 2) {
      const semanticPath = entry.behavior_tests.find((file) =>
        file.endsWith('-semantics.test.js'));
      if (!semanticPath) fail(`${entry.promotion_unit_id}: semantic test is missing`);
      writeText(path.join(ROOT, semanticPath), semanticTestSource({
        target,
        targetPackage: 'core',
        unit: entry.promotion_unit_id,
        required: entry.semantic_requirements.required,
        forbidden: entry.semantic_requirements.forbidden
      }));
    }
  }
  const nextRequest = requestPath(rows[0].wave, unit);
  const details = {
    target,
    unit,
    wave: rows[0].wave,
    legacy_package: legacyPackages[0],
    old_request: oldRequests[0],
    behavior_tests: contract.units.flatMap((entry) => entry.behavior_tests)
      .sort(BYTEWISE)
  };
  writeText(path.join(ROOT, nextRequest), requestMarkdown(details));
  for (const row of rows) {
    row.target_package = 'core';
    row.delivery_state = 'candidate';
    row.promotion_request = nextRequest;
  }
  return details;
}

function main() {
  const disposition = JSON.parse(fs.readFileSync(DISPOSITION_PATH, 'utf8'));
  const legacyUnits = new Map();
  for (const row of disposition.skills) {
    if (row.delivery_state !== 'pack-ready') continue;
    if (!legacyUnits.has(row.promotion_unit_id)) legacyUnits.set(row.promotion_unit_id, []);
    legacyUnits.get(row.promotion_unit_id).push(row);
  }
  const formalCandidateTargets = [...new Set(disposition.skills
    .filter((row) => row.delivery_state === 'candidate' &&
      /\/2026-07-28-wave\d-.*-formal-promotion\.md$/.test(row.promotion_request || ''))
    .map((row) => row.target_skill))].sort(BYTEWISE);
  for (const target of formalCandidateTargets) {
    const candidate = path.join(ROOT, 'migration', 'candidates', target);
    adaptCandidateMarkdown(candidate);
    const contract = JSON.parse(fs.readFileSync(
      path.join(candidate, 'migration-contract.json'), 'utf8'
    ));
    const registry = contract.units.map((entry) => ({
      unit: entry.promotion_unit_id,
      routing: canonical(entry.routing)
    }));
    const skillPath = path.join(candidate, 'SKILL.md');
    const skill = adaptCorePackageBoundary(fs.readFileSync(skillPath, 'utf8'));
    writeText(skillPath, skill.replace(
      /^description: .*$/m,
      `description: ${routingDescription(target, registry)}`
    ));
    for (const entry of contract.units) {
      const testPath = entry.behavior_tests.find((file) =>
        file.endsWith('-routing.test.js'));
      if (!testPath) fail(`${entry.promotion_unit_id}: routing test is missing`);
      writeText(path.join(ROOT, testPath), routingTestSource({
        target,
        targetPackage: 'core',
        unit: entry.promotion_unit_id,
        registry,
        routing: entry.routing
      }));
      if (contract.schema_version === 2) {
        const semanticPath = entry.behavior_tests.find((file) =>
          file.endsWith('-semantics.test.js'));
        if (!semanticPath) {
          fail(`${entry.promotion_unit_id}: semantic test is missing`);
        }
        writeText(path.join(ROOT, semanticPath), semanticTestSource({
          target,
          targetPackage: 'core',
          unit: entry.promotion_unit_id,
          required: entry.semantic_requirements.required,
          forbidden: entry.semantic_requirements.forbidden
        }));
      }
    }
  }
  const prepared = [];
  for (const unit of [...legacyUnits.keys()].sort(BYTEWISE)) {
    prepared.push(prepareLegacyTarget(disposition, legacyUnits.get(unit)));
  }
  for (const row of disposition.skills) {
    if (row.delivery_state === 'planned') row.target_package = 'core';
    if (row.source_name === 'statusline-config') {
      row.disposition = 'adapt';
      row.target_package = 'core';
      row.target_skill = 'statusline-config';
      row.target_mode = null;
      row.routing_owner = 'statusline-config';
      row.promotion_unit_id = 'statusline-config/default';
      row.rationale = 'Provide a read-only capability-aware Codex statusline workflow that fails closed when no official configuration API exists.';
    }
  }
  writeText(DISPOSITION_PATH, `${JSON.stringify(disposition, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({
    ok: true,
    prepared_units: prepared.length,
    routing_catalog_sha256: routingCatalogHash(disposition)
  }, null, 2)}\n`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`prepare-formal-plugin: ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  adaptCorePackageBoundary,
  main,
  requestMarkdown,
  routingCatalogHash
};
