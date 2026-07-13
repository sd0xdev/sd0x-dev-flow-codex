#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_SPEC = path.join(
  ROOT,
  'docs',
  'features',
  'skill-toolkit-migration',
  '2-tech-spec.md'
);
const DEFAULT_OUTPUT = path.join(ROOT, 'migration', 'source-disposition.json');
const BYTEWISE = (left, right) => Buffer.from(left).compare(Buffer.from(right));

const ALIAS_CANDIDATES = Object.freeze([
  'claude-health',
  'codex-architect',
  'codex-brainstorm',
  'codex-cli-review',
  'codex-code-review',
  'codex-explain',
  'codex-implement',
  'codex-review',
  'codex-review-branch',
  'codex-review-doc',
  'codex-review-fast',
  'codex-security',
  'codex-setup',
  'codex-test-gen',
  'codex-test-review',
  'deep-analyze',
  'install-hooks',
  'install-rules',
  'install-scripts',
  'precommit',
  'precommit-fast',
  'project-setup'
].sort(BYTEWISE));

const CORE_SOURCES = new Set([
  'bug-fix',
  'claude-health',
  'codex-cli-review',
  'codex-code-review',
  'codex-implement',
  'codex-review',
  'codex-review-branch',
  'codex-review-fast',
  'codex-setup',
  'create-request',
  'deep-analyze',
  'feature-dev',
  'install-hooks',
  'install-rules',
  'install-scripts',
  'precommit',
  'precommit-fast',
  'project-setup',
  'remind',
  'req-analyze',
  'tech-spec',
  'verify'
]);

const PACKAGES_BY_WAVE = Object.freeze({
  1: 'planning-pack',
  2: 'research-pack',
  3: 'development-pack',
  4: 'quality-pack',
  5: 'delivery-pack',
  6: 'docs-ops-pack',
  7: 'domain-pack'
});

const RATIONALES = Object.freeze({
  keep: 'Retain the existing canonical workflow and adapt only at shared runtime boundaries.',
  port: 'Port the source workflow while preserving its bounded behavior.',
  adapt: 'Adapt source assumptions to Codex-native tools, authority, and evidence contracts.',
  merge: 'Merge the source behavior into the named canonical routing owner and mode.',
  optional: 'Prepare an optional capability-gated pack handoff without core discovery.',
  retire: 'Retire unsupported Claude statusline configuration instead of simulating Codex support.'
});

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function unquoteCell(value) {
  const trimmed = value.trim();
  if (trimmed === '—') return null;
  const match = /^`([^`]+)`$/.exec(trimmed);
  assert(match, `disposition table cell must contain one code span: ${trimmed}`);
  return match[1];
}

function parseDispositionTable(markdown) {
  const heading = '## 6. Full Source Skill Disposition (100/100)';
  const start = markdown.indexOf(heading);
  assert(start >= 0, `missing tech-spec section: ${heading}`);
  const end = markdown.indexOf('\n## ', start + heading.length);
  const section = markdown.slice(start, end < 0 ? markdown.length : end);
  const rows = [];
  for (const line of section.split('\n')) {
    const match = /^\|\s*(\d+)\s*\|\s*(`[^`]+`)\s*\|\s*(`[^`]+`|—)\s*\|\s*(Keep|Port|Adapt|Merge|Optional|Retire)\s*\|\s*(\d+)\s*\|$/.exec(line);
    if (!match) continue;
    const target = unquoteCell(match[3]);
    const targetParts = target ? target.split(':') : [];
    assert(targetParts.length <= 2, `target has more than one mode separator: ${target}`);
    rows.push({
      index: Number(match[1]),
      source_name: unquoteCell(match[2]),
      target_skill: targetParts[0] || null,
      target_mode: targetParts[1] || null,
      disposition: match[4].toLowerCase(),
      wave: Number(match[5])
    });
  }
  assert(rows.length === 100, `expected 100 disposition rows, found ${rows.length}`);
  rows.forEach((row, index) => assert(row.index === index + 1,
    `disposition row sequence mismatch at ${row.source_name}`));
  assert(new Set(rows.map((row) => row.source_name)).size === 100,
    'disposition source names must be unique');
  return rows;
}

function targetPackage(row) {
  if (row.disposition === 'retire') return 'retired';
  if (CORE_SOURCES.has(row.source_name)) return 'core';
  const packageName = PACKAGES_BY_WAVE[row.wave];
  assert(packageName, `no package derivation for wave ${row.wave}`);
  return packageName;
}

function buildDisposition(markdown) {
  const aliases = new Set(ALIAS_CANDIDATES);
  const parsed = parseDispositionTable(markdown);
  const modes = new Map();
  for (const row of parsed) {
    if (!row.target_skill || !row.target_mode) continue;
    if (!modes.has(row.target_skill)) modes.set(row.target_skill, new Set());
    modes.get(row.target_skill).add(row.target_mode);
  }
  const canonicalTargets = {};
  for (const target of [...modes.keys()].sort(BYTEWISE)) {
    canonicalTargets[target] = { modes: [...modes.get(target)].sort(BYTEWISE) };
  }

  return {
    schema_version: 1,
    compatibility_alias_candidates: ALIAS_CANDIDATES,
    alias_policy_decision: {
      policy: 'mapping-only',
      codex_version: 'codex-cli 0.144.1',
      evidence: 'migration/alias-capability.json',
      rationale: 'The Codex registry exposes explicit and implicit invocation but no inspectable automatic-candidate exclusion mechanism, so compatibility aliases remain mapping-only.'
    },
    canonical_targets: canonicalTargets,
    skills: parsed
      .map(({ index, ...row }) => {
        const retired = row.disposition === 'retire';
        const aliasCandidate = aliases.has(row.source_name);
        return {
          source_name: row.source_name,
          disposition: row.disposition,
          target_package: targetPackage(row),
          delivery_state: 'planned',
          target_skill: row.target_skill,
          target_mode: row.target_mode,
          alias_candidate: aliasCandidate,
          alias_policy: aliasCandidate ? 'mapping-only' : 'none',
          capabilities: [],
          operations: [],
          wave: row.wave,
          routing_owner: retired ? null : row.target_skill,
          promotion_unit_id: retired
            ? `retire/${row.source_name}`
            : `${row.target_skill}/${row.target_mode || 'default'}`,
          promotion_request: null,
          license_status: 'approved',
          rationale: RATIONALES[row.disposition]
        };
      })
      .sort((left, right) => BYTEWISE(left.source_name, right.source_name))
  };
}

function initializeDisposition(options = {}) {
  const specPath = path.resolve(options.specPath || DEFAULT_SPEC);
  const outputPath = path.resolve(options.outputPath || DEFAULT_OUTPUT);
  const disposition = buildDisposition(fs.readFileSync(specPath, 'utf8'));
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(disposition, null, 2)}\n`, { flag: 'wx' });
  return disposition;
}

function parseArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--tech-spec') options.specPath = argv[++index];
    else if (value === '--output') options.outputPath = argv[++index];
    else throw new Error(`unknown argument: ${value}`);
  }
  assert(!('specPath' in options) || options.specPath, 'missing value for --tech-spec');
  assert(!('outputPath' in options) || options.outputPath, 'missing value for --output');
  return options;
}

function main(argv = process.argv.slice(2)) {
  const result = initializeDisposition(parseArguments(argv));
  process.stdout.write(`initialized ${result.skills.length} disposition rows\n`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`initialize-skill-disposition: ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  ALIAS_CANDIDATES,
  CORE_SOURCES,
  buildDisposition,
  initializeDisposition,
  parseDispositionTable,
  targetPackage
};
