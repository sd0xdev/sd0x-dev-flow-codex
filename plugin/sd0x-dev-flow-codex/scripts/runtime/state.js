'use strict';

const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const {
  DEFAULT_REVIEW_PROVIDER,
  reviewProvider
} = require('./config');
const { findRepoRoot, snapshot, snapshotProjection } = require('./worktree');

const SCHEMA_VERSION = 6;
const LOCK_WAIT_MS = 5_000;
const LOCK_RETRY_MS = 20;
const LOCK_OWNER_GRACE_MS = 1_000;
const LOCK_STALE_MS = 30_000;
const SESSION_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const EXTERNAL_REVIEW_START_RETENTION_MS = 35 * 60 * 1000;
const MAX_EXTERNAL_REVIEW_STARTS = 64;
const EVIDENCE_REF = 'refs/sd0x-dev-flow-codex/evidence/v1';
const EVIDENCE_SCHEMA_VERSION = 1;
const REDACTOR_VERSION = 'sd0x-redactor-v1';

function now() {
  return new Date().toISOString();
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [
      key,
      canonicalValue(value[key])
    ]));
  }
  return value;
}

function canonicalJson(value) {
  return `${JSON.stringify(canonicalValue(value))}\n`;
}

function assertExactKeys(value, expected, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    throw new Error(`${label} fields must exactly equal: ${wanted.join(', ')}`);
  }
}

function redactEvidenceValue(value, root) {
  if (Array.isArray(value)) return value.map((item) => redactEvidenceValue(item, root));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [
      key,
      redactEvidenceValue(item, root)
    ]));
  }
  if (typeof value !== 'string') return value;
  if (/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(value)) {
    throw new Error('Evidence contains private-key material that cannot be safely redacted');
  }
  let output = value;
  const rootAliases = [root, fs.realpathSync(root)];
  if (root.startsWith('/private/')) rootAliases.push(root.slice('/private'.length));
  else if (root.startsWith('/')) rootAliases.push(`/private${root}`);
  const replacements = [
    ...rootAliases.map((candidate) => [candidate, '<repo>']),
    [require('node:os').homedir(), '<home>']
  ].filter(([needle]) => typeof needle === 'string' && needle);
  for (const [needle, replacement] of replacements) {
    output = output.split(needle).join(replacement);
  }
  output = output
    .replace(/\b(?:gh[opsu]_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9_-]{20,}|AKIA[A-Z0-9]{16})\b/g,
      '<secret>')
    .replace(/\bBearer\s+[A-Za-z0-9._~+/-]{12,}=*/gi, 'Bearer <secret>')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '<account>');
  return output;
}

function canonicalEvidenceBlob(cwd, value) {
  const root = findRepoRoot(cwd);
  return canonicalJson({
    redactor_version: REDACTOR_VERSION,
    value: redactEvidenceValue(value, root)
  });
}

function runEvidenceGit(root, args, options = {}) {
  const env = {
    ...(options.env || process.env),
    GIT_CONFIG_GLOBAL: require('node:os').devNull,
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_NO_REPLACE_OBJECTS: '1'
  };
  for (const key of [
    'GIT_ALTERNATE_OBJECT_DIRECTORIES', 'GIT_COMMON_DIR', 'GIT_CONFIG_COUNT',
    'GIT_CONFIG_PARAMETERS', 'GIT_DIR', 'GIT_NAMESPACE', 'GIT_OBJECT_DIRECTORY',
    'GIT_QUARANTINE_PATH', 'GIT_REPLACE_REF_BASE', 'GIT_SHALLOW_FILE',
    'GIT_WORK_TREE'
  ]) delete env[key];
  for (const key of Object.keys(env)) {
    if (/^GIT_CONFIG_(?:KEY|VALUE)_\d+$/.test(key)) delete env[key];
  }
  const result = spawnSync('git', ['--no-replace-objects', ...args], {
    cwd: root,
    encoding: options.encoding === undefined ? 'utf8' : options.encoding,
    input: options.input,
    env,
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true
  });
  if (result.status !== 0) {
    const stderr = Buffer.isBuffer(result.stderr)
      ? result.stderr.toString('utf8')
      : String(result.stderr || '');
    throw new Error(stderr.trim() || `git ${args.join(' ')} failed`);
  }
  return result.stdout;
}

function evidenceRefOid(root) {
  const result = spawnSync('git', ['rev-parse', '--verify', EVIDENCE_REF], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true
  });
  return result.status === 0 ? result.stdout.trim() : null;
}

function evidenceRecordHash(record) {
  const withoutHash = { ...record };
  delete withoutHash.record_sha256;
  return sha256(canonicalJson(withoutHash));
}

function appendEvidenceRevisionUnlocked(cwd, record, blobs = {}, options = {}) {
  const root = findRepoRoot(cwd);
  if (!record || record.schema_version !== EVIDENCE_SCHEMA_VERSION ||
      typeof record.kind !== 'string') {
    throw new Error('Evidence record requires schema_version=1 and kind');
  }
  const recordFields = EVIDENCE_RECORD_FIELDS[record.kind];
  if (!recordFields) throw new Error(`Unsupported evidence record kind: ${record.kind}`);
  assertExactKeys(record, recordFields, `${record.kind} evidence record`);
  const requiredBlobNames = record.kind === 'request-closure-pending'
    ? ['ac.json', 'checks.json', 'subject-review.json', 'verify.json']
    : record.kind === 'request-closure'
      ? ['docs-review.json']
      : record.kind === 'retirement'
        ? ['review.json']
        : ['review.json', 'verify.json'];
  if (JSON.stringify(Object.keys(blobs).sort()) !== JSON.stringify(requiredBlobNames)) {
    throw new Error(`${record.kind} evidence blobs must exactly equal: ${requiredBlobNames.join(', ')}`);
  }
  const recordSha = evidenceRecordHash(record);
  if (record.record_sha256 !== recordSha) {
    throw new Error('Evidence record_sha256 does not match canonical record bytes');
  }
  const oldOid = evidenceRefOid(root);
  if ((options.expected_old_oid || null) !== oldOid) {
    throw new Error('Evidence ref compare-and-swap expectation is stale');
  }
  const files = new Map();
  files.set(`records/${record.kind}/${recordSha}.json`, canonicalJson(record));
  for (const [name, supplied] of Object.entries(blobs)) {
    if (!/^[a-z0-9][a-z0-9-]*\.json$/.test(name)) {
      throw new Error(`Invalid evidence blob name: ${name}`);
    }
    const value = supplied && typeof supplied === 'object' &&
        Object.keys(supplied).sort().join(',') === 'field,value'
      ? supplied.value
      : supplied;
    const bytes = canonicalEvidenceBlob(root, value);
    const field = supplied && typeof supplied === 'object' &&
        Object.keys(supplied).sort().join(',') === 'field,value'
      ? supplied.field
      : `${name.slice(0, -5).replace(/-/g, '_')}_sha256`;
    if (record[field] !== sha256(bytes)) {
      throw new Error(`Evidence blob hash mismatch: ${field}`);
    }
    files.set(`evidence/${recordSha}/${name}`, bytes);
  }

  const indexPath = resolveRuntimeMetadataPath(root,
    `evidence-index-${process.pid}-${crypto.randomUUID()}`);
  const env = {
    ...process.env,
    GIT_INDEX_FILE: indexPath,
    GIT_AUTHOR_NAME: 'sd0x Dev Flow',
    GIT_AUTHOR_EMAIL: 'sd0x@local.invalid',
    GIT_AUTHOR_DATE: record.recorded_at,
    GIT_COMMITTER_NAME: 'sd0x Dev Flow',
    GIT_COMMITTER_EMAIL: 'sd0x@local.invalid',
    GIT_COMMITTER_DATE: record.recorded_at
  };
  try {
    fs.mkdirSync(path.dirname(indexPath), { recursive: true });
    if (oldOid) runEvidenceGit(root, ['read-tree', `${oldOid}^{tree}`], { env });
    for (const [filePath, bytes] of files) {
      const oid = String(runEvidenceGit(root, ['hash-object', '-w', '--stdin'], {
        env,
        input: bytes
      })).trim();
      runEvidenceGit(root, [
        'update-index', '--add', '--cacheinfo', `100644,${oid},${filePath}`
      ], { env });
    }
    const tree = String(runEvidenceGit(root, ['write-tree'], { env })).trim();
    const commitArgs = ['commit-tree', tree];
    if (oldOid) commitArgs.push('-p', oldOid);
    commitArgs.push('-m', `sd0x evidence: ${record.kind} ${recordSha}`);
    const commitOid = String(runEvidenceGit(root, commitArgs, { env })).trim();
    runEvidenceGit(root, [
      'update-ref', EVIDENCE_REF, commitOid, oldOid || '0'.repeat(40)
    ], { env });
    return { ref: EVIDENCE_REF, old_oid: oldOid, oid: commitOid, record_sha256: recordSha };
  } finally {
    fs.rmSync(indexPath, { force: true });
    fs.rmSync(`${indexPath}.lock`, { force: true });
  }
}

function appendEvidenceRevision(cwd, record, blobs = {}, options = {}) {
  let result;
  withStateLock(cwd, (state) => {
    result = appendEvidenceRevisionUnlocked(cwd, record, blobs, options);
    return state;
  });
  return result;
}

function readEvidenceRecord(cwd, recordSha) {
  if (!/^[a-f0-9]{64}$/.test(recordSha || '')) {
    throw new Error('Evidence record hash is invalid');
  }
  const root = findRepoRoot(cwd);
  const oid = evidenceRefOid(root);
  if (!oid) throw new Error('Evidence ref is missing');
  const paths = String(runEvidenceGit(root, ['ls-tree', '-r', '--name-only', oid]))
    .trim().split('\n').filter(Boolean);
  const recordPath = paths.find((file) =>
    file.startsWith('records/') && file.endsWith(`/${recordSha}.json`)
  );
  if (!recordPath) throw new Error(`Evidence record is missing: ${recordSha}`);
  const bytes = String(runEvidenceGit(root, ['show', `${oid}:${recordPath}`]));
  const record = JSON.parse(bytes);
  if (canonicalJson(record) !== bytes || evidenceRecordHash(record) !== recordSha ||
      record.record_sha256 !== recordSha) {
    throw new Error(`Evidence record is corrupt: ${recordSha}`);
  }
  return { oid, path: recordPath, record };
}

function requestPathInRoot(root, requestPath) {
  if (typeof requestPath !== 'string' ||
      !/^docs\/features\/[A-Za-z0-9._-]+\/requests\/[A-Za-z0-9._-]+\.md$/.test(
        requestPath.replace(/\\/g, '/')
      )) {
    throw new Error('Closure request_path must be one canonical feature request Markdown path');
  }
  const relative = requestPath.replace(/\\/g, '/');
  const absolute = path.resolve(root, ...relative.split('/'));
  const containment = path.relative(root, absolute);
  if (containment === '..' || containment.startsWith(`..${path.sep}`) ||
      path.isAbsolute(containment)) {
    throw new Error('Closure request path escapes the repository');
  }
  return { relative, absolute };
}

function requestDefinition(markdown) {
  const normalized = String(markdown).replace(/\r\n/g, '\n');
  const title = /^#\s+(.+)$/m.exec(normalized)?.[1]?.trim();
  if (!title) throw new Error('Closure request requires a title');
  const sectionAfter = (heading) => {
    const match = new RegExp(`^## ${heading}\\s*$\\n([\\s\\S]*)`, 'm').exec(normalized);
    return match ? match[1].split(/^##\s/m, 1)[0] : null;
  };
  const scope = sectionAfter('Scope')?.trim().replace(/\s+/g, ' ') || '';
  const section = sectionAfter('Acceptance Criteria');
  if (!section) throw new Error('Closure request requires Acceptance Criteria');
  const criteria = section.split('\n').map((line) =>
    /^\s*-\s*\[[ xX]\]\s*(.+?)\s*$/.exec(line)?.[1]?.replace(/\s+/g, ' ')
  ).filter(Boolean);
  if (criteria.length === 0) throw new Error('Closure request has no acceptance criteria');
  return { title, scope, criteria };
}

function completedRequest(markdown) {
  const acceptance = /^## Acceptance Criteria\s*$\n([\s\S]*)/m.exec(String(markdown))?.[1]
    ?.split(/^##\s/m, 1)[0] || '';
  return /^>\s*\*\*Status\*\*:\s*Completed\s*$/m.test(String(markdown)) &&
    requestDefinition(markdown).criteria.every((criterion) => criterion.length > 0) &&
    !/^\s*-\s*\[\s\]/m.test(acceptance);
}

function evidenceBlobHash(cwd, value) {
  return sha256(canonicalEvidenceBlob(cwd, value));
}

function prepareRequestClosure(cwd, options) {
  const root = findRepoRoot(cwd);
  assertExactKeys(options, [
    'promotion_unit_id', 'request_path', 'proposed_request', 'subject', 'evidence',
    'recorded_at', 'supersedes_record_sha256'
  ], 'closure prepare options');
  assertExactKeys(options.evidence, [
    'subject_review', 'verify', 'ac', 'checks'
  ], 'closure prepare evidence');
  const request = requestPathInRoot(root, options.request_path);
  if (!fs.existsSync(request.absolute)) throw new Error('Closure request does not exist');
  const currentBytes = fs.readFileSync(request.absolute);
  const proposedBytes = Buffer.from(options.proposed_request);
  if (!completedRequest(proposedBytes.toString('utf8'))) {
    throw new Error('Closure proposed request must be Completed with every AC checked');
  }
  if (completedRequest(currentBytes.toString('utf8'))) {
    throw new Error('Closure prepare must run before writing Completed request bytes');
  }
  const definition = requestDefinition(proposedBytes.toString('utf8'));
  const projection = snapshotProjection(root, [request.relative]);
  const record = {
    schema_version: EVIDENCE_SCHEMA_VERSION,
    kind: 'request-closure-pending',
    promotion_unit_id: options.promotion_unit_id,
    request_path: request.relative,
    prior_request_content_sha256: sha256(currentBytes),
    proposed_request_content_sha256: sha256(proposedBytes),
    ac_definition_sha256: sha256(canonicalJson(definition)),
    non_request_projection_sha256: projection.fingerprint,
    subject: canonicalValue(options.subject),
    subject_review_evidence_sha256: evidenceBlobHash(root, options.evidence.subject_review),
    verify_evidence_sha256: evidenceBlobHash(root, options.evidence.verify),
    ac_evidence_sha256: evidenceBlobHash(root, options.evidence.ac),
    checks_evidence_sha256: evidenceBlobHash(root, options.evidence.checks),
    recorded_at: options.recorded_at || now(),
    supersedes_record_sha256: options.supersedes_record_sha256 || null
  };
  record.record_sha256 = evidenceRecordHash(record);
  const result = appendEvidenceRevision(root, record, {
    'subject-review.json': {
      field: 'subject_review_evidence_sha256', value: options.evidence.subject_review
    },
    'verify.json': { field: 'verify_evidence_sha256', value: options.evidence.verify },
    'ac.json': { field: 'ac_evidence_sha256', value: options.evidence.ac },
    'checks.json': { field: 'checks_evidence_sha256', value: options.evidence.checks }
  }, { expected_old_oid: evidenceRefOid(root) });
  return { ...result, record };
}

function finalizeRequestClosure(cwd, options) {
  const root = findRepoRoot(cwd);
  assertExactKeys(options, [
    'pending_record_sha256', 'recorded_at', 'supersedes_record_sha256'
  ], 'closure finalize options');
  const pending = readEvidenceRecord(root, options.pending_record_sha256).record;
  if (pending.kind !== 'request-closure-pending') {
    throw new Error('Closure finalize requires a pending record');
  }
  const request = requestPathInRoot(root, pending.request_path);
  const requestBytes = fs.readFileSync(request.absolute);
  if (sha256(requestBytes) !== pending.proposed_request_content_sha256 ||
      !completedRequest(requestBytes.toString('utf8'))) {
    throw new Error('Closure request bytes drifted from the pending Completed proposal');
  }
  const projection = snapshotProjection(root, [request.relative]);
  if (projection.fingerprint !== pending.non_request_projection_sha256) {
    throw new Error('Closure non-request projection drifted after prepare');
  }
  const state = refreshState(root);
  if (!isCurrentPass(state, 'review')) {
    throw new Error('Closure finalize requires a current docs review pass');
  }
  const docsReview = state.gates.review.evidence;
  const record = {
    schema_version: EVIDENCE_SCHEMA_VERSION,
    kind: 'request-closure',
    promotion_unit_id: pending.promotion_unit_id,
    pending_record_sha256: pending.record_sha256,
    request_path: request.relative,
    request_content_sha256: sha256(requestBytes),
    ac_definition_sha256: pending.ac_definition_sha256,
    subject_review_evidence_sha256: pending.subject_review_evidence_sha256,
    docs_review_evidence_sha256: evidenceBlobHash(root, docsReview),
    docs_fingerprint: state.worktree.fingerprint,
    recorded_at: options.recorded_at || now(),
    supersedes_record_sha256: options.supersedes_record_sha256 || null
  };
  record.record_sha256 = evidenceRecordHash(record);
  const result = appendEvidenceRevision(root, record, {
    'docs-review.json': {
      field: 'docs_review_evidence_sha256', value: docsReview
    }
  }, { expected_old_oid: evidenceRefOid(root) });
  return { ...result, record };
}

function recordPromotionEvidence(cwd, options) {
  const root = findRepoRoot(cwd);
  assertExactKeys(options, [
    'kind', 'promotion_unit_id', 'request_closure_record_sha256',
    'disposition_row', 'payload_tree_sha256', 'reason', 'recorded_at',
    'supersedes_record_sha256'
  ], 'promotion evidence options');
  if (!['promotion', 'pack-ready', 'retirement'].includes(options.kind)) {
    throw new Error(`Unsupported promotion evidence kind: ${options.kind}`);
  }
  const closure = readEvidenceRecord(root, options.request_closure_record_sha256).record;
  if (closure.kind !== 'request-closure' ||
      closure.promotion_unit_id !== options.promotion_unit_id) {
    throw new Error('Promotion evidence requires a matching final request closure');
  }
  const request = requestPathInRoot(root, closure.request_path);
  const requestBytes = fs.readFileSync(request.absolute);
  if (sha256(requestBytes) !== closure.request_content_sha256 ||
      sha256(canonicalJson(requestDefinition(requestBytes.toString('utf8')))) !==
        closure.ac_definition_sha256 || !completedRequest(requestBytes.toString('utf8'))) {
    throw new Error('Promotion request closure is stale or the request is no longer Completed');
  }
  const row = options.disposition_row;
  if (!row || row.promotion_unit_id !== options.promotion_unit_id) {
    throw new Error('Promotion disposition row does not match the unit');
  }
  const state = refreshState(root);
  if (!isCurrentPass(state, 'review')) {
    throw new Error('Promotion evidence requires a current final review pass');
  }
  const retirement = options.kind === 'retirement';
  if (!retirement && !isCurrentPass(state, 'verify')) {
    throw new Error('Promotion evidence requires a current final verification pass');
  }
  if (options.kind === 'promotion' &&
      (row.target_package !== 'core' || row.delivery_state === 'pack-ready')) {
    throw new Error('Core promotion requires a core non-pack-ready disposition row');
  }
  if (options.kind === 'pack-ready' &&
      ['core', 'retired'].includes(row.target_package)) {
    throw new Error('Pack-ready evidence requires a non-core package row');
  }
  if (retirement && (row.target_package !== 'retired' ||
      row.delivery_state !== 'retired' || row.disposition !== 'retire' ||
      row.license_status !== 'approved' || !options.reason ||
      options.payload_tree_sha256 !== null)) {
    throw new Error('Retirement requires retired disposition, approved reason, and null payload');
  }
  if (!retirement && !/^[a-f0-9]{64}$/.test(options.payload_tree_sha256 || '')) {
    throw new Error('Promotion evidence requires a payload tree SHA-256');
  }
  const reviewEvidence = state.gates.review.evidence;
  const verifyEvidence = retirement ? null : state.gates.verify.evidence;
  const record = {
    schema_version: EVIDENCE_SCHEMA_VERSION,
    kind: options.kind,
    promotion_unit_id: options.promotion_unit_id,
    request_path: request.relative,
    request_status: 'Completed',
    request_content_sha256: closure.request_content_sha256,
    ac_definition_sha256: closure.ac_definition_sha256,
    request_closure_record_sha256: closure.record_sha256,
    disposition_row_sha256: sha256(canonicalJson(row)),
    payload_tree_sha256: retirement ? null : options.payload_tree_sha256,
    final_fingerprint: state.worktree.fingerprint,
    head_sha: String(runEvidenceGit(root, ['rev-parse', 'HEAD'])).trim(),
    review_evidence_sha256: evidenceBlobHash(root, reviewEvidence),
    verify_evidence_sha256: retirement ? null : evidenceBlobHash(root, verifyEvidence),
    reason: retirement ? options.reason : null,
    recorded_at: options.recorded_at || now(),
    supersedes_record_sha256: options.supersedes_record_sha256 || null
  };
  record.record_sha256 = evidenceRecordHash(record);
  const blobs = {
    'review.json': { field: 'review_evidence_sha256', value: reviewEvidence }
  };
  if (!retirement) {
    blobs['verify.json'] = {
      field: 'verify_evidence_sha256', value: verifyEvidence
    };
  }
  const result = appendEvidenceRevision(root, record, blobs, {
    expected_old_oid: evidenceRefOid(root)
  });
  return { ...result, record };
}

const EVIDENCE_RECORD_FIELDS = {
  'request-closure-pending': [
    'schema_version', 'kind', 'promotion_unit_id', 'request_path',
    'prior_request_content_sha256', 'proposed_request_content_sha256',
    'ac_definition_sha256', 'non_request_projection_sha256', 'subject',
    'subject_review_evidence_sha256', 'verify_evidence_sha256',
    'ac_evidence_sha256', 'checks_evidence_sha256', 'recorded_at',
    'supersedes_record_sha256', 'record_sha256'
  ],
  'request-closure': [
    'schema_version', 'kind', 'promotion_unit_id', 'pending_record_sha256',
    'request_path', 'request_content_sha256', 'ac_definition_sha256',
    'subject_review_evidence_sha256', 'docs_review_evidence_sha256',
    'docs_fingerprint', 'recorded_at', 'supersedes_record_sha256',
    'record_sha256'
  ],
  promotion: [
    'schema_version', 'kind', 'promotion_unit_id', 'request_path',
    'request_status', 'request_content_sha256', 'ac_definition_sha256',
    'request_closure_record_sha256', 'disposition_row_sha256',
    'payload_tree_sha256', 'final_fingerprint', 'head_sha',
    'review_evidence_sha256', 'verify_evidence_sha256', 'reason',
    'recorded_at', 'supersedes_record_sha256', 'record_sha256'
  ],
  'pack-ready': null,
  retirement: null
};
EVIDENCE_RECORD_FIELDS['pack-ready'] = EVIDENCE_RECORD_FIELDS.promotion;
EVIDENCE_RECORD_FIELDS.retirement = EVIDENCE_RECORD_FIELDS.promotion;

function evidenceFileBytes(root, oid, filePath) {
  return String(runEvidenceGit(root, ['show', `${oid}:${filePath}`]));
}

function auditEvidenceLedger(cwd, expected = {}) {
  const root = findRepoRoot(cwd);
  const oid = evidenceRefOid(root);
  if (!oid) throw new Error('Evidence ref is missing');
  const history = String(runEvidenceGit(root, [
    'rev-list', '--reverse', '--parents', EVIDENCE_REF
  ])).trim().split('\n').filter(Boolean).map((line) => line.split(' '));
  for (let index = 0; index < history.length; index += 1) {
    const entry = history[index];
    if (index === 0 && entry.length !== 1) {
      throw new Error('Evidence root commit must have no parent');
    }
    if (index > 0 && (entry.length !== 2 || entry[1] !== history[index - 1][0])) {
      throw new Error('Evidence commit history must be one parent-linked append chain');
    }
  }
  const paths = String(runEvidenceGit(root, ['ls-tree', '-r', '--name-only', oid]))
    .trim().split('\n').filter(Boolean);
  if (paths.some((file) => !/^(?:records\/[a-z-]+\/[a-f0-9]{64}\.json|evidence\/[a-f0-9]{64}\/[a-z0-9-]+\.json)$/.test(file))) {
    throw new Error('Evidence tree contains an unsupported path');
  }
  const records = new Map();
  for (const filePath of paths.filter((file) => file.startsWith('records/'))) {
    const bytes = evidenceFileBytes(root, oid, filePath);
    const record = JSON.parse(bytes);
    const fields = EVIDENCE_RECORD_FIELDS[record.kind];
    if (!fields) throw new Error(`Evidence contains unknown record kind: ${record.kind}`);
    assertExactKeys(record, fields, `${record.kind} evidence record`);
    if (record.schema_version !== EVIDENCE_SCHEMA_VERSION ||
        canonicalJson(record) !== bytes || evidenceRecordHash(record) !== record.record_sha256 ||
        !filePath.endsWith(`/${record.record_sha256}.json`)) {
      throw new Error(`Evidence record is corrupt: ${filePath}`);
    }
    if (records.has(record.record_sha256)) throw new Error('Duplicate evidence record hash');
    records.set(record.record_sha256, record);
  }
  const requiredBlobs = (record) => {
    if (record.kind === 'request-closure-pending') return [
      ['subject-review.json', 'subject_review_evidence_sha256'],
      ['verify.json', 'verify_evidence_sha256'],
      ['ac.json', 'ac_evidence_sha256'],
      ['checks.json', 'checks_evidence_sha256']
    ];
    if (record.kind === 'request-closure') {
      return [['docs-review.json', 'docs_review_evidence_sha256']];
    }
    return record.kind === 'retirement'
      ? [['review.json', 'review_evidence_sha256']]
      : [['review.json', 'review_evidence_sha256'], ['verify.json', 'verify_evidence_sha256']];
  };
  for (const record of records.values()) {
    for (const [name, field] of requiredBlobs(record)) {
      const blobPath = `evidence/${record.record_sha256}/${name}`;
      if (!paths.includes(blobPath) ||
          sha256(evidenceFileBytes(root, oid, blobPath)) !== record[field]) {
        throw new Error(`Evidence blob is missing or corrupt: ${blobPath}`);
      }
    }
    if (record.supersedes_record_sha256 !== null) {
      const prior = records.get(record.supersedes_record_sha256);
      if (!prior || prior.kind !== record.kind ||
          prior.promotion_unit_id !== record.promotion_unit_id) {
        throw new Error('Evidence supersedes link is missing or crosses record kind/unit');
      }
    }
    if (record.kind === 'request-closure') {
      const pending = records.get(record.pending_record_sha256);
      if (!pending || pending.kind !== 'request-closure-pending' ||
          pending.promotion_unit_id !== record.promotion_unit_id ||
          pending.proposed_request_content_sha256 !== record.request_content_sha256 ||
          pending.ac_definition_sha256 !== record.ac_definition_sha256 ||
          pending.subject_review_evidence_sha256 !== record.subject_review_evidence_sha256) {
        throw new Error('Final closure does not exactly match its pending record');
      }
    }
    if (['promotion', 'pack-ready', 'retirement'].includes(record.kind)) {
      const closure = records.get(record.request_closure_record_sha256);
      if (!closure || closure.kind !== 'request-closure' ||
          closure.promotion_unit_id !== record.promotion_unit_id ||
          closure.request_content_sha256 !== record.request_content_sha256 ||
          closure.ac_definition_sha256 !== record.ac_definition_sha256) {
        throw new Error('Promotion evidence does not match its final closure');
      }
      if (record.kind === 'retirement' &&
          (record.payload_tree_sha256 !== null || record.verify_evidence_sha256 !== null)) {
        throw new Error('Retirement evidence must have null payload and verify evidence');
      }
    }
  }
  const selected = expected.promotion_unit_id
    ? [...records.values()].filter((record) =>
        record.promotion_unit_id === expected.promotion_unit_id &&
        ['promotion', 'pack-ready', 'retirement'].includes(record.kind)
      ).sort((left, right) =>
        Date.parse(left.recorded_at) - Date.parse(right.recorded_at)
      ).at(-1)
    : null;
  if (expected.promotion_unit_id && !selected) {
    throw new Error(`Evidence has no completion record for ${expected.promotion_unit_id}`);
  }
  if (selected) {
    for (const [field, value] of Object.entries(expected)) {
      if (field === 'promotion_unit_id') continue;
      if (selected[field] !== value) {
        throw new Error(`Evidence completion mismatch for ${field}`);
      }
    }
    const request = requestPathInRoot(root, selected.request_path);
    const bytes = fs.readFileSync(request.absolute);
    if (sha256(bytes) !== selected.request_content_sha256 ||
        sha256(canonicalJson(requestDefinition(bytes.toString('utf8')))) !==
          selected.ac_definition_sha256 || !completedRequest(bytes.toString('utf8'))) {
      throw new Error('Current request no longer matches durable completion evidence');
    }
  }
  return {
    ok: true,
    ref: EVIDENCE_REF,
    oid,
    commits: history.length,
    records: records.size,
    selected: selected || null
  };
}

function pruneExternalReviewStarts(values, referenceTime = Date.now()) {
  if (!Array.isArray(values)) return [];
  const cutoff = referenceTime - EXTERNAL_REVIEW_START_RETENTION_MS;
  return values.filter((entry) =>
    entry && Number.isFinite(Date.parse(entry.recorded_at)) &&
    Date.parse(entry.recorded_at) >= cutoff
  ).slice(-MAX_EXTERNAL_REVIEW_STARTS);
}

function sameRealPath(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  try {
    return fs.realpathSync(left) === fs.realpathSync(right);
  } catch {
    return path.resolve(left) === path.resolve(right);
  }
}

function defaultGate() {
  return {
    status: 'pending',
    fingerprint: null,
    evidence: null,
    updated_at: null
  };
}

function defaultState() {
  return {
    schema_version: SCHEMA_VERSION,
    runtime_epoch: crypto.randomUUID(),
    review_provider: DEFAULT_REVIEW_PROVIDER,
    sessions: [],
    updated_at: now(),
    worktree: {
      root: null,
      fingerprint: 'clean',
      files: [],
      code_files: [],
      doc_files: [],
      other_files: [],
      requires_review: false,
      requires_verify: false
    },
    gates: {
      review: defaultGate(),
      verify: defaultGate()
    },
    review_agents: {
      fingerprint: null,
      started: [],
      completed: []
    },
    external_review: {
      fingerprint: null,
      started: [],
      completed: []
    }
  };
}

function resolveRuntimeMetadataPath(cwd, relativePath) {
  const root = findRepoRoot(cwd);
  const gitRelativePath = path.posix.join(
    'sd0x-dev-flow-codex',
    ...relativePath.split(path.sep)
  );
  const result = spawnSync('git', [
    'rev-parse', '--git-path', gitRelativePath
  ], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true
  });

  if (result.status === 0 && result.stdout.trim()) {
    const candidate = result.stdout.trim();
    return path.isAbsolute(candidate) ? candidate : path.resolve(root, candidate);
  }

  return path.join(root, '.sd0x', relativePath);
}

function resolveStatePath(cwd = process.cwd()) {
  if (process.env.SD0X_STATE_PATH) {
    return path.resolve(process.env.SD0X_STATE_PATH);
  }
  return resolveRuntimeMetadataPath(cwd, 'runtime-state.json');
}

function runtimeStateGeneration(cwd = process.cwd()) {
  const filePath = resolveStatePath(cwd);
  try {
    const bytes = fs.readFileSync(filePath);
    try {
      const value = JSON.parse(bytes.toString('utf8'));
      if (typeof value?.runtime_epoch === 'string' && value.runtime_epoch) {
        return `epoch:${value.runtime_epoch}`;
      }
    } catch {
      // Bind malformed state to its exact bytes so reset invalidates late markers.
    }
    return `bytes:${sha256(bytes)}`;
  } catch (error) {
    if (error.code === 'ENOENT') return 'missing';
    throw error;
  }
}

function activationFailurePath(cwd, sessionId) {
  if (typeof sessionId !== 'string' || !sessionId) return null;
  const digest = crypto.createHash('sha256').update(sessionId).digest('hex');
  return resolveRuntimeMetadataPath(
    cwd,
    path.join('activation-failures', `${digest}.json`)
  );
}

function fallbackActivationFailurePath(cwd, sessionId) {
  if (typeof sessionId !== 'string' || !sessionId) return null;
  const digest = crypto.createHash('sha256').update(sessionId).digest('hex');
  return path.join(
    findRepoRoot(cwd),
    '.sd0x',
    'sd0x-dev-flow-codex',
    'activation-failures',
    `${digest}.json`
  );
}

function activationFailurePaths(cwd, sessionId) {
  return [...new Set([
    activationFailurePath(cwd, sessionId),
    fallbackActivationFailurePath(cwd, sessionId)
  ].filter(Boolean))];
}

function setupDeferralPath(cwd) {
  return resolveRuntimeMetadataPath(cwd, 'setup-deferral.json');
}

function writeRuntimeMarker(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${process.pid}.${crypto.randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporary, `${JSON.stringify(value)}\n`, { mode: 0o600 });
    fs.renameSync(temporary, filePath);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
}

function markSessionActivationFailure(
  cwd,
  sessionId,
  runtimeGeneration = runtimeStateGeneration(cwd)
) {
  const paths = activationFailurePaths(cwd, sessionId);
  if (paths.length === 0) return false;
  let lastError;
  for (const filePath of paths) {
    try {
      writeRuntimeMarker(filePath, {
        session_id: sessionId,
        runtime_generation: runtimeGeneration,
        recorded_at: now()
      });
      return true;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

function clearSessionActivationFailure(cwd, sessionId) {
  let existed = false;
  for (const filePath of activationFailurePaths(cwd, sessionId)) {
    existed = fs.existsSync(filePath) || existed;
    fs.rmSync(filePath, { force: true });
  }
  return existed;
}

function clearAllSessionActivationFailures(cwd) {
  const probeSession = 'sd0x-corrupt-reset-probe';
  const directories = new Set(activationFailurePaths(cwd, probeSession).map((filePath) =>
    path.dirname(filePath)
  ));
  for (const directory of directories) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

function hasSessionActivationFailure(cwd, sessionId, runtimeGeneration) {
  return activationFailurePaths(cwd, sessionId).some((filePath) => {
    if (!fs.existsSync(filePath)) return false;
    if (runtimeGeneration === undefined) return true;
    try {
      const marker = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return marker.runtime_generation === runtimeGeneration;
    } catch {
      return false;
    }
  });
}

function markSetupDeferral(cwd, claimToken = crypto.randomUUID()) {
  if (typeof claimToken !== 'string' || claimToken.length < 16 ||
      claimToken.length > 200) {
    throw new Error('Setup deferral requires a valid claim token');
  }
  writeRuntimeMarker(setupDeferralPath(cwd), {
    session_id: null,
    claim_token: claimToken,
    recorded_at: now()
  });
  return claimToken;
}

function clearSetupDeferral(cwd) {
  const filePath = setupDeferralPath(cwd);
  const existed = fs.existsSync(filePath);
  fs.rmSync(filePath, { force: true });
  return existed;
}

function readSetupDeferral(filePath) {
  try {
    const value = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return value && typeof value === 'object' ? value : null;
  } catch {
    return null;
  }
}

function restoreClaimedMarker(filePath, claimed) {
  if (fs.existsSync(filePath)) {
    fs.rmSync(claimed, { force: true });
    return;
  }
  fs.renameSync(claimed, filePath);
}

function hasSetupDeferral(cwd, sessionId) {
  const filePath = setupDeferralPath(cwd);
  if (sessionId === undefined) return fs.existsSync(filePath);
  const marker = readSetupDeferral(filePath);
  return Boolean(
    marker && typeof sessionId === 'string' && sessionId &&
    marker.session_id === sessionId
  );
}

function claimSetupDeferral(cwd, sessionId, claimToken) {
  if (typeof sessionId !== 'string' || !sessionId ||
      typeof claimToken !== 'string' || !claimToken) return false;
  const filePath = setupDeferralPath(cwd);
  const observed = readSetupDeferral(filePath);
  if (!observed || observed.claim_token !== claimToken ||
      (observed.session_id && observed.session_id !== sessionId)) {
    return false;
  }
  const claimed = `${filePath}.claimed.${process.pid}.${crypto.randomUUID()}`;
  try {
    fs.renameSync(filePath, claimed);
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
  const marker = readSetupDeferral(claimed);
  if (!marker || marker.claim_token !== claimToken ||
      (marker.session_id && marker.session_id !== sessionId)) {
    restoreClaimedMarker(filePath, claimed);
    return false;
  }
  if (fs.existsSync(filePath)) {
    fs.rmSync(claimed, { force: true });
    return false;
  }
  writeRuntimeMarker(filePath, {
    ...marker,
    session_id: sessionId,
    claimed_at: now()
  });
  fs.rmSync(claimed, { force: true });
  return true;
}

function consumeSetupDeferral(cwd, sessionId) {
  if (typeof sessionId !== 'string' || !sessionId) return false;
  const filePath = setupDeferralPath(cwd);
  const claimed = `${filePath}.claimed.${process.pid}.${crypto.randomUUID()}`;
  try {
    fs.renameSync(filePath, claimed);
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
  const marker = readSetupDeferral(claimed);
  if (!marker || marker.session_id !== sessionId) {
    restoreClaimedMarker(filePath, claimed);
    return false;
  }
  fs.rmSync(claimed, { force: true });
  return true;
}

function assertCurrentStateShape(value) {
  const object = (candidate, label) => {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
      throw new Error(`${label} must be an object`);
    }
  };
  const timestamp = (candidate, label, nullable = false) => {
    if (nullable && candidate === null) return;
    if (typeof candidate !== 'string' || !Number.isFinite(Date.parse(candidate))) {
      throw new Error(`${label} must be an ISO timestamp${nullable ? ' or null' : ''}`);
    }
  };
  const fingerprint = (candidate, label, nullable = false) => {
    if (nullable && candidate === null) return;
    if (candidate !== 'clean' &&
        (typeof candidate !== 'string' || !/^[a-f0-9]{64}$/.test(candidate))) {
      throw new Error(`${label} must be a worktree fingerprint${nullable ? ' or null' : ''}`);
    }
  };
  const strings = (candidate, label) => {
    if (!Array.isArray(candidate) || candidate.some((item) => typeof item !== 'string')) {
      throw new Error(`${label} must be an array of strings`);
    }
  };
  const collection = (candidate, label) => {
    object(candidate, label);
    fingerprint(candidate.fingerprint, `${label}.fingerprint`, true);
    if (!Array.isArray(candidate.started) || !Array.isArray(candidate.completed)) {
      throw new Error(`${label} must contain started and completed arrays`);
    }
  };
  const nonEmptyString = (candidate, label) => {
    if (typeof candidate !== 'string' || !candidate) {
      throw new Error(`${label} must be a non-empty string`);
    }
  };
  const digest = (candidate, label) => {
    if (typeof candidate !== 'string' || !/^[a-f0-9]{64}$/.test(candidate)) {
      throw new Error(`${label} must be a SHA-256 digest`);
    }
  };

  object(value, 'runtime state');
  if (typeof value.runtime_epoch !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        .test(value.runtime_epoch)) {
    throw new Error('runtime state.runtime_epoch must be a UUID');
  }
  if (!['codex', 'claude'].includes(value.review_provider)) {
    throw new Error('runtime state.review_provider is invalid');
  }
  timestamp(value.updated_at, 'runtime state.updated_at');
  if (!Array.isArray(value.sessions)) {
    throw new Error('runtime state.sessions must be an array');
  }
  for (const session of value.sessions) {
    object(session, 'runtime state session');
    if (typeof session.session_id !== 'string' || !session.session_id) {
      throw new Error('runtime state session_id must be a non-empty string');
    }
    timestamp(session.started_at, 'runtime state session.started_at');
    timestamp(session.updated_at, 'runtime state session.updated_at');
  }

  object(value.worktree, 'runtime state.worktree');
  if (value.worktree.root !== null && typeof value.worktree.root !== 'string') {
    throw new Error('runtime state.worktree.root must be a string or null');
  }
  fingerprint(value.worktree.fingerprint, 'runtime state.worktree.fingerprint');
  for (const field of ['files', 'code_files', 'doc_files', 'other_files']) {
    strings(value.worktree[field], `runtime state.worktree.${field}`);
  }
  for (const field of ['requires_review', 'requires_verify']) {
    if (typeof value.worktree[field] !== 'boolean') {
      throw new Error(`runtime state.worktree.${field} must be boolean`);
    }
  }

  object(value.gates, 'runtime state.gates');
  for (const gateName of ['review', 'verify']) {
    const gate = value.gates[gateName];
    object(gate, `runtime state.gates.${gateName}`);
    if (!['pending', 'pass', 'fail'].includes(gate.status)) {
      throw new Error(`runtime state.gates.${gateName}.status is invalid`);
    }
    if (gate.status === 'pending') {
      if (gate.fingerprint !== null || gate.evidence !== null || gate.updated_at !== null) {
        throw new Error(`pending ${gateName} gate must not contain evidence`);
      }
    } else {
      fingerprint(gate.fingerprint, `runtime state.gates.${gateName}.fingerprint`);
      if (gate.fingerprint !== value.worktree.fingerprint) {
        throw new Error(`${gateName} gate fingerprint does not match the worktree`);
      }
      object(gate.evidence, `runtime state.gates.${gateName}.evidence`);
      timestamp(gate.updated_at, `runtime state.gates.${gateName}.updated_at`);
      validateEvidence(gateName, gate.status, gate.evidence, value.review_provider);
      if (gateName === 'verify' && gate.status === 'pass' &&
          gate.evidence.runner !== 'sd0x-deterministic-v1') {
        throw new Error('passing verification evidence has an invalid runner');
      }
    }
  }
  if (value.gates.verify.status === 'pass' && value.gates.review.status !== 'pass') {
    throw new Error('passing verification evidence requires a passing review gate');
  }

  collection(value.review_agents, 'runtime state.review_agents');
  collection(value.external_review, 'runtime state.external_review');
  for (const collectionName of ['review_agents', 'external_review']) {
    const candidate = value[collectionName];
    if ((candidate.started.length > 0 || candidate.completed.length > 0) &&
        candidate.fingerprint !== value.worktree.fingerprint) {
      throw new Error(`runtime state.${collectionName} fingerprint does not match the worktree`);
    }
  }

  const nativeTypes = requiredReviewers(value.review_provider);
  for (const entry of value.review_agents.started) {
    assertExactKeys(entry, ['agent_id', 'agent_type', 'recorded_at'],
      'runtime state native reviewer start');
    nonEmptyString(entry.agent_id, 'native reviewer start agent_id');
    if (!nativeTypes.includes(entry.agent_type)) {
      throw new Error('native reviewer start agent_type is not authoritative');
    }
    timestamp(entry.recorded_at, 'native reviewer start recorded_at');
  }
  for (const entry of value.review_agents.completed) {
    assertExactKeys(entry, [
      'agent_id', 'agent_type', 'recorded_at', 'started_at', 'result_sha256',
      'outcome', 'has_transcript'
    ], 'runtime state native reviewer result');
    nonEmptyString(entry.agent_id, 'native reviewer result agent_id');
    if (!nativeTypes.includes(entry.agent_type)) {
      throw new Error('native reviewer result agent_type is not authoritative');
    }
    timestamp(entry.recorded_at, 'native reviewer result recorded_at');
    timestamp(entry.started_at, 'native reviewer result started_at');
    digest(entry.result_sha256, 'native reviewer result result_sha256');
    if (!['clean', 'findings'].includes(entry.outcome) ||
        typeof entry.has_transcript !== 'boolean') {
      throw new Error('native reviewer result outcome or transcript flag is invalid');
    }
  }
  for (const entry of value.external_review.started) {
    assertExactKeys(entry, [
      'session_id', 'tool_use_id', 'runtime_epoch', 'recorded_at'
    ], 'runtime state external review start');
    nonEmptyString(entry.session_id, 'external review start session_id');
    nonEmptyString(entry.tool_use_id, 'external review start tool_use_id');
    if (entry.runtime_epoch !== value.runtime_epoch) {
      throw new Error('external review start runtime_epoch is stale');
    }
    timestamp(entry.recorded_at, 'external review start recorded_at');
  }
  for (const entry of value.external_review.completed) {
    assertExactKeys(entry, [
      'reviewer', 'perspective', 'outcome', 'findings', 'tool_use_id',
      'duration_ms', 'result_sha256', 'recorded_at'
    ], 'runtime state external review result');
    if (entry.reviewer !== 'claude_mcp' || entry.perspective !== 'primary' ||
        !['clean', 'findings'].includes(entry.outcome) ||
        !Number.isInteger(entry.findings) || entry.findings < 0 ||
        (entry.outcome === 'clean' && entry.findings !== 0) ||
        (entry.outcome === 'findings' && entry.findings === 0) ||
        (entry.duration_ms !== null &&
          (!Number.isInteger(entry.duration_ms) || entry.duration_ms < 0))) {
      throw new Error('external review result identity or outcome is invalid');
    }
    nonEmptyString(entry.tool_use_id, 'external review result tool_use_id');
    digest(entry.result_sha256, 'external review result result_sha256');
    timestamp(entry.recorded_at, 'external review result recorded_at');
  }

  if (value.gates.review.status === 'pass') {
    const cleanTypes = new Set(value.review_agents.completed
      .filter((entry) => entry.outcome === 'clean')
      .map((entry) => entry.agent_type));
    if (!nativeTypes.every((type) => cleanTypes.has(type)) ||
        value.review_agents.completed.some((entry) => entry.outcome === 'findings')) {
      throw new Error('passing review gate does not match clean native reviewer results');
    }
    if (value.review_provider === 'claude' &&
        !value.external_review.completed.some((entry) =>
          entry.reviewer === 'claude_mcp' && entry.perspective === 'primary' &&
          entry.outcome === 'clean' && entry.findings === 0
        )) {
      throw new Error('passing Claude review gate has no clean external result');
    }
    if (value.external_review.completed.some((entry) => entry.outcome === 'findings')) {
      throw new Error('passing review gate conflicts with external findings');
    }
  }
}

function normalizeState(value) {
  const base = defaultState();
  if (!value || ![1, 2, 3, 4, 5, SCHEMA_VERSION].includes(value.schema_version)) {
    throw new Error('runtime state schema_version is missing or unsupported');
  }
  if (value.schema_version === SCHEMA_VERSION) assertCurrentStateShape(value);
  const invalidatesLegacyEvidence = value.schema_version <= 5;
  const migratingV4State = value.schema_version === 4;
  const normalizedAt = now();
  const normalizeTimestamp = (candidate) =>
    typeof candidate === 'string' && Number.isFinite(Date.parse(candidate))
      ? candidate
      : normalizedAt;

  const legacySession = typeof value.session_id === 'string' && value.session_id
    ? [{
        session_id: value.session_id,
        started_at: normalizeTimestamp(value.updated_at),
        updated_at: normalizeTimestamp(value.updated_at)
      }]
    : [];
  const sessions = Array.isArray(value.sessions)
    ? value.sessions.filter((entry) =>
        entry && typeof entry.session_id === 'string' && entry.session_id
      ).map((entry) => ({
        session_id: entry.session_id,
        started_at: normalizeTimestamp(entry.started_at || value.updated_at),
        updated_at: normalizeTimestamp(entry.updated_at || value.updated_at)
      })).filter((entry) =>
        Date.parse(entry.updated_at) >= Date.now() - SESSION_RETENTION_MS
      )
    : legacySession;
  const normalized = {
    ...base,
    ...value,
    schema_version: SCHEMA_VERSION,
    runtime_epoch: typeof value.runtime_epoch === 'string' &&
        /^[0-9a-f-]{36}$/i.test(value.runtime_epoch)
      ? value.runtime_epoch
      : base.runtime_epoch,
    review_provider: ['codex', 'claude'].includes(value.review_provider)
      ? value.review_provider
      : base.review_provider,
    sessions,
    worktree: { ...base.worktree, ...(value.worktree || {}) },
    gates: {
      review: invalidatesLegacyEvidence
        ? base.gates.review
        : { ...base.gates.review, ...(value.gates?.review || {}) },
      verify: invalidatesLegacyEvidence
        ? base.gates.verify
        : { ...base.gates.verify, ...(value.gates?.verify || {}) }
    },
    review_agents: invalidatesLegacyEvidence ? base.review_agents : {
      ...base.review_agents,
      ...(value.review_agents || {}),
      started: !migratingV4State && Array.isArray(value.review_agents?.started)
        ? value.review_agents.started
        : [],
      completed: Array.isArray(value.review_agents?.completed)
        ? value.review_agents.completed
        : []
    },
    external_review: invalidatesLegacyEvidence ? base.external_review : {
      ...base.external_review,
      ...(value.external_review || {}),
      started: pruneExternalReviewStarts(value.external_review?.started),
      completed: Array.isArray(value.external_review?.completed)
        ? value.external_review.completed
        : []
    }
  };
  delete normalized.session_id;
  delete normalized.iteration;
  delete normalized.runtime_epoch_started_at;
  return normalized;
}

function readState(cwd = process.cwd()) {
  const filePath = resolveStatePath(cwd);
  try {
    return normalizeState(JSON.parse(fs.readFileSync(filePath, 'utf8')));
  } catch (error) {
    if (error?.code === 'ENOENT') return defaultState();
    throw new Error(`Runtime state is unreadable or corrupt at ${filePath}: ${error.message}`);
  }
}

function writeState(cwd, state) {
  const filePath = resolveStatePath(cwd);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  const normalized = normalizeState({ ...state, updated_at: now() });
  fs.writeFileSync(temporary, `${JSON.stringify(normalized, null, 2)}\n`, {
    mode: 0o600
  });
  fs.renameSync(temporary, filePath);
  return normalized;
}

function sleep(milliseconds) {
  const buffer = new SharedArrayBuffer(4);
  Atomics.wait(new Int32Array(buffer), 0, 0, milliseconds);
}

function processIsAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
}

function lockIsReclaimable(lockPath) {
  const age = Date.now() - fs.statSync(lockPath).mtimeMs;
  let owner = null;
  try {
    owner = Number.parseInt(
      fs.readFileSync(path.join(lockPath, 'owner'), 'utf8').trim(),
      10
    );
  } catch (error) {
    if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') throw error;
  }

  if (Number.isInteger(owner) && owner > 0 && !processIsAlive(owner)) {
    return true;
  }
  if ((!Number.isInteger(owner) || owner <= 0) && age > LOCK_OWNER_GRACE_MS) {
    return true;
  }
  return age > LOCK_STALE_MS;
}

function acquireLock(filePath) {
  const lockPath = `${filePath}.lock`;
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  const deadline = Date.now() + LOCK_WAIT_MS;

  while (Date.now() < deadline) {
    try {
      fs.mkdirSync(lockPath);
      try {
        fs.writeFileSync(path.join(lockPath, 'owner'), String(process.pid));
      } catch (error) {
        fs.rmSync(lockPath, { recursive: true, force: true });
        throw error;
      }
      return lockPath;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      try {
        if (lockIsReclaimable(lockPath)) {
          const abandoned = `${lockPath}.abandoned.${process.pid}.${crypto.randomUUID()}`;
          fs.renameSync(lockPath, abandoned);
          fs.rmSync(abandoned, { recursive: true, force: true });
          continue;
        }
      } catch (lockError) {
        if (lockError.code === 'ENOENT') continue;
        throw lockError;
      }
      sleep(Math.min(LOCK_RETRY_MS, Math.max(1, deadline - Date.now())));
    }
  }

  throw new Error('Timed out waiting for the sd0x runtime state lock');
}

function withStateLock(cwd, callback) {
  const filePath = resolveStatePath(cwd);
  const lockPath = acquireLock(filePath);
  try {
    const current = readState(cwd);
    const next = callback(current) || current;
    return writeState(cwd, next);
  } finally {
    fs.rmSync(lockPath, { recursive: true, force: true });
  }
}

function invalidateGates(state) {
  state.gates.review = defaultGate();
  state.gates.verify = defaultGate();
  state.review_agents = {
    fingerprint: null,
    started: [],
    completed: []
  };
  state.external_review = {
    fingerprint: null,
    started: [],
    completed: []
  };
}

function applyReviewProvider(state, provider) {
  if (state.review_provider !== provider) {
    invalidateGates(state);
    state.review_provider = provider;
  }
  return state;
}

function blockGatesForFinding(state, worktree, source) {
  state.gates.review = {
    status: 'fail',
    fingerprint: worktree.fingerprint,
    evidence: {
      findings: 1,
      source,
      summary: 'reviewer findings remain for the current fingerprint'
    },
    updated_at: now()
  };
  state.gates.verify = defaultGate();
}

function applySnapshot(state, worktree) {
  const previousFingerprint = state.worktree?.fingerprint || 'clean';
  if (previousFingerprint !== worktree.fingerprint) {
    invalidateGates(state);
  }
  state.worktree = worktree;
  return state;
}

function refreshState(cwd = process.cwd(), options = {}) {
  const worktree = snapshot(cwd);
  const provider = reviewProvider(cwd);
  return withStateLock(cwd, (state) => {
    if (options.sessionId) {
      if (state.reset_recovery?.requires_new_session === true) {
        delete state.reset_recovery;
      }
      const recordedAt = now();
      const existing = state.sessions.findIndex((entry) =>
        entry.session_id === options.sessionId
      );
      const session = {
        session_id: options.sessionId,
        started_at: existing >= 0
          ? state.sessions[existing].started_at
          : recordedAt,
        updated_at: recordedAt
      };
      if (existing >= 0) state.sessions[existing] = session;
      else state.sessions.push(session);
    }
    applySnapshot(state, worktree);
    return applyReviewProvider(state, provider);
  });
}

function recoverSessionActivation(cwd, sessionId) {
  if (typeof sessionId !== 'string' || !sessionId) return false;
  const filePath = resolveStatePath(cwd);
  const lockPath = acquireLock(filePath);
  try {
    const generation = runtimeStateGeneration(cwd);
    if (!hasSessionActivationFailure(cwd, sessionId, generation)) return false;
    const state = readState(cwd);
    if (state.reset_recovery?.requires_new_session === true) return false;
    const worktree = snapshot(cwd);
    const provider = reviewProvider(cwd);
    const recordedAt = now();
    const existing = state.sessions.findIndex((entry) =>
      entry.session_id === sessionId
    );
    const session = {
      session_id: sessionId,
      started_at: existing >= 0
        ? state.sessions[existing].started_at
        : recordedAt,
      updated_at: recordedAt
    };
    if (existing >= 0) state.sessions[existing] = session;
    else state.sessions.push(session);
    applySnapshot(state, worktree);
    applyReviewProvider(state, provider);
    writeState(cwd, state);
    return true;
  } finally {
    fs.rmSync(lockPath, { recursive: true, force: true });
  }
}

function requiredReviewers(provider) {
  const primary = provider === 'claude'
    ? 'sd0x_claude_primary_reviewer'
    : 'sd0x_codex_primary_reviewer';
  return [primary, 'sd0x_reviewer', 'sd0x_test_reviewer'];
}

function validateEvidence(gate, status, evidence, provider = DEFAULT_REVIEW_PROVIDER) {
  if (!['pass', 'fail'].includes(status)) {
    throw new Error('Gate status must be pass or fail');
  }
  if (!evidence || typeof evidence !== 'object') {
    throw new Error('Gate evidence must be a JSON object');
  }
  if (gate === 'review' && status === 'pass') {
    if (!Number.isInteger(evidence.reviewers) || evidence.reviewers < 3) {
      throw new Error('A passing review gate requires evidence.reviewers >= 3');
    }
    if (evidence.findings !== 0) {
      throw new Error('A passing review gate requires evidence.findings === 0');
    }
    if (evidence.provider !== provider) {
      throw new Error(`A passing review gate requires provider ${provider}`);
    }
    const required = requiredReviewers(provider);
    if (provider === 'claude') required.push('claude_mcp_primary');
    if (!Array.isArray(evidence.agents) ||
        !required.every((reviewer) => evidence.agents.includes(reviewer))) {
      throw new Error(
        `A passing review gate requires ${provider} primary, implementation, and test reviewer evidence`
      );
    }
  }
  if (gate === 'verify' && status === 'pass') {
    if (!Array.isArray(evidence.commands) || evidence.commands.length === 0) {
      throw new Error('A passing verify gate requires at least one command');
    }
    if (evidence.commands.some((command) => command.exit_code !== 0)) {
      throw new Error('A passing verify gate cannot contain failed commands');
    }
  }
}

function markGate(cwd, gate, status, evidence) {
  if (!['review', 'verify'].includes(gate)) {
    throw new Error(`Unknown gate: ${gate}`);
  }
  if (gate === 'verify' && status === 'pass') {
    throw new Error(
      'Verification pass can only be recorded by the deterministic verify runner'
    );
  }
  const provider = reviewProvider(cwd);
  validateEvidence(gate, status, evidence, provider);
  const worktree = snapshot(cwd);

  return withStateLock(cwd, (state) => {
    applySnapshot(state, worktree);
    applyReviewProvider(state, provider);
    if (gate === 'review' && status === 'pass') {
      if (state.review_agents.started.length > 0 ||
          state.external_review.started.length > 0) {
        throw new Error(
          'Review pass is blocked while current-fingerprint reviewers are still running'
        );
      }
      const currentAgentResults = state.review_agents.fingerprint === worktree.fingerprint
        ? state.review_agents.completed
        : [];
      const currentExternalResults =
        state.external_review.fingerprint === worktree.fingerprint
          ? state.external_review.completed
          : [];
      if (currentAgentResults.some((entry) => entry.outcome === 'findings') ||
          currentExternalResults.some((entry) => entry.outcome === 'findings')) {
        throw new Error(
          'Review pass is blocked by unresolved findings recorded for this fingerprint'
        );
      }
      const cleanTypes = new Set(
        currentAgentResults
          .filter((entry) =>
            typeof entry.result_sha256 === 'string' && entry.outcome === 'clean'
          )
          .map((entry) => entry.agent_type)
      );
      const requiredTypes = requiredReviewers(provider);
      if (!requiredTypes.every((type) => cleanTypes.has(type))) {
        throw new Error(
          `Review pass requires observed clean terminal results from ${requiredTypes.join(', ')}`
        );
      }
      const hasCleanClaudeReview =
        state.external_review.fingerprint === worktree.fingerprint &&
        currentExternalResults.some((entry) =>
          entry.reviewer === 'claude_mcp' &&
          entry.perspective === 'primary' &&
          entry.outcome === 'clean' &&
          entry.findings === 0 &&
          typeof entry.result_sha256 === 'string'
        );
      if (provider === 'claude' && !hasCleanClaudeReview) {
        throw new Error(
          'Review pass requires an observed clean Claude MCP primary result'
        );
      }
    }
    state.gates[gate] = {
      status,
      fingerprint: worktree.fingerprint,
      evidence,
      updated_at: now()
    };
    return state;
  });
}

function recordVerification(
  cwd,
  status,
  evidence,
  expectedFingerprint,
  expectedProvider
) {
  validateEvidence('verify', status, evidence);
  if (evidence.runner !== 'sd0x-deterministic-v1') {
    throw new Error('Verification evidence must come from the deterministic runner');
  }
  if (!['codex', 'claude'].includes(expectedProvider)) {
    throw new Error('Verification evidence requires the starting review provider');
  }
  const worktree = snapshot(cwd);
  let recordedStatus = status;
  let recordedEvidence = evidence;
  if (worktree.fingerprint !== expectedFingerprint) {
    recordedStatus = 'fail';
    recordedEvidence = {
      ...evidence,
      fingerprint_changed: true,
      expected_fingerprint: expectedFingerprint,
      observed_fingerprint: worktree.fingerprint
    };
  }

  return withStateLock(cwd, (state) => {
    const provider = reviewProvider(cwd);
    recordedEvidence = {
      ...recordedEvidence,
      provider_changed: provider !== expectedProvider,
      expected_provider: expectedProvider,
      observed_provider: provider
    };
    if (provider !== expectedProvider) recordedStatus = 'fail';
    applySnapshot(state, worktree);
    applyReviewProvider(state, provider);
    if (recordedStatus === 'pass' && !isCurrentPass(state, 'review')) {
      throw new Error(
        'Verification pass requires a current review pass for the same fingerprint'
      );
    }
    state.gates.verify = {
      status: recordedStatus,
      fingerprint: worktree.fingerprint,
      evidence: recordedEvidence,
      updated_at: now()
    };
    return state;
  });
}

function recordSubagent(cwd, phase, details) {
  if (!['start', 'stop'].includes(phase)) {
    throw new Error(`Unknown subagent phase: ${phase}`);
  }
  const worktree = snapshot(cwd);
  const provider = reviewProvider(cwd);
  return withStateLock(cwd, (state) => {
    applySnapshot(state, worktree);
    applyReviewProvider(state, provider);
    if (!requiredReviewers(provider).includes(details?.agent_type)) return state;
    if (state.review_agents.fingerprint !== worktree.fingerprint) {
      state.review_agents = {
        fingerprint: worktree.fingerprint,
        started: [],
        completed: []
      };
    }

    const entry = {
      agent_id: details.agent_id || 'unknown',
      agent_type: details.agent_type || 'unknown',
      recorded_at: now()
    };
    if (phase === 'stop') {
      const startedIndex = state.review_agents.started.findIndex((item) =>
        item.agent_id === entry.agent_id && item.agent_type === entry.agent_type
      );
      if (startedIndex < 0) return state;
      const started = state.review_agents.started[startedIndex];
      const result = typeof details.last_assistant_message === 'string'
        ? details.last_assistant_message.trim()
        : '';
      if (!result) return state;
      state.review_agents.started.splice(startedIndex, 1);
      entry.started_at = started.recorded_at;
      entry.result_sha256 = crypto.createHash('sha256').update(result).digest('hex');
      entry.outcome = /^no actionable findings(?: remain)?\.?$/i.test(result)
        ? 'clean'
        : 'findings';
      entry.has_transcript = typeof details.agent_transcript_path === 'string' &&
        details.agent_transcript_path.length > 0;
    }
    const collection = phase === 'start'
      ? state.review_agents.started
      : state.review_agents.completed;
    const existing = collection.findIndex((item) =>
      item.agent_id === entry.agent_id &&
      item.agent_type === entry.agent_type &&
      (phase === 'start' || item.result_sha256 === entry.result_sha256)
    );
    if (existing >= 0) collection[existing] = entry;
    else collection.push(entry);
    if (phase === 'stop' && entry.outcome === 'findings') {
      blockGatesForFinding(state, worktree, entry.agent_type);
    }
    return state;
  });
}

function recordExternalReview(cwd, details) {
  if (!details || typeof details !== 'object') {
    throw new Error('External review details are required');
  }
  const result = details.result;
  if (!result || typeof result !== 'object') {
    throw new Error('External review structured result is required');
  }
  if (result.schema_version !== 1 || result.reviewer !== 'claude_mcp' ||
      result.perspective !== 'primary') {
    throw new Error('Unexpected external reviewer identity');
  }
  if (!['clean', 'findings'].includes(result.outcome) ||
      !Array.isArray(result.findings)) {
    throw new Error('Invalid external review outcome');
  }
  if ((result.outcome === 'clean') !== (result.findings.length === 0)) {
    throw new Error('External review outcome does not match its finding count');
  }
  if (!Number.isInteger(result.duration_ms) || result.duration_ms < 0) {
    throw new Error('External review duration is required');
  }
  if (typeof details.input_fingerprint !== 'string' ||
      details.input_fingerprint !== result.fingerprint) {
    throw new Error('External review input/output fingerprint mismatch');
  }
  if (typeof details.session_id !== 'string' || !details.session_id ||
      typeof details.tool_use_id !== 'string' || !details.tool_use_id) {
    throw new Error('External review session and tool-use identity are required');
  }

  const provider = reviewProvider(cwd);
  if (provider !== 'claude') {
    throw new Error('Claude review evidence requires review.provider="claude"');
  }
  const worktree = snapshot(cwd);
  if (!sameRealPath(details.input_root, worktree.root) ||
      !sameRealPath(result.repository_root, worktree.root)) {
    throw new Error('External review repository root mismatch');
  }
  if (worktree.fingerprint !== result.fingerprint) {
    throw new Error('External review result is stale for the current worktree');
  }
  const canonicalResult = JSON.stringify(result);

  let rejection = null;
  const recorded = withStateLock(cwd, (state) => {
    applySnapshot(state, worktree);
    applyReviewProvider(state, provider);
    if (state.external_review.fingerprint !== worktree.fingerprint) {
      state.external_review = {
        fingerprint: worktree.fingerprint,
        started: [],
        completed: []
      };
    }
    state.external_review.started = pruneExternalReviewStarts(
      state.external_review.started
    );
    const startedIndex = state.external_review.started.findIndex((entry) =>
      entry.session_id === details.session_id &&
      entry.runtime_epoch === state.runtime_epoch &&
      entry.tool_use_id === details.tool_use_id
    );
    if (startedIndex < 0) {
      rejection = new Error(
        'External review result has no matching start in the current runtime epoch'
      );
      return state;
    }
    state.external_review.started.splice(startedIndex, 1);
    const entry = {
      reviewer: result.reviewer,
      perspective: result.perspective,
      outcome: result.outcome,
      findings: result.findings.length,
      tool_use_id: details.tool_use_id || 'unknown',
      duration_ms: Number.isInteger(result.duration_ms)
        ? Math.max(0, result.duration_ms)
        : null,
      result_sha256: crypto.createHash('sha256').update(canonicalResult).digest('hex'),
      recorded_at: now()
    };
    const existing = state.external_review.completed.findIndex((item) =>
      item.tool_use_id === entry.tool_use_id &&
      item.result_sha256 === entry.result_sha256
    );
    if (existing >= 0) state.external_review.completed[existing] = entry;
    else state.external_review.completed.push(entry);
    if (entry.outcome === 'findings') {
      blockGatesForFinding(state, worktree, 'claude_mcp_primary');
    }
    return state;
  });
  if (rejection) throw rejection;
  return recorded;
}

function recordExternalReviewStart(cwd, details) {
  if (!details || typeof details !== 'object') {
    throw new Error('External review start details are required');
  }
  const provider = reviewProvider(cwd);
  if (provider !== 'claude') {
    throw new Error('Claude review requires review.provider="claude"');
  }
  const worktree = snapshot(cwd);
  if (!sameRealPath(details.input_root, worktree.root)) {
    throw new Error('External review start repository root mismatch');
  }
  if (details.input_fingerprint !== worktree.fingerprint) {
    throw new Error('External review start fingerprint is stale');
  }
  if (typeof details.session_id !== 'string' || !details.session_id ||
      typeof details.tool_use_id !== 'string' || !details.tool_use_id) {
    throw new Error('External review start requires session and tool-use identity');
  }

  return withStateLock(cwd, (state) => {
    applySnapshot(state, worktree);
    applyReviewProvider(state, provider);
    if (state.external_review.fingerprint !== worktree.fingerprint) {
      state.external_review = {
        fingerprint: worktree.fingerprint,
        started: [],
        completed: []
      };
    }
    state.external_review.started = pruneExternalReviewStarts(
      state.external_review.started
    );
    const entry = {
      session_id: details.session_id,
      tool_use_id: details.tool_use_id,
      runtime_epoch: state.runtime_epoch,
      recorded_at: now()
    };
    const existing = state.external_review.started.findIndex((item) =>
      item.session_id === entry.session_id &&
      item.tool_use_id === entry.tool_use_id
    );
    if (existing >= 0) state.external_review.started[existing] = entry;
    else state.external_review.started.push(entry);
    state.external_review.started = pruneExternalReviewStarts(
      state.external_review.started
    );
    return state;
  });
}

function discardExternalReviewStart(cwd, details) {
  if (!details || typeof details !== 'object' ||
      typeof details.session_id !== 'string' || !details.session_id ||
      typeof details.tool_use_id !== 'string' || !details.tool_use_id) {
    return readState(cwd);
  }
  const worktree = snapshot(cwd);
  return withStateLock(cwd, (state) => {
    applySnapshot(state, worktree);
    if (state.external_review.fingerprint !== worktree.fingerprint) return state;
    state.external_review.started = pruneExternalReviewStarts(
      state.external_review.started
    ).filter((entry) =>
      entry.session_id !== details.session_id ||
      entry.tool_use_id !== details.tool_use_id
    );
    return state;
  });
}

function isCurrentPass(state, gate) {
  const value = state.gates[gate];
  return value.status === 'pass' &&
    value.fingerprint === state.worktree.fingerprint;
}

function isCurrentFail(state, gate) {
  const value = state.gates[gate];
  return value.status === 'fail' &&
    value.fingerprint === state.worktree.fingerprint;
}

function isSessionActive(state, sessionId) {
  return Boolean(sessionId) && state.sessions.some((entry) =>
    entry.session_id === sessionId
  );
}

function hasOutstandingReviewers(state) {
  return (state.review_agents.fingerprint === state.worktree.fingerprint &&
      state.review_agents.started.length > 0) ||
    (state.external_review.fingerprint === state.worktree.fingerprint &&
      state.external_review.started.length > 0);
}

function nextAction(state, options = {}) {
  if (!state.worktree.requires_review) {
    return { action: 'complete', reason: 'worktree-clean' };
  }

  if (isCurrentFail(state, 'review') &&
      (state.gates.review.evidence?.reviewer_failure === true ||
       state.gates.review.evidence?.findings === 0)) {
    return { action: 'review', reason: 'reviewer-unavailable' };
  }

  if (hasOutstandingReviewers(state)) {
    return { action: 'review', reason: 'review-in-progress' };
  }

  if (isCurrentPass(state, 'review') &&
      (!state.worktree.requires_verify || isCurrentPass(state, 'verify'))) {
    return { action: 'complete', reason: 'all-required-gates-pass' };
  }

  if (isCurrentFail(state, 'review')) {
    return { action: 'review', reason: 'review-findings-remain' };
  }
  if (!isCurrentPass(state, 'review')) {
    return { action: 'review', reason: 'review-required' };
  }

  if (state.worktree.requires_verify) {
    if (isCurrentFail(state, 'verify')) {
      return { action: 'verify', reason: 'verification-failed' };
    }
    if (!isCurrentPass(state, 'verify')) {
      return { action: 'verify', reason: 'verification-required' };
    }
  }

  return { action: 'complete', reason: 'all-required-gates-pass' };
}

function resetState(cwd = process.cwd()) {
  const worktree = snapshot(cwd);
  const provider = reviewProvider(cwd);
  const filePath = resolveStatePath(cwd);
  const lockPath = acquireLock(filePath);
  try {
    let state;
    let quarantinePath = null;
    try {
      state = readState(cwd);
    } catch (error) {
      if (!/^Runtime state is unreadable or corrupt at /.test(error.message)) throw error;
      if (fs.existsSync(filePath)) {
        quarantinePath = `${filePath}.corrupt.${Date.now()}.${crypto.randomUUID()}`;
        fs.renameSync(filePath, quarantinePath);
      }
      clearAllSessionActivationFailures(cwd);
      state = defaultState();
    }
    const reset = defaultState();
    reset.sessions = state.sessions;
    reset.worktree = worktree;
    reset.review_provider = provider;
    if (quarantinePath) {
      reset.reset_recovery = {
        corrupt_state_quarantined_at: quarantinePath,
        requires_new_session: true
      };
    }
    return writeState(cwd, reset);
  } finally {
    fs.rmSync(lockPath, { recursive: true, force: true });
  }
}

function summarize(state, options = {}) {
  const action = nextAction(state, options);
  return {
    fingerprint: state.worktree.fingerprint,
    files: state.worktree.files,
    requires_review: state.worktree.requires_review,
    requires_verify: state.worktree.requires_verify,
    review_provider: state.review_provider,
    review: state.gates.review.status,
    verify: state.gates.verify.status,
    review_agents_completed: state.review_agents.completed.length,
    external_reviews_completed: state.external_review.completed.length,
    active_sessions: state.sessions.length,
    reset_recovery: state.reset_recovery || null,
    next_action: action.action,
    reason: action.reason
  };
}

module.exports = {
  EVIDENCE_REF,
  activationFailurePath,
  auditEvidenceLedger,
  appendEvidenceRevision,
  applySnapshot,
  claimSetupDeferral,
  clearSetupDeferral,
  clearSessionActivationFailure,
  consumeSetupDeferral,
  defaultState,
  discardExternalReviewStart,
  hasSetupDeferral,
  hasSessionActivationFailure,
  isCurrentPass,
  isSessionActive,
  markSetupDeferral,
  markSessionActivationFailure,
  markGate,
  nextAction,
  canonicalEvidenceBlob,
  canonicalJson,
  finalizeRequestClosure,
  readState,
  readEvidenceRecord,
  prepareRequestClosure,
  recordExternalReview,
  recordExternalReviewStart,
  recordPromotionEvidence,
  recordSubagent,
  recordVerification,
  recoverSessionActivation,
  refreshState,
  resetState,
  resolveRuntimeMetadataPath,
  resolveStatePath,
  runtimeStateGeneration,
  setupDeferralPath,
  summarize,
  withStateLock,
  writeState
};
