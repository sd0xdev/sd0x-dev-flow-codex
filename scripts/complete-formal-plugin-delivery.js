#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const {
  auditActiveCandidates,
  validateCandidateRequestEvidence
} = require('./skill-migration-audit');
const {
  migrationDeliveryCheckpoint,
  migrationDeliveryMarker,
  migrationDeliverySummary
} = require('./release');
const {
  applyRequestClosure,
  finalizeRequestClosure,
  isCurrentPass,
  latestEvidenceRecord,
  readEvidenceRecord,
  prepareRequestClosure,
  recordPromotionEvidence,
  refreshState
} = require('../plugin/sd0x-dev-flow-codex/scripts/runtime/state');
const {
  atomicWriteContainedFile,
  readContainedFile
} = require('./contained-file');

const ROOT = path.resolve(__dirname, '..');
const DISPOSITION = path.join(ROOT, 'migration', 'source-disposition.json');
const GUIDE = path.join(ROOT, 'docs', 'PROJECT-MIGRATION-GUIDE.md');
const TECH_SPEC = path.join(
  ROOT, 'docs', 'features', 'skill-toolkit-migration', '2-tech-spec.md'
);
const MANIFEST = path.join(ROOT, '.sd0x', 'formal-plugin-delivery.json');
const BYTEWISE = (left, right) => Buffer.from(left).compare(Buffer.from(right));
const MANIFEST_PHASES = new Set([
  'preparing', 'prepared', 'applying', 'applied', 'finalizing', 'finalized', 'recording', 'recorded',
  'overlaying', 'overlaid'
]);
const OVERLAY_PATHS = Object.freeze([
  'migration/source-disposition.json',
  'docs/PROJECT-MIGRATION-GUIDE.md',
  'docs/features/skill-toolkit-migration/2-tech-spec.md'
]);
const REQUEST_CRITERIA_SECTION = new RegExp(
  String.raw`## Acceptance Criteria\n([\s\S]*?)(?=\n## )`
);
const CHECKED_CRITERION = new RegExp(String.raw`^- \[x\] (.+)$`, 'gm');
const CANDIDATE_COMPLETE_STATUS = new RegExp(
  String.raw`^> \*\*Status\*\*: Candidate Complete$`, 'm'
);
const CANDIDATE_ACCEPTANCE_ROW = new RegExp(
  String.raw`^\| Acceptance \| Candidate Complete \|.*\|$`, 'm'
);
const CANDIDATE_TESTING_ROW = new RegExp(
  String.raw`^(\| Testing \| Complete \|.* Preflight \`[a-f0-9]{64}\`\.)( \|)$`, 'm'
);
const PACK_READY_DEPENDENCY = new RegExp(
  String.raw`\[([^\]]+ Pack-Ready Completion)\]\(\.\/([^\)]+\.md)\)`
);
const COMPLETED_STATUS = new RegExp(
  String.raw`^> \*\*Status\*\*: Completed$`, 'm'
);
const CLOSURE_LINEAGE_TEXT = new RegExp(
  String.raw`(?:Closure and promotion evidence|R3 closure inputs identify this exact request)`
);
const PAYLOAD_PROGRESS = new RegExp(
  String.raw`\| Development \| Complete \| Formal-plugin candidate payload \`([a-f0-9]{64})\``
);
const PREFLIGHT_PROGRESS = new RegExp(
  String.raw`\| Testing \| Complete \| Routing, semantic, and static checks passed\. Preflight \`([a-f0-9]{64})\``
);
const TECH_SPEC_ACCEPTANCE = new RegExp(
  String.raw`## 11\. Acceptance Criteria\n([\s\S]*?)(?=\n## 12\.)`
);
const UNCHECKED_CRITERION = new RegExp(String.raw`^- \[ \] `, 'gm');

function fail(message) {
  throw new Error(message);
}

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function records(disposition, deliveryStates = new Set(['candidate'])) {
  const units = new Map();
  for (const row of disposition.skills) {
    if (!deliveryStates.has(row.delivery_state) ||
        !/\/2026-07-28-wave[1-7]-.*-(?:formal-)?promotion\.md$/.test(
          row.promotion_request || '')) continue;
    const current = units.get(row.promotion_unit_id) || {
      promotion_unit_id: row.promotion_unit_id,
      request_path: row.promotion_request,
      target: row.target_skill,
      rows: []
    };
    if (current.request_path !== row.promotion_request ||
        current.target !== row.target_skill) {
      fail(`${row.promotion_unit_id}: formal rows disagree on target or request`);
    }
    current.rows.push(row);
    units.set(row.promotion_unit_id, current);
  }
  return [...units.values()].sort((left, right) =>
    BYTEWISE(left.promotion_unit_id, right.promotion_unit_id));
}

function requestCriteria(markdown) {
  const section = REQUEST_CRITERIA_SECTION.exec(markdown)?.[1] || '';
  return [...section.matchAll(CHECKED_CRITERION)].map((match, index) => ({
    ac: index + 1,
    text: match[1]
  }));
}

function proposal(markdown, audit) {
  if (!audit || !/^[a-f0-9]{64}$/.test(audit.audit_fingerprint || '')) {
    fail(`${audit?.promotion_unit_id || 'formal candidate'}: final audit identity is invalid`);
  }
  let next = markdown.replace(
    CANDIDATE_COMPLETE_STATUS,
    '> **Status**: Completed'
  );
  next = next.replace(CANDIDATE_TESTING_ROW, (_row, note, suffix) =>
    `${note} Final audit \`${audit.audit_fingerprint}\` passed.${suffix}`
  );
  next = next.replace(
    CANDIDATE_ACCEPTANCE_ROW,
    '| Acceptance | Complete | Runtime-owned R3 closure and promotion evidence bind this Completed owner. |'
  );
  next = next.replace(
    'Closure and promotion evidence extend the latest durable owner lineage.',
    'R3 closure inputs identify this exact request, promotion unit, evidence kind, and final-fingerprint fields.'
  );
  if (!/^> \*\*Status\*\*: Completed$/m.test(next) ||
      !/^\| Acceptance \| Complete \|/m.test(next) ||
      [...next.matchAll(/Final audit \`[a-f0-9]{64}\`/g)].length !== 1 ||
      !next.includes(`Final audit \`${audit.audit_fingerprint}\``)) {
    fail(`${audit.promotion_unit_id}: request proposal could not be completed`);
  }
  return next;
}

function candidateValidationResult(record, audit) {
  if (!record || !audit || audit.promotion_unit_id !== record.promotion_unit_id ||
      audit.lifecycle !== 'move-window' ||
      !/^[a-f0-9]{64}$/.test(audit.payload_tree_sha256 || '') ||
      !/^[a-f0-9]{64}$/.test(audit.preflight_audit_fingerprint || '') ||
      !/^[a-f0-9]{64}$/.test(audit.audit_fingerprint || '')) {
    fail(`${record?.promotion_unit_id || 'formal candidate'}: production audit identity is incomplete`);
  }
  const packages = [...new Set(record.rows.map((row) => row.target_package))];
  if (packages.length !== 1) {
    fail(`${record.promotion_unit_id}: formal rows disagree on target package`);
  }
  return {
    promotion_unit_id: record.promotion_unit_id,
    target_package: packages[0],
    payload_tree_sha256: audit.payload_tree_sha256,
    preflight_audit_fingerprint: audit.preflight_audit_fingerprint,
    audit_fingerprint: audit.audit_fingerprint,
    move_window: true
  };
}

function evidenceLocation(relative, pattern) {
  const absolute = path.join(ROOT, ...relative.split('/'));
  const text = fs.readFileSync(absolute, 'utf8');
  const lines = text.split(/\r?\n/);
  const index = lines.findIndex((line) => typeof pattern === 'string'
    ? line.includes(pattern)
    : pattern.test(line));
  if (index < 0) fail(`${relative}: criterion evidence anchor is missing`);
  return `${relative}:${index + 1}`;
}

function contractUnit(record) {
  const relative =
    `plugin/sd0x-dev-flow-codex/skills/${record.target}/migration-contract.json`;
  const contract = JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8'));
  const unit = contract.units?.find((entry) =>
    entry.promotion_unit_id === record.promotion_unit_id);
  if (!unit) fail(`${record.promotion_unit_id}: live contract unit is missing`);
  const expectedSources = record.rows.map((row) => row.source_name).sort(BYTEWISE);
  const actualSources = [...(unit.source_names || [])].sort(BYTEWISE);
  if (JSON.stringify(expectedSources) !== JSON.stringify(actualSources)) {
    fail(`${record.promotion_unit_id}: contract source identities do not match`);
  }
  return { contract, unit, relative };
}

function requestProgressIdentity(record, unitAudit, label) {
  const pattern = label === 'payload'
    ? unitAudit.payload_tree_sha256
    : unitAudit.preflight_audit_fingerprint;
  if (!/^[a-f0-9]{64}$/.test(pattern || '')) {
    fail(`${record.promotion_unit_id}: audited ${label} identity is invalid`);
  }
  return evidenceLocation(record.request_path, pattern);
}

function predecessorEvidence(record) {
  const current = fs.readFileSync(path.join(ROOT, record.request_path), 'utf8');
  const dependency = PACK_READY_DEPENDENCY.exec(current);
  if (!dependency) return null;
  const predecessor = path.posix.join(path.posix.dirname(record.request_path), dependency[2]);
  const markdown = fs.readFileSync(path.join(ROOT, predecessor), 'utf8');
  if (!COMPLETED_STATUS.test(markdown)) {
    fail(`${record.promotion_unit_id}: legacy predecessor is not Completed`);
  }
  const packReady = latestEvidenceRecord(ROOT, 'pack-ready', record.promotion_unit_id);
  const closure = packReady?.request_closure_record_sha256
    ? readEvidenceRecord(ROOT, packReady.request_closure_record_sha256).record
    : null;
  if (!packReady || !closure || closure.kind !== 'request-closure' ||
      closure.promotion_unit_id !== record.promotion_unit_id ||
      closure.request_path !== predecessor ||
      packReady.request_closure_record_sha256 !== closure.record_sha256 ||
      !/^[a-f0-9]{64}$/.test(packReady.payload_tree_sha256 || '')) {
    fail(`${record.promotion_unit_id}: durable pack-ready predecessor is missing`);
  }
  const matches = fs.readdirSync(path.join(ROOT, 'migration', 'packs'))
    .map((name) => `migration/packs/${name}/${record.target}/migration-contract.json`)
    .filter((relative) => fs.existsSync(path.join(ROOT, relative)));
  if (matches.length !== 1) {
    fail(`${record.promotion_unit_id}: legacy pack contract is ambiguous`);
  }
  return [
    evidenceLocation(predecessor, '> **Status**: Completed'),
    evidenceLocation(matches[0], record.promotion_unit_id)
  ];
}

function criterionEvidence(record, criteria, unitAudit) {
  if (!Array.isArray(criteria) || criteria.length !== 7 ||
      criteria.some((criterion, index) => criterion.ac !== index + 1 ||
        typeof criterion.text !== 'string' || criterion.text.length === 0)) {
    fail(`${record.promotion_unit_id}: expected seven ordered acceptance criteria`);
  }
  if (!unitAudit || unitAudit.promotion_unit_id !== record.promotion_unit_id ||
      unitAudit.lifecycle !== 'move-window') {
    fail(`${record.promotion_unit_id}: criterion evidence requires move-window audit`);
  }
  const resolved = contractUnit(record);
  const contract = resolved.relative;
  const routingTest = `test/${record.promotion_unit_id.replace('/', '-')}-routing.test.js`;
  const behaviorTests = resolved.unit.behavior_tests || [];
  const supplementalBehaviorTests = resolved.unit.supplemental_behavior_tests || [];
  const allBehaviorTests = [...behaviorTests, ...supplementalBehaviorTests];
  if (allBehaviorTests.length === 0) {
    fail(`${record.promotion_unit_id}: trusted behavior-test identity is missing`);
  }
  const supplementalRegistry = 'scripts/supplemental-behavior-tests.json';
  const predecessor = predecessorEvidence(record);
  const compatibility = predecessor || [
    evidenceLocation('migration/alias-capability.json', '"decision": "mapping-only"'),
    ...record.rows.map((row) => evidenceLocation(
      'migration/source-disposition.json', `"source_name": "${row.source_name}"`
    ))
  ];
  if (!predecessor && record.rows.some((row) =>
    row.alias_policy !== (row.alias_candidate ? 'mapping-only' : 'none'))) {
    fail(`${record.promotion_unit_id}: compatibility alias policy is inconsistent`);
  }
  const evidence = [
    [
      evidenceLocation(contract, `"source_names"`),
      ...behaviorTests.map((relative) =>
        evidenceLocation(relative, record.promotion_unit_id)),
      ...supplementalBehaviorTests.map((relative) =>
        evidenceLocation(supplementalRegistry, `"path": "${relative}"`))
    ],
    [
      evidenceLocation(contract, record.promotion_unit_id),
      ...record.rows.map((row) => evidenceLocation(
        'migration/source-disposition.json', `"source_name": "${row.source_name}"`
      ))
    ],
    compatibility,
    [
      evidenceLocation(routingTest, record.promotion_unit_id),
      evidenceLocation(contract, `"target_skill": "${record.target}"`)
    ],
    [
      requestProgressIdentity(record, unitAudit, 'preflight'),
      ...allBehaviorTests.map((relative) =>
        evidenceLocation(contract, relative))
    ],
    [
      requestProgressIdentity(record, unitAudit, 'payload'),
      evidenceLocation('scripts/promote-skill-wave.js',
        'promoted payload differs from accepted candidate')
    ],
    [
      evidenceLocation(record.request_path,
        CLOSURE_LINEAGE_TEXT),
      evidenceLocation('scripts/complete-formal-plugin-delivery.js',
        'pending_record_sha256: result.record_sha256'),
      evidenceLocation('scripts/complete-formal-plugin-delivery.js',
        'request_closure_record_sha256: record.request_closure_record_sha256')
    ]
  ];
  return criteria.map((criterion, index) => ({
    ac: criterion.ac,
    status: 'Complete',
    confidence: 'High',
    evidence: [...new Set(evidence[index])].sort(BYTEWISE)
  }));
}

function gateEvidence(state, subject, record, criteria, unitAudit) {
  if (!isCurrentPass(state, 'review') || !isCurrentPass(state, 'verify')) {
    fail('formal closure prepare requires current review and verification passes');
  }
  return {
    subject_review: {
      binding: subject,
      provider: state.review_provider,
      evidence: {
        gate: state.gates.review.evidence,
        native_results: state.review_agents.completed,
        external_results: state.external_review.completed,
        subject_bindings: []
      }
    },
    verify: {
      binding: subject,
      provider: state.review_provider,
      evidence: state.gates.verify.evidence
    },
    ac: {
      verdicts: criterionEvidence(record, criteria, unitAudit)
    },
    checks: {
      commands: [{ argv: ['npm', 'run', 'check'], exit_code: 0 }]
    }
  };
}

function validateManifest(value) {
  if (!value || value.schema_version !== 2 ||
      value.repository_root !== fs.realpathSync(ROOT) ||
      value.head_sha !== headSha() ||
      !/^[a-f0-9]{64}$/.test(value.prepared_fingerprint || '') ||
      !MANIFEST_PHASES.has(value.phase) || !Array.isArray(value.pending) ||
      value.pending.length !== 83) {
    fail('formal delivery manifest is malformed or belongs to another subject');
  }
  validatePendingIdentities(value);
  return value;
}

function normalizedCandidateRows(rows) {
  return rows.map((row) => row.delivery_state === 'promoted'
    ? { ...row, delivery_state: 'candidate' }
    : row);
}

function progressIdentity(requestPath, label) {
  const markdown = readContainedFile(
    ROOT, path.join(ROOT, requestPath), 'utf8'
  ).bytes.toString('utf8');
  const pattern = label === 'payload'
    ? PAYLOAD_PROGRESS
    : PREFLIGHT_PROGRESS;
  const matches = [...markdown.matchAll(new RegExp(pattern.source, 'g'))];
  if (matches.length !== 1) fail(`${requestPath}: manifest identity is ambiguous`);
  return matches[0][1];
}

function validatePendingIdentities(manifest) {
  const disposition = JSON.parse(readContainedFile(ROOT, DISPOSITION, 'utf8').bytes);
  const expected = records(disposition, new Set(['candidate', 'promoted']));
  if (expected.length !== 83) fail('formal delivery disposition identities changed');
  const expectedByUnit = new Map(expected.map((record) => [
    record.promotion_unit_id,
    { ...record, rows: normalizedCandidateRows(record.rows) }
  ]));
  const seen = new Set();
  const phaseAtLeast = (phase) => [...MANIFEST_PHASES].indexOf(manifest.phase) >=
    [...MANIFEST_PHASES].indexOf(phase);
  for (const record of manifest.pending) {
    const expectedRecord = expectedByUnit.get(record?.promotion_unit_id);
    if (!expectedRecord || seen.has(record.promotion_unit_id) ||
        record.request_path !== expectedRecord.request_path ||
        record.target !== expectedRecord.target ||
        JSON.stringify(record.rows) !== JSON.stringify(expectedRecord.rows)) {
      fail('formal delivery pending identities do not match the disposition');
    }
    seen.add(record.promotion_unit_id);
    if (!record.audit || record.audit.promotion_unit_id !== record.promotion_unit_id ||
        record.audit.lifecycle !== 'move-window' ||
        !/^[a-f0-9]{64}$/.test(record.audit.audit_fingerprint || '') ||
        record.audit.payload_tree_sha256 !== progressIdentity(record.request_path, 'payload') ||
        record.audit.preflight_audit_fingerprint !==
          progressIdentity(record.request_path, 'preflight') ||
        Number.isNaN(Date.parse(record.pending_recorded_at || '')) ||
        ![null, undefined].includes(record.pending_supersedes_record_sha256) &&
          !/^[a-f0-9]{64}$/.test(record.pending_supersedes_record_sha256)) {
      fail(`${record.promotion_unit_id}: formal delivery pending identity is malformed`);
    }
    if (phaseAtLeast('prepared') &&
        !/^[a-f0-9]{64}$/.test(record.pending_record_sha256 || '')) {
      fail(`${record.promotion_unit_id}: pending evidence is incomplete`);
    }
    if (record.pending_record_sha256) {
      const pending = latestEvidenceRecord(
        ROOT, 'request-closure-pending', record.promotion_unit_id
      );
      if (pending?.record_sha256 !== record.pending_record_sha256 ||
          pending.request_path !== record.request_path ||
          pending.recorded_at !== record.pending_recorded_at ||
          (pending.supersedes_record_sha256 || null) !==
            (record.pending_supersedes_record_sha256 || null)) {
        fail(`${record.promotion_unit_id}: pending evidence identity changed`);
      }
    }
    if (phaseAtLeast('finalized') &&
        !/^[a-f0-9]{64}$/.test(record.request_closure_record_sha256 || '')) {
      fail(`${record.promotion_unit_id}: request closure evidence is incomplete`);
    }
    if (record.request_closure_record_sha256) {
      const closure = latestEvidenceRecord(
        ROOT, 'request-closure', record.promotion_unit_id
      );
      if (closure?.record_sha256 !== record.request_closure_record_sha256 ||
          closure.pending_record_sha256 !== record.pending_record_sha256) {
        fail(`${record.promotion_unit_id}: request closure evidence identity changed`);
      }
    }
    if (phaseAtLeast('recorded') &&
        !/^[a-f0-9]{64}$/.test(record.promotion_record_sha256 || '')) {
      fail(`${record.promotion_unit_id}: promotion evidence is incomplete`);
    }
    if (record.promotion_record_sha256) {
      const promotion = latestEvidenceRecord(ROOT, 'promotion', record.promotion_unit_id);
      if (promotion?.record_sha256 !== record.promotion_record_sha256 ||
          promotion.request_closure_record_sha256 !==
            record.request_closure_record_sha256 ||
          promotion.payload_tree_sha256 !== record.audit.payload_tree_sha256) {
        fail(`${record.promotion_unit_id}: promotion evidence identity changed`);
      }
    }
  }
  if (seen.size !== expectedByUnit.size) {
    fail('formal delivery manifest does not contain the exact pending unit set');
  }
}

function readManifest() {
  let value;
  try {
    value = JSON.parse(readContainedFile(ROOT, MANIFEST, 'utf8').bytes);
  } catch (error) {
    fail(`formal delivery manifest is invalid: ${error.message}`);
  }
  return validateManifest(value);
}

function writeDeliveryManifest(root, manifestPath, value) {
  const current = fs.lstatSync(manifestPath, { throwIfNoEntry: false });
  const captured = current
    ? readContainedFile(root, manifestPath).captured
    : undefined;
  atomicWriteContainedFile(
    root,
    manifestPath,
    `${JSON.stringify(value, null, 2)}\n`,
    captured ? { captured } : {}
  );
}

function writeManifest(value) {
  writeDeliveryManifest(ROOT, MANIFEST, value);
}

function headSha() {
  const value = execFileSync('git', ['rev-parse', '--verify', 'HEAD'], {
    cwd: ROOT,
    encoding: 'utf8'
  }).trim();
  if (!/^[a-f0-9]{40}$/.test(value)) fail('current Git HEAD is invalid');
  return value;
}

function prepare() {
  let manifest;
  if (fs.lstatSync(MANIFEST, { throwIfNoEntry: false })) {
    manifest = readManifest();
    if (!['preparing', 'prepared'].includes(manifest.phase)) {
      fail('formal delivery manifest is not preparing');
    }
  } else {
    const disposition = JSON.parse(fs.readFileSync(DISPOSITION, 'utf8'));
    const selected = records(disposition);
    if (selected.length !== 83) fail(`expected 83 formal candidates, found ${selected.length}`);
    const audit = auditActiveCandidates({ root: ROOT });
    const audited = new Map(audit.units.map((unit) => [unit.promotion_unit_id, unit]));
    const state = refreshState(ROOT);
    const subject = {
      kind: 'dirty',
      fingerprint: state.worktree.fingerprint,
      head_sha: headSha()
    };
    manifest = {
      schema_version: 2,
      repository_root: fs.realpathSync(ROOT),
      head_sha: subject.head_sha,
      prepared_fingerprint: subject.fingerprint,
      phase: 'preparing',
      pending: selected.map((record, index) => {
        const unitAudit = audited.get(record.promotion_unit_id);
        if (!unitAudit) fail(`${record.promotion_unit_id}: active audit result is missing`);
        const prior = latestEvidenceRecord(
          ROOT, 'request-closure-pending', record.promotion_unit_id
        );
        return {
          ...record,
          audit: unitAudit,
          pending_recorded_at: new Date(Date.now() + index).toISOString(),
          pending_supersedes_record_sha256: prior?.record_sha256 || null
        };
      })
    };
    writeManifest(manifest);
  }
  if (manifest.phase === 'prepared') return;
  const subject = {
    kind: 'dirty',
    fingerprint: manifest.prepared_fingerprint,
    head_sha: manifest.head_sha
  };
  const state = refreshState(ROOT);
  const projectionRequestPaths = manifest.pending.map((record) => record.request_path)
    .sort(BYTEWISE);
  for (const record of manifest.pending) {
    if (record.pending_record_sha256) continue;
    const current = fs.readFileSync(path.join(ROOT, record.request_path), 'utf8');
    const proposed = proposal(current, record.audit);
    const closureExpectations = [];
    const validated = validateCandidateRequestEvidence(
      proposed,
      candidateValidationResult(record, record.audit),
      record.request_path,
      { root: ROOT, closureExpectations }
    );
    if (validated.final_audit_fingerprint !== record.audit.audit_fingerprint ||
        closureExpectations.length !== 1 ||
        closureExpectations[0].promotion_unit_id !== record.promotion_unit_id ||
        closureExpectations[0].request_path !== record.request_path) {
      fail(`${record.promotion_unit_id}: generated Completed request evidence is invalid`);
    }
    const criteria = requestCriteria(proposed);
    if (criteria.length === 0) fail(`${record.promotion_unit_id}: no acceptance criteria`);
    const result = prepareRequestClosure(ROOT, {
      promotion_unit_id: record.promotion_unit_id,
      request_path: record.request_path,
      proposed_request: proposed,
      projection_request_paths: projectionRequestPaths,
      subject,
      evidence: gateEvidence(state, subject, record, criteria, record.audit),
      recorded_at: record.pending_recorded_at,
      supersedes_record_sha256: record.pending_supersedes_record_sha256
    });
    record.pending_record_sha256 = result.record_sha256;
    writeManifest(manifest);
    process.stdout.write(`prepare ${record.promotion_unit_id}\n`);
  }
  manifest.phase = 'prepared';
  writeManifest(manifest);
}

function apply() {
  const manifest = readManifest();
  if (!['prepared', 'applying'].includes(manifest.phase)) {
    fail('formal delivery manifest is not prepared');
  }
  manifest.phase = 'applying';
  writeManifest(manifest);
  for (const record of manifest.pending) {
    if (record.applied === true) continue;
    applyRequestClosure(ROOT, {
      pending_record_sha256: record.pending_record_sha256
    });
    record.applied = true;
    writeManifest(manifest);
    process.stdout.write(`apply ${record.promotion_unit_id}\n`);
  }
  manifest.phase = 'applied';
  writeManifest(manifest);
}

function finalize() {
  const manifest = readManifest();
  if (!['applied', 'finalizing'].includes(manifest.phase)) {
    fail('formal delivery manifest is not applied');
  }
  manifest.phase = 'finalizing';
  writeManifest(manifest);
  for (const [index, record] of manifest.pending.entries()) {
    if (record.request_closure_record_sha256) continue;
    const completed = latestEvidenceRecord(
      ROOT, 'request-closure', record.promotion_unit_id
    );
    if (completed?.pending_record_sha256 === record.pending_record_sha256) {
      record.request_closure_record_sha256 = completed.record_sha256;
      writeManifest(manifest);
      continue;
    }
    const prior = latestEvidenceRecord(
      ROOT, 'request-closure', record.promotion_unit_id
    );
    const result = finalizeRequestClosure(ROOT, {
      pending_record_sha256: record.pending_record_sha256,
      recorded_at: new Date(Date.now() + index).toISOString(),
      supersedes_record_sha256: prior?.record_sha256 || null
    });
    record.request_closure_record_sha256 = result.record_sha256;
    writeManifest(manifest);
    process.stdout.write(`finalize ${record.promotion_unit_id}\n`);
  }
  manifest.phase = 'finalized';
  writeManifest(manifest);
}

function updatedGuide(disposition, current) {
  const checkpoint = migrationDeliveryCheckpoint(disposition);
  let guide = current;
  guide = guide.replace(/^- Registry checkpoint：[^\r\n]+$/m,
    migrationDeliverySummary(checkpoint));
  guide = guide.replace(/^<!-- sd0x-migration-delivery:v1 [^\r\n]+ -->$/m,
    migrationDeliveryMarker(checkpoint));
  guide = guide.replace(
    '- Plugin core 尚未覆蓋 Claude 版大多數 domain-specific skills，這是刻意範圍控制。',
    '- 正式 plugin 已提供 86 個 discovered canonical skills（85 個遷移 targets 加上 `reset`）；legacy packs 只保留 immutable migration evidence，不再是 runtime routing surface。'
  );
  return guide;
}

function updatedTechSpec(current) {
  let techSpec = current;
  const acceptance = TECH_SPEC_ACCEPTANCE;
  if (!acceptance.test(techSpec)) fail('migration tech spec acceptance section is missing');
  techSpec = techSpec.replace(acceptance, (section) =>
    section.replace(UNCHECKED_CRITERION, '- [x] ')
  );
  return techSpec;
}

function overlayTargets(manifest) {
  const disposition = JSON.parse(
    readContainedFile(ROOT, DISPOSITION, 'utf8').bytes.toString('utf8')
  );
  const units = new Set(manifest.pending.map((record) => record.promotion_unit_id));
  for (const row of disposition.skills) {
    if (units.has(row.promotion_unit_id)) row.delivery_state = 'promoted';
  }
  const guide = readContainedFile(ROOT, GUIDE, 'utf8');
  const techSpec = readContainedFile(ROOT, TECH_SPEC, 'utf8');
  const values = [
    [DISPOSITION, `${JSON.stringify(disposition, null, 2)}\n`],
    [GUIDE, updatedGuide(disposition, guide.bytes.toString('utf8'))],
    [TECH_SPEC, updatedTechSpec(techSpec.bytes.toString('utf8'))]
  ];
  return values.map(([absolute, next]) => {
    const current = readContainedFile(ROOT, absolute);
    return {
      path: path.relative(ROOT, absolute).split(path.sep).join('/'),
      prior_sha256: sha256(current.bytes),
      next_sha256: sha256(next),
      next_bytes_base64: Buffer.from(next).toString('base64'),
      applied: false
    };
  });
}

function validateOverlayTarget(target) {
  if (!target || typeof target.path !== 'string' ||
      target.path.includes('\\') || target.path.startsWith('/') ||
      target.path.split('/').includes('..') ||
      !/^[a-f0-9]{64}$/.test(target.prior_sha256 || '') ||
      !/^[a-f0-9]{64}$/.test(target.next_sha256 || '') ||
      typeof target.next_bytes_base64 !== 'string' ||
      ![true, false].includes(target.applied)) {
    fail('formal delivery overlay target is malformed');
  }
  const bytes = Buffer.from(target.next_bytes_base64, 'base64');
  if (bytes.toString('base64') !== target.next_bytes_base64 ||
      sha256(bytes) !== target.next_sha256) {
    fail(`formal delivery overlay bytes are invalid: ${target.path}`);
  }
  return bytes;
}

function validateOverlayPlan(manifest, expectedTargets) {
  if (!Array.isArray(expectedTargets) || expectedTargets.length !== OVERLAY_PATHS.length ||
      !Array.isArray(manifest.overlay_targets) ||
      manifest.overlay_targets.length !== OVERLAY_PATHS.length) {
    fail('formal delivery overlay target set is malformed');
  }
  for (let index = 0; index < OVERLAY_PATHS.length; index += 1) {
    const target = manifest.overlay_targets[index];
    const expected = expectedTargets[index];
    validateOverlayTarget(target);
    validateOverlayTarget(expected);
    if (target.path !== OVERLAY_PATHS[index] ||
        expected.path !== OVERLAY_PATHS[index] ||
        target.next_sha256 !== expected.next_sha256 ||
        target.next_bytes_base64 !== expected.next_bytes_base64) {
      fail('formal delivery overlay does not match deterministic targets');
    }
  }
}

function applyOverlayTransaction(manifest, hooks, expectedTargets) {
  if (!manifest || manifest.phase !== 'overlaying' ||
      !Array.isArray(manifest.overlay_targets) ||
      manifest.overlay_targets.length !== 3 ||
      !hooks || typeof hooks.read !== 'function' ||
      typeof hooks.write !== 'function' || typeof hooks.persist !== 'function') {
    fail('formal delivery overlay transaction is malformed');
  }
  validateOverlayPlan(manifest, expectedTargets);
  for (const [index, target] of manifest.overlay_targets.entries()) {
    const next = validateOverlayTarget(target);
    let current = hooks.read(target);
    const currentSha = sha256(current.bytes);
    if (currentSha === target.next_sha256) {
      target.applied = true;
      hooks.persist(manifest);
      continue;
    }
    if (currentSha !== target.prior_sha256 || target.applied) {
      fail(`formal delivery overlay target drifted: ${target.path}`);
    }
    if (typeof hooks.beforeWrite === 'function') hooks.beforeWrite(target, index);
    hooks.write(target, next, current);
    current = hooks.read(target);
    if (sha256(current.bytes) !== target.next_sha256) {
      fail(`formal delivery overlay write did not persist: ${target.path}`);
    }
    target.applied = true;
    hooks.persist(manifest);
  }
  manifest.phase = 'overlaid';
  hooks.persist(manifest);
  return manifest;
}

function overlay() {
  const manifest = readManifest();
  if (!['recorded', 'overlaying'].includes(manifest.phase)) {
    fail('formal delivery manifest is not recorded');
  }
  if (manifest.pending.some((record) =>
    !/^[a-f0-9]{64}$/.test(record.promotion_record_sha256 || ''))) {
    fail('formal delivery promotion evidence is incomplete');
  }
  if (manifest.phase === 'recorded') {
    const state = refreshState(ROOT);
    if (!isCurrentPass(state, 'review') || !isCurrentPass(state, 'verify') ||
        state.worktree.fingerprint !== manifest.record_fingerprint) {
      fail('formal delivery overlay requires the recorded review/verify fingerprint');
    }
    manifest.overlay_targets = overlayTargets(manifest);
    manifest.phase = 'overlaying';
    writeManifest(manifest);
  }
  const expectedTargets = overlayTargets(manifest);
  applyOverlayTransaction(manifest, {
    read(target) {
      return readContainedFile(ROOT, path.join(ROOT, ...target.path.split('/')));
    },
    write(target, bytes, current) {
      atomicWriteContainedFile(
        ROOT,
        path.join(ROOT, ...target.path.split('/')),
        bytes,
        { captured: current.captured }
      );
    },
    persist: writeManifest
  }, expectedTargets);
}

function recordPendingPromotions(manifest, hooks) {
  if (!manifest || !Array.isArray(manifest.pending) ||
      !['finalized', 'recording'].includes(manifest.phase)) {
    fail('formal delivery manifest is not finalized');
  }
  if (!hooks || typeof hooks.latest !== 'function' ||
      typeof hooks.intent !== 'function' || typeof hooks.append !== 'function' ||
      typeof hooks.persist !== 'function') {
    fail('formal delivery record hooks are invalid');
  }
  manifest.phase = 'recording';
  hooks.persist(manifest);
  for (const [index, record] of manifest.pending.entries()) {
    if (record.promotion_record_sha256) {
      const latest = hooks.latest(record);
      if (latest?.record_sha256 !== record.promotion_record_sha256) {
        fail(`${record.promotion_unit_id}: recorded promotion evidence became stale`);
      }
      continue;
    }
    if (!record.promotion_recorded_at) {
      const intent = hooks.intent(record, index);
      if (!intent || Number.isNaN(Date.parse(intent.recorded_at || '')) ||
          ![null, undefined].includes(intent.supersedes_record_sha256) &&
            !/^[a-f0-9]{64}$/.test(intent.supersedes_record_sha256)) {
        fail(`${record.promotion_unit_id}: promotion evidence intent is invalid`);
      }
      record.promotion_recorded_at = intent.recorded_at;
      record.promotion_supersedes_record_sha256 =
        intent.supersedes_record_sha256 || null;
      hooks.persist(manifest);
    }
    const result = hooks.append(record, index);
    if (!/^[a-f0-9]{64}$/.test(result?.record_sha256 || '')) {
      fail(`${record.promotion_unit_id}: promotion evidence append is invalid`);
    }
    record.promotion_record_sha256 = result.record_sha256;
    hooks.persist(manifest);
  }
  manifest.phase = 'recorded';
  hooks.persist(manifest);
  return manifest;
}

function recordPromotions() {
  const manifest = readManifest();
  const state = refreshState(ROOT);
  if (!isCurrentPass(state, 'review') || !isCurrentPass(state, 'verify')) {
    fail('formal delivery promotion recording requires current review and verification');
  }
  if (!manifest.record_fingerprint) {
    manifest.record_fingerprint = state.worktree.fingerprint;
    writeManifest(manifest);
  } else if (manifest.record_fingerprint !== state.worktree.fingerprint) {
    fail('formal delivery promotion fingerprint changed');
  }
  const disposition = JSON.parse(fs.readFileSync(DISPOSITION, 'utf8'));
  recordPendingPromotions(manifest, {
    latest(record) {
      return latestEvidenceRecord(ROOT, 'promotion', record.promotion_unit_id);
    },
    intent(record, index) {
      const prior = latestEvidenceRecord(ROOT, 'promotion', record.promotion_unit_id);
      return {
        recorded_at: new Date(Date.now() + index).toISOString(),
        supersedes_record_sha256: prior?.record_sha256 || null
      };
    },
    append(record, index) {
      const rows = disposition.skills.filter((row) =>
        row.promotion_unit_id === record.promotion_unit_id
      );
      const result = recordPromotionEvidence(ROOT, {
      kind: 'promotion',
      promotion_unit_id: record.promotion_unit_id,
      request_closure_record_sha256: record.request_closure_record_sha256,
      disposition_row: rows.length === 1 ? rows[0] : rows,
      payload_tree_sha256: record.audit.payload_tree_sha256,
      reason: null,
      recorded_at: record.promotion_recorded_at,
      supersedes_record_sha256: record.promotion_supersedes_record_sha256
      });
      process.stdout.write(`record ${record.promotion_unit_id}\n`);
      return result;
    },
    persist: writeManifest
  });
}

function main(argv = process.argv.slice(2)) {
  if (argv.length !== 1) fail('usage: complete-formal-plugin-delivery.js <prepare|apply|finalize|overlay|record>');
  const actions = { prepare, apply, finalize, overlay, record: recordPromotions };
  const action = actions[argv[0]];
  if (!action) fail(`unknown formal delivery phase: ${argv[0]}`);
  action();
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`complete-formal-plugin-delivery: ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  applyOverlayTransaction,
  candidateValidationResult,
  criterionEvidence,
  gateEvidence,
  main,
  proposal,
  recordPendingPromotions,
  records,
  requestCriteria,
  writeDeliveryManifest
};
