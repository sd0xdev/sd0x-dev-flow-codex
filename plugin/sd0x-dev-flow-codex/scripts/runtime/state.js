'use strict';

const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const {
  DEFAULT_REVIEW_PROVIDER,
  reviewProvider
} = require('./config');
const {
  cleanGitEnvironment,
  findRepoRoot,
  snapshot,
  snapshotProjection
} = require('./worktree');

const SCHEMA_VERSION = 8;
const LOCK_WAIT_MS = 5_000;
const LOCK_RETRY_MS = 20;
const LOCK_OWNER_GRACE_MS = 1_000;
const LOCK_STALE_MS = 30_000;
const SESSION_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const EXTERNAL_REVIEW_START_RETENTION_MS = 35 * 60 * 1000;
const MAX_EXTERNAL_REVIEW_STARTS = 64;
const EVIDENCE_REF = 'refs/sd0x-dev-flow-codex/evidence/v1';
const EVIDENCE_SCHEMA_VERSION = 2;
const LEGACY_EVIDENCE_SCHEMA_VERSION = 1;
const COMMIT_CLOSURE_REVIEW_SCHEMA_VERSION = 2;
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

function assertSha256(value, label) {
  if (!/^[a-f0-9]{64}$/.test(value || '')) {
    throw new Error(`${label} must be one lowercase SHA-256`);
  }
}

function assertFingerprint(value, label) {
  if (value !== 'clean') assertSha256(value, label);
}

function assertRecordedAt(value, label = 'recorded_at') {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) ||
      !Number.isFinite(Date.parse(value))) {
    throw new Error(`${label} must be one canonical UTC timestamp`);
  }
}

function assertPromotionUnit(value) {
  if (typeof value !== 'string' ||
      !/^(?:[a-z0-9][a-z0-9-]*\/(?:default|[a-z0-9][a-z0-9-]*)|retire\/[a-z0-9][a-z0-9-]*)$/.test(value)) {
    throw new Error('promotion_unit_id is invalid');
  }
}

function redactEvidenceValue(value, root, key = '') {
  if (Array.isArray(value)) {
    return value.map((item) => redactEvidenceValue(item, root, key));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [
      key,
      redactEvidenceValue(item, root, key)
    ]));
  }
  if (typeof value !== 'string') return value;
  if (/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(value)) {
    throw new Error('Evidence contains private-key material that cannot be safely redacted');
  }
  let output = value;
  if (/pass(?:word|phrase)|secret|token|credential|api[_-]?key|auth(?:orization)?/i.test(key) &&
      output && !/^<(?:secret|account|repo|home|absolute-path)>$/.test(output)) {
    return '<secret>';
  }
  if (/(?:account|email|user(?:name)?|owner)/i.test(key) &&
      /@|^[A-Za-z0-9._-]+$/.test(output)) {
    return '<account>';
  }
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
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '<account>')
    .replace(/(?:^|[\s"'=])\/(?!\/)(?:[^\s"']+\/?)+/g,
      (match) => `${match[0] === '/' ? '' : match[0]}<absolute-path>`)
    .replace(/\b[A-Za-z]:\\(?:[^\s"']+\\?)+/g, '<absolute-path>');
  return output;
}

function canonicalEvidenceBlob(cwd, value) {
  const root = findRepoRoot(cwd);
  return canonicalJson({
    redactor_version: REDACTOR_VERSION,
    value: redactEvidenceValue(value, root)
  });
}

function assertSafeExactBytes(root, bytes, label) {
  if (!Buffer.isBuffer(bytes) || bytes.includes(0)) {
    throw new Error(`${label} must be non-binary UTF-8 bytes`);
  }
  const text = bytes.toString('utf8');
  if (!Buffer.from(text, 'utf8').equals(bytes)) {
    throw new Error(`${label} must be valid UTF-8`);
  }
  const redacted = JSON.parse(canonicalEvidenceBlob(root, text)).value;
  if (redacted !== text) {
    throw new Error(`${label} contains content that requires redaction`);
  }
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
  try {
    return String(runEvidenceGit(root, [
      'rev-parse', '--verify', '--quiet', EVIDENCE_REF
    ])).trim() || null;
  } catch {
    return null;
  }
}

function evidenceRecordHash(record) {
  const withoutHash = { ...record };
  delete withoutHash.record_sha256;
  return sha256(canonicalJson(withoutHash));
}

function appendEvidenceRevisionUnlocked(cwd, record, blobs = {}, options = {}) {
  const root = findRepoRoot(cwd);
  validateEvidenceRecordShape(record);
  if (record.schema_version !== EVIDENCE_SCHEMA_VERSION) {
    throw new Error(
      `New evidence records require schema_version=${EVIDENCE_SCHEMA_VERSION}`
    );
  }
  const requiredBlobNames = requiredEvidenceBlobs(record).map(([name]) => name).sort();
  if (JSON.stringify(Object.keys(blobs).sort()) !== JSON.stringify(requiredBlobNames)) {
    throw new Error(`${record.kind} evidence blobs must exactly equal: ${requiredBlobNames.join(', ')}`);
  }
  validateEvidenceBlobSemantics(record, Object.fromEntries(
    Object.entries(blobs).map(([name, supplied]) => [
      name,
      supplied && typeof supplied === 'object' &&
        Object.keys(supplied).sort().join(',') === 'field,value'
        ? supplied.value
        : supplied
    ])
  ), root);
  const recordSha = evidenceRecordHash(record);
  if (record.record_sha256 !== recordSha) {
    throw new Error('Evidence record_sha256 does not match canonical record bytes');
  }
  const oldOid = evidenceRefOid(root);
  if ((options.expected_old_oid || null) !== oldOid) {
    throw new Error('Evidence ref compare-and-swap expectation is stale');
  }
  if (oldOid) auditEvidenceLedger(root);
  const priorRecords = oldOid ? evidenceRecordsAt(root, oldOid) : [];
  const latestPrior = (kind) => priorRecords.filter((entry) =>
    entry.kind === kind && entry.promotion_unit_id === record.promotion_unit_id
  ).sort((left, right) => Date.parse(left.recorded_at) - Date.parse(right.recorded_at))
    .at(-1) || null;
  if (record.kind === 'request-closure' &&
      latestPrior('request-closure-pending')?.record_sha256 !==
        record.pending_record_sha256) {
    throw new Error('Request closure must consume the latest pending revision');
  }
  if (['promotion', 'pack-ready', 'retirement'].includes(record.kind)) {
    const currentClosure = latestPrior('request-closure');
    const currentPending = latestPrior('request-closure-pending');
    if (currentClosure?.record_sha256 !== record.request_closure_record_sha256 ||
        currentClosure?.pending_record_sha256 !== currentPending?.record_sha256) {
      throw new Error('Completion evidence must consume the latest closure and pending revision');
    }
  }
  const priorRevisions = priorRecords.filter((entry) =>
    entry.kind === record.kind && entry.promotion_unit_id === record.promotion_unit_id
  ).sort((left, right) => Date.parse(left.recorded_at) - Date.parse(right.recorded_at));
  const latest = priorRevisions.at(-1) || null;
  if ((record.supersedes_record_sha256 || null) !== (latest?.record_sha256 || null)) {
    throw new Error('Evidence revision must supersede the latest matching kind/unit record');
  }
  if (latest && Date.parse(record.recorded_at) <= Date.parse(latest.recorded_at)) {
    throw new Error('Evidence revision recorded_at must advance monotonically');
  }
  if (['promotion', 'pack-ready', 'retirement'].includes(record.kind)) {
    const priorCompletion = priorRecords.filter((entry) =>
      entry.promotion_unit_id === record.promotion_unit_id &&
      ['promotion', 'pack-ready', 'retirement'].includes(entry.kind)
    ).sort((left, right) => Date.parse(left.recorded_at) - Date.parse(right.recorded_at))
      .at(-1);
    if (priorCompletion && Date.parse(record.recorded_at) <=
        Date.parse(priorCompletion.recorded_at)) {
      throw new Error('Completion evidence recorded_at must advance across record kinds');
    }
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
  validateEvidenceRecordShape(record);
  if (canonicalJson(record) !== bytes || evidenceRecordHash(record) !== recordSha ||
      record.record_sha256 !== recordSha) {
    throw new Error(`Evidence record is corrupt: ${recordSha}`);
  }
  const blobValues = {};
  for (const [name, field] of requiredEvidenceBlobs(record)) {
    blobValues[name] = validateEvidenceBlobAt(root, oid, record, name, field, paths);
  }
  validateEvidenceBlobSemantics(record, blobValues, root);
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
  if (path.posix.normalize(relative) !== relative ||
      relative.split('/').some((segment) => segment === '.' || segment === '..')) {
    throw new Error('Closure request_path must be canonical without dot segments');
  }
  const rootReal = fs.realpathSync(root);
  let absolute = root;
  for (const segment of relative.split('/')) {
    absolute = path.join(absolute, segment);
    let stat;
    try {
      stat = fs.lstatSync(absolute);
    } catch (error) {
      throw new Error(`Closure request path is missing: ${relative}`);
    }
    if (stat.isSymbolicLink()) {
      throw new Error(`Closure request path cannot traverse a symlink: ${relative}`);
    }
  }
  if (!fs.statSync(absolute).isFile()) {
    throw new Error(`Closure request path is not a regular file: ${relative}`);
  }
  const absoluteReal = fs.realpathSync(absolute);
  const containment = path.relative(rootReal, absoluteReal);
  if (containment === '..' || containment.startsWith(`..${path.sep}`) ||
      path.isAbsolute(containment)) {
    throw new Error('Closure request path escapes the repository');
  }
  return { relative, absolute: absoluteReal };
}

function statIdentity(stat) {
  return {
    dev: stat.dev.toString(),
    ino: stat.ino.toString(),
    mode: stat.mode.toString(),
    size: stat.size.toString(),
    mtime_ns: stat.mtimeNs.toString(),
    ctime_ns: stat.ctimeNs.toString()
  };
}

function sameStatIdentity(left, right) {
  return canonicalJson(statIdentity(left)) === canonicalJson(statIdentity(right));
}

function sameNodeIdentity(left, right) {
  return left.dev === right.dev && left.ino === right.ino && left.mode === right.mode;
}

function capturePathIdentities(root, relative, leafType = 'file') {
  const identities = [];
  let current = root;
  for (const [index, segment] of relative.split('/').entries()) {
    current = path.join(current, segment);
    const stat = fs.lstatSync(current, { bigint: true, throwIfNoEntry: false });
    if (!stat || stat.isSymbolicLink()) {
      throw new Error(`Contained path is missing or symlinked: ${relative}`);
    }
    const isLeaf = index === relative.split('/').length - 1;
    if ((!isLeaf && !stat.isDirectory()) ||
        (isLeaf && leafType === 'file' && !stat.isFile()) ||
        (isLeaf && leafType === 'directory' && !stat.isDirectory())) {
      throw new Error(`Contained path has an unexpected type: ${relative}`);
    }
    identities.push({ absolute: current, stat });
  }
  return identities;
}

function containedDirectoryIdentities(root, relative, options = {}) {
  if (typeof relative !== 'string' || !relative ||
      path.posix.normalize(relative) !== relative ||
      relative.split('/').some((segment) => !segment || segment === '.' ||
        segment === '..')) {
    throw new Error('Contained directory path must be canonical');
  }
  const rootReal = fs.realpathSync(root);
  const identities = [];
  let current = rootReal;
  for (const segment of relative.split('/')) {
    current = path.join(current, segment);
    let stat = fs.lstatSync(current, { bigint: true, throwIfNoEntry: false });
    if (!stat && options.create === true) {
      try {
        fs.mkdirSync(current, { mode: 0o700 });
        fsyncDirectory(path.dirname(current));
      } catch (error) {
        if (error.code !== 'EEXIST') throw error;
      }
      stat = fs.lstatSync(current, { bigint: true, throwIfNoEntry: false });
    }
    if (!stat) return null;
    if (stat.isSymbolicLink() || !stat.isDirectory()) {
      throw new Error(`Contained directory is missing, symlinked, or not a directory: ${relative}`);
    }
    const resolved = fs.realpathSync(current);
    const containment = path.relative(rootReal, resolved);
    if (containment === '..' || containment.startsWith(`..${path.sep}`) ||
        path.isAbsolute(containment)) {
      throw new Error(`Contained directory escapes the repository: ${relative}`);
    }
    identities.push({ absolute: current, stat });
  }
  return identities;
}

function assertPathIdentities(identities, label, allowLeafContentChange = false) {
  for (const [index, identity] of identities.entries()) {
    const current = fs.lstatSync(identity.absolute, {
      bigint: true,
      throwIfNoEntry: false
    });
    if (!current || current.isSymbolicLink() ||
        (allowLeafContentChange && index === identities.length - 1
          ? !sameNodeIdentity(current, identity.stat)
          : !sameStatIdentity(current, identity.stat))) {
      throw new Error(`${label} path identity changed while it was read`);
    }
  }
}

function assertPathNodeIdentities(identities, label) {
  for (const identity of identities) {
    const current = fs.lstatSync(identity.absolute, {
      bigint: true,
      throwIfNoEntry: false
    });
    if (!current || current.isSymbolicLink() ||
        !sameNodeIdentity(current, identity.stat)) {
      throw new Error(`${label} path node changed`);
    }
  }
}

function readBoundRegularFile(root, relative, hooks = {}) {
  const request = requestPathInRoot(root, relative);
  const identities = capturePathIdentities(root, request.relative, 'file');
  const leaf = identities.at(-1);
  let descriptor;
  try {
    descriptor = fs.openSync(request.absolute,
      fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
    const before = fs.fstatSync(descriptor, { bigint: true });
    if (!sameStatIdentity(before, leaf.stat)) {
      throw new Error('Contained file descriptor identity does not match its path');
    }
    if (typeof hooks.beforeRead === 'function') hooks.beforeRead({
      descriptor,
      request: request.absolute
    });
    const bytes = readAllSync(descriptor);
    const after = fs.fstatSync(descriptor, { bigint: true });
    if (!sameStatIdentity(before, after)) {
      throw new Error('Contained file changed while it was read');
    }
    assertPathIdentities(identities, 'Contained file');
    return { ...request, bytes, identity: statIdentity(before) };
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
  }
}

function implementationBaseSha(markdown) {
  const normalized = String(markdown).replace(/\r\n/g, '\n');
  const label = /^> \*\*Implementation Base SHA\*\*:\s*(.+)$/m.exec(normalized);
  if (!label) return null;
  const match = /^`([a-f0-9]{40})`$/.exec(label[1].trim());
  if (!match) throw new Error('Implementation Base SHA must be one canonical commit OID');
  return match[1];
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

function currentHead(root) {
  return String(runEvidenceGit(root, ['rev-parse', 'HEAD'])).trim();
}

function currentHeadTree(root) {
  return String(runEvidenceGit(root, ['rev-parse', 'HEAD^{tree}'])).trim();
}

function commitClosureReviewPath(cwd) {
  return resolveRuntimeMetadataPath(findRepoRoot(cwd), 'commit-closure-review.json');
}

function retireLegacyCommitClosureReview(cwd) {
  const filePath = commitClosureReviewPath(cwd);
  const stat = fs.lstatSync(filePath, { throwIfNoEntry: false });
  if (!stat || !stat.isFile() || stat.isSymbolicLink()) return false;
  let value;
  try {
    value = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return false;
  }
  if (!value || value.schema_version !== 1) return false;
  const retired = `${filePath}.legacy-three-view.${Date.now()}.${crypto.randomUUID()}`;
  fs.renameSync(filePath, retired);
  fsyncDirectory(path.dirname(filePath));
  return true;
}

function writeCommitClosureReview(cwd, value) {
  const filePath = commitClosureReviewPath(cwd);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${process.pid}.${crypto.randomUUID()}.tmp`;
  fs.writeFileSync(temporary, canonicalJson(value), { mode: 0o600 });
  fs.renameSync(temporary, filePath);
}

function readCommitClosureReview(cwd) {
  const filePath = commitClosureReviewPath(cwd);
  let value;
  try {
    value = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`Commit closure review attestation is unavailable: ${error.message}`);
  }
  if (value?.schema_version === 1) {
    if (retireLegacyCommitClosureReview(cwd)) return null;
    throw new Error('Commit closure review legacy marker could not be retired');
  }
  assertExactKeys(value, [
    'schema_version', 'status', 'runtime_epoch', 'provider', 'subject',
    'subject_sha256', 'generation', 'started_at', 'reviewer_bindings', 'review_evidence',
    'verify_evidence', 'attested_at'
  ], 'commit closure review attestation');
  if (value.schema_version !== COMMIT_CLOSURE_REVIEW_SCHEMA_VERSION ||
      !['pending', 'complete'].includes(value.status) ||
      !['codex', 'claude'].includes(value.provider)) {
    throw new Error('Commit closure review attestation is invalid');
  }
  assertRecordedAt(value.started_at, 'commit closure review started_at');
  assertSha256(value.subject_sha256, 'commit closure review subject_sha256');
  if (typeof value.generation !== 'string' ||
      !/^[0-9a-f-]{36}$/i.test(value.generation)) {
    throw new Error('Commit closure review generation is invalid');
  }
  if (value.subject_sha256 !== sha256(canonicalJson(value.subject)) ||
      !Array.isArray(value.reviewer_bindings)) {
    throw new Error('Commit closure review subject binding is invalid');
  }
  for (const binding of value.reviewer_bindings) {
    assertExactKeys(binding, [
      'agent_id', 'agent_type', 'subject_sha256', 'started_at'
    ], 'commit closure reviewer binding');
    if (typeof binding.agent_id !== 'string' || !binding.agent_id ||
        !requiredReviewers(value.provider).includes(binding.agent_type) ||
        binding.subject_sha256 !== value.subject_sha256) {
      throw new Error('Commit closure reviewer binding is invalid');
    }
    assertRecordedAt(binding.started_at, 'commit closure reviewer binding started_at');
  }
  if (value.status === 'pending') {
    if (value.review_evidence !== null || value.verify_evidence !== null ||
        value.attested_at !== null) {
      throw new Error('Pending commit closure review contains completion evidence');
    }
  } else {
    assertRecordedAt(value.attested_at, 'commit closure review attested_at');
    validateReviewEvidence(gateEvidenceEnvelope(
      value.subject, value.provider, value.review_evidence
    ), 'Commit closure review evidence');
    passingExitEvidence(gateEvidenceEnvelope(
      value.subject, value.provider, value.verify_evidence
    ), 'Commit closure verify evidence');
  }
  return value;
}

function commitClosureReviewerContext(cwd) {
  const markerPath = commitClosureReviewPath(cwd);
  if (!fs.existsSync(markerPath)) return null;
  const marker = readCommitClosureReview(cwd);
  if (!marker || marker.status !== 'pending') return null;
  validateClosureSubject(findRepoRoot(cwd), marker.subject, 'prepare');
  return [
    `Commit closure subject SHA-256: ${marker.subject_sha256}.`,
    `Review exactly ${marker.subject.base_sha}..${marker.subject.head_sha}`,
    `at tree ${marker.subject.tree_sha}; do not substitute the clean worktree or another range.`,
    `End the terminal response with exactly: Commit-Subject-SHA256: ${marker.subject_sha256}`
  ].join(' ');
}

function commitClosureReviewIdentity(cwd) {
  const root = findRepoRoot(cwd);
  const markerPath = commitClosureReviewPath(root);
  if (!fs.existsSync(markerPath)) return null;
  const marker = readCommitClosureReview(root);
  if (!marker || marker.status !== 'pending') return null;
  const state = readState(root);
  const provider = reviewProvider(root);
  validateClosureSubject(root, marker.subject, 'prepare');
  if (marker.runtime_epoch !== state.runtime_epoch ||
      marker.provider !== provider || state.review_provider !== provider) {
    throw new Error('Commit closure review marker is stale for the current runtime');
  }
  return {
    subject_sha256: marker.subject_sha256,
    generation: marker.generation,
    subject: canonicalValue(marker.subject),
    runtime_epoch: marker.runtime_epoch,
    provider: marker.provider
  };
}

function beginCommitClosureReview(cwd, subject) {
  const root = findRepoRoot(cwd);
  validateClosureSubject(root, subject, 'prepare');
  if (subject.kind !== 'commit') {
    throw new Error('Commit closure review begin requires a commit subject');
  }
  let marker;
  withStateLock(root, (state) => {
    const worktree = snapshot(root);
    const provider = reviewProvider(root);
    if (provider !== 'codex') {
      throw new Error(
        'Commit closure review currently requires the codex review provider'
      );
    }
    applySnapshot(state, worktree);
    applyReviewProvider(state, provider);
    const markerPath = commitClosureReviewPath(root);
    if (fs.existsSync(markerPath)) {
      let existing;
      try {
        existing = readCommitClosureReview(root);
      } catch (error) {
        if (!retireLegacyCommitClosureReview(root)) throw error;
        existing = null;
      }
      if (existing?.status === 'pending' &&
          existing.runtime_epoch === state.runtime_epoch &&
          existing.provider === provider &&
          canonicalJson(existing.subject) === canonicalJson(subject)) {
        marker = existing;
        return state;
      }
    }
    invalidateGates(state);
    state.worktree = worktree;
    marker = {
      schema_version: COMMIT_CLOSURE_REVIEW_SCHEMA_VERSION,
      status: 'pending',
      runtime_epoch: state.runtime_epoch,
      provider,
      subject: canonicalValue(subject),
      subject_sha256: sha256(canonicalJson(subject)),
      generation: crypto.randomUUID(),
      started_at: now(),
      reviewer_bindings: [],
      review_evidence: null,
      verify_evidence: null,
      attested_at: null
    };
    writeCommitClosureReview(root, marker);
    return state;
  });
  return marker;
}

function attestCommitClosureReview(cwd, subject, hooks = {}) {
  const root = findRepoRoot(cwd);
  validateClosureSubject(root, subject, 'prepare');
  let attestation;
  withStateLock(root, (state) => {
    const worktree = snapshot(root);
    const provider = reviewProvider(root);
    applySnapshot(state, worktree);
    applyReviewProvider(state, provider);
    const marker = readCommitClosureReview(root);
    if (!marker || marker.status !== 'pending' ||
        marker.runtime_epoch !== state.runtime_epoch ||
        marker.provider !== state.review_provider ||
        canonicalJson(marker.subject) !== canonicalJson(subject)) {
      throw new Error('Commit closure review marker is stale or mismatched');
    }
    if (!isCurrentPass(state, 'review') || !isCurrentPass(state, 'verify')) {
      throw new Error('Commit closure attestation requires current review and verify passes');
    }
    const startedAt = Date.parse(marker.started_at);
    const currentResults = state.review_agents.completed.filter((entry) =>
      Date.parse(entry.recorded_at) >= startedAt
    );
    if (!requiredReviewers(state.review_provider).every((type) =>
      currentResults.some((entry) => {
        const binding = marker.reviewer_bindings.find((candidate) =>
          candidate.agent_type === type &&
          candidate.subject_sha256 === marker.subject_sha256 &&
          Date.parse(candidate.started_at) <= Date.parse(entry.started_at)
        );
        return Boolean(binding) && entry.agent_type === type &&
          entry.outcome === 'clean' && entry.has_transcript === true;
      })
    )) {
      throw new Error('Commit closure attestation lacks subject-bound terminal reviewer results');
    }
    if (typeof hooks.beforeWrite === 'function') hooks.beforeWrite(marker);
    const currentMarker = readCommitClosureReview(root);
    if (!currentMarker || currentMarker.status !== 'pending' ||
        currentMarker.generation !== marker.generation ||
        canonicalJson(currentMarker) !== canonicalJson(marker)) {
      throw new Error('Commit closure review generation changed before attestation');
    }
    marker.status = 'complete';
    marker.review_evidence = reviewEvidenceFromState(state, marker.reviewer_bindings);
    marker.verify_evidence = canonicalValue(state.gates.verify.evidence);
    marker.attested_at = now();
    writeCommitClosureReview(root, marker);
    attestation = marker;
    return state;
  });
  return attestation;
}

function assertCurrentCommitAttestation(root, state, captured, subject) {
  const worktree = snapshot(root);
  const provider = reviewProvider(root);
  applySnapshot(state, worktree);
  applyReviewProvider(state, provider);
  const current = readCommitClosureReview(root);
  if (!current || current.status !== 'complete' ||
      current.generation !== captured.generation ||
      current.runtime_epoch !== state.runtime_epoch ||
      current.provider !== state.review_provider ||
      canonicalJson(current.subject) !== canonicalJson(subject) ||
      canonicalJson(current) !== canonicalJson(captured) ||
      !isCurrentPass(state, 'review') || !isCurrentPass(state, 'verify')) {
    throw new Error('Commit closure prepare requires the current completed attestation');
  }
  return current;
}

function validateClosureSubjectShape(subject) {
  if (!subject || typeof subject !== 'object' || Array.isArray(subject)) {
    throw new Error('Closure subject must be one dirty or commit snapshot');
  }
  if (subject.kind === 'dirty') {
    assertExactKeys(subject, ['kind', 'fingerprint', 'head_sha'], 'dirty closure subject');
    assertSha256(subject.fingerprint, 'dirty subject fingerprint');
    if (!/^[a-f0-9]{40}$/.test(subject.head_sha || '')) {
      throw new Error('Dirty closure subject HEAD is invalid');
    }
    return;
  }
  if (subject.kind === 'commit') {
    assertExactKeys(subject, [
      'kind', 'base_sha', 'head_sha', 'tree_sha'
    ], 'commit closure subject');
    for (const [field, value] of [
      ['base_sha', subject.base_sha], ['head_sha', subject.head_sha],
      ['tree_sha', subject.tree_sha]
    ]) {
      if (!/^[a-f0-9]{40}$/.test(value || '')) {
        throw new Error(`Commit closure subject ${field} is invalid`);
      }
    }
    return;
  }
  throw new Error(`Unsupported closure subject kind: ${subject.kind || 'missing'}`);
}

function validateClosureSubject(root, subject, phase = 'prepare') {
  validateClosureSubjectShape(subject);
  if (subject.kind === 'dirty') {
    if (subject.head_sha !== currentHead(root)) {
      throw new Error('Dirty closure subject HEAD is stale');
    }
    if (phase === 'prepare' && snapshot(root).fingerprint !== subject.fingerprint) {
      throw new Error('Dirty closure subject fingerprint is stale');
    }
    return;
  }
  if (subject.kind === 'commit') {
    if ((phase === 'prepare' && snapshot(root).fingerprint !== 'clean') ||
        subject.head_sha !== currentHead(root) ||
        subject.tree_sha !== currentHeadTree(root)) {
      throw new Error('Commit closure subject is stale or the tracked worktree is dirty');
    }
    try {
      runEvidenceGit(root, ['merge-base', '--is-ancestor', subject.base_sha, subject.head_sha]);
    } catch {
      throw new Error('Commit closure base_sha must be an ancestor of head_sha');
    }
    return;
  }
}

function passingExitEvidence(value, label, allowNotRequired = false) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} evidence must be an object`);
  }
  const payload = value.evidence && typeof value.evidence === 'object'
    ? value.evidence
    : value;
  if (Object.hasOwn(payload, 'not_required')) {
    if (allowNotRequired && Object.keys(payload).length === 1 &&
        payload.not_required === true) return;
    throw new Error(`${label} evidence has an invalid not-required shape`);
  }
  if (Object.hasOwn(payload, 'commands') && !Array.isArray(payload.commands)) {
    throw new Error(`${label} evidence commands must be an array`);
  }
  const commands = payload.commands || [];
  const hasTopLevelExit = Object.hasOwn(payload, 'exit_code');
  if (hasTopLevelExit && (!Number.isInteger(payload.exit_code) || payload.exit_code !== 0)) {
    throw new Error(`${label} evidence contains a failed or malformed exit status`);
  }
  if (commands.some((item) => !item || !Number.isInteger(item.exit_code) ||
      item.exit_code !== 0 ||
      !(typeof item.command === 'string' && item.command.trim()) &&
        !(Array.isArray(item.argv) && item.argv.length > 0 &&
          item.argv.every((part) => typeof part === 'string' && part)))) {
    throw new Error(`${label} evidence contains a failed, malformed, or unnamed command`);
  }
  if (commands.length === 0 && !(hasTopLevelExit &&
      typeof payload.runner === 'string' && payload.runner.trim() &&
      Array.isArray(payload.argv) && payload.argv.length > 0 &&
      payload.argv.every((part) => typeof part === 'string' && part))) {
    throw new Error(`${label} evidence must name at least one successful invocation`);
  }
}

function canonicalEvidenceLocation(reference) {
  const match = /^([^:\n]+):([1-9]\d*)(?::([1-9]\d*))?$/.exec(reference || '');
  if (!match) throw new Error('Closure AC evidence requires canonical path:line locations');
  const relative = match[1];
  if (relative.includes('\\') || path.posix.isAbsolute(relative) ||
      path.posix.normalize(relative) !== relative ||
      relative === '.' || relative.startsWith('../') || relative.includes('/../')) {
    throw new Error('Closure AC evidence path must be canonical and repository-relative');
  }
  return {
    relative,
    line: Number(match[2]),
    column: match[3] ? Number(match[3]) : null
  };
}

function evidenceLocationBytes(root, subject, relative) {
  if (subject.kind === 'commit') {
    const treeEntry = String(runEvidenceGit(root, [
      'ls-tree', '-z', subject.head_sha, '--', relative
    ]));
    const match = /^(100644|100755) blob ([a-f0-9]{40})\t([^\0]+)\0$/.exec(treeEntry);
    if (!match || match[3] !== relative) {
      throw new Error(`Closure AC evidence is not a regular file in the commit subject: ${relative}`);
    }
    return {
      bytes: runEvidenceGit(root, ['cat-file', 'blob', match[2]], { encoding: null }),
      commit_blob_oid: match[2]
    };
  }
  const segments = relative.split('/');
  let current = root;
  for (const segment of segments) {
    current = path.join(current, segment);
    let stat;
    try {
      stat = fs.lstatSync(current);
    } catch {
      throw new Error(`Closure AC evidence file is missing: ${relative}`);
    }
    if (stat.isSymbolicLink()) {
      throw new Error(`Closure AC evidence path cannot traverse a symlink: ${relative}`);
    }
  }
  if (!fs.statSync(current).isFile()) {
    throw new Error(`Closure AC evidence is not a regular file: ${relative}`);
  }
  return { bytes: fs.readFileSync(current), commit_blob_oid: null };
}

function validateAcEvidenceLocations(root, subject, verdicts) {
  for (const verdict of verdicts) {
    for (const reference of verdict.evidence) {
      const location = canonicalEvidenceLocation(reference);
      const { bytes } = evidenceLocationBytes(root, subject, location.relative);
      if (bytes.includes(0)) {
        throw new Error(`Closure AC evidence file is binary: ${location.relative}`);
      }
      const normalized = bytes.toString('utf8').replace(/\r\n/g, '\n');
      const lines = normalized === '' ? [] : normalized.split('\n');
      if (lines.at(-1) === '') lines.pop();
      if (location.line > lines.length) {
        throw new Error(`Closure AC evidence line is out of range: ${reference}`);
      }
      if (location.column !== null &&
          location.column > lines[location.line - 1].length + 1) {
        throw new Error(`Closure AC evidence column is out of range: ${reference}`);
      }
    }
  }
}

function durableAcEvidence(root, subject, ac, requestPath = null) {
  validateAcEvidenceLocations(root, subject, ac.verdicts);
  return {
    verdicts: ac.verdicts.map((verdict) => {
      const locations = verdict.evidence.map(canonicalEvidenceLocation);
      if (requestPath && !locations.some((location) =>
        location.relative !== requestPath
      )) {
        throw new Error(
          'Closure AC evidence requires at least one location outside its own request'
        );
      }
      return {
        ac: verdict.ac,
        status: verdict.status,
        confidence: verdict.confidence,
        evidence: verdict.evidence.map((reference) => {
          const location = canonicalEvidenceLocation(reference);
          const identity = evidenceLocationBytes(root, subject, location.relative);
          if (subject.kind === 'dirty') {
            assertSafeExactBytes(root, identity.bytes,
              `Dirty AC evidence file ${location.relative}`);
          }
          const normalized = identity.bytes.toString('utf8').replace(/\r\n/g, '\n');
          const lines = normalized === '' ? [] : normalized.split('\n');
          if (lines.at(-1) === '') lines.pop();
          return {
            location: reference,
            path: location.relative,
            line: location.line,
            column: location.column,
            file_sha256: sha256(identity.bytes),
            line_sha256: sha256(Buffer.from(lines[location.line - 1], 'utf8')),
            commit_blob_oid: identity.commit_blob_oid,
            file_bytes_base64: subject.kind === 'dirty'
              ? identity.bytes.toString('base64')
              : null
          };
        })
      };
    })
  };
}

function validateDurableLocationBytes(identity, bytes, label) {
  if (bytes.includes(0)) throw new Error(`${label} is binary`);
  const normalized = bytes.toString('utf8').replace(/\r\n/g, '\n');
  const lines = normalized === '' ? [] : normalized.split('\n');
  if (lines.at(-1) === '') lines.pop();
  if (identity.line > lines.length || identity.line < 1) {
    throw new Error(`${label} line is out of range`);
  }
  const line = lines[identity.line - 1];
  if (identity.column !== null &&
      (!Number.isInteger(identity.column) || identity.column < 1 ||
       identity.column > line.length + 1)) {
    throw new Error(`${label} column is out of range`);
  }
  if (sha256(Buffer.from(line, 'utf8')) !== identity.line_sha256) {
    throw new Error(`${label} line hash does not match`);
  }
}

function validateDurableAcEvidence(ac, subject, root = null, requestPath = null,
  requireExternal = false) {
  validateClosureSubjectShape(subject);
  if (!ac || !Array.isArray(ac.verdicts) || ac.verdicts.length === 0) {
    throw new Error('Durable AC evidence is malformed');
  }
  for (const [index, verdict] of ac.verdicts.entries()) {
    assertExactKeys(verdict, ['ac', 'status', 'confidence', 'evidence'],
      'durable AC verdict');
    if (verdict.ac !== index + 1 || verdict.status !== 'Complete' ||
        verdict.confidence !== 'High' || !Array.isArray(verdict.evidence) ||
        verdict.evidence.length === 0) {
      throw new Error('Durable AC verdict is incomplete');
    }
    if (requireExternal && !verdict.evidence.some((identity) =>
      identity?.path !== requestPath
    )) {
      throw new Error(
        'Durable AC evidence requires at least one location outside its own request'
      );
    }
    for (const identity of verdict.evidence) {
      assertExactKeys(identity, [
        'location', 'path', 'line', 'column', 'file_sha256', 'line_sha256',
        'commit_blob_oid', 'file_bytes_base64'
      ], 'durable AC location');
      const parsed = canonicalEvidenceLocation(identity.location);
      if (identity.path !== parsed.relative || identity.line !== parsed.line ||
          identity.column !== parsed.column) {
        throw new Error('Durable AC location identity does not match its location');
      }
      assertSha256(identity.file_sha256, 'durable AC file_sha256');
      assertSha256(identity.line_sha256, 'durable AC line_sha256');
      if (subject.kind === 'commit') {
        if (!/^[a-f0-9]{40}$/.test(identity.commit_blob_oid || '')) {
          throw new Error('Commit AC evidence requires a blob OID');
        }
        if (identity.file_bytes_base64 !== null) {
          throw new Error('Commit AC evidence cannot embed dirty file bytes');
        }
        if (root) {
          const current = evidenceLocationBytes(root, subject, identity.path);
          if (current.commit_blob_oid !== identity.commit_blob_oid ||
              sha256(current.bytes) !== identity.file_sha256) {
            throw new Error('Commit AC evidence identity does not match its commit tree');
          }
          validateDurableLocationBytes(identity, current.bytes, 'Commit AC evidence');
        }
      } else if (identity.commit_blob_oid !== null) {
        throw new Error('Dirty AC evidence cannot claim a commit blob OID');
      } else {
        const bytes = Buffer.from(identity.file_bytes_base64 || '', 'base64');
        if (!identity.file_bytes_base64 ||
            bytes.toString('base64') !== identity.file_bytes_base64 ||
            sha256(bytes) !== identity.file_sha256) {
          throw new Error('Dirty AC evidence file bytes do not match their identity');
        }
        assertSafeExactBytes(root || findRepoRoot(process.cwd()), bytes,
          'Dirty AC evidence file bytes');
        validateDurableLocationBytes(identity, bytes, 'Dirty AC evidence');
      }
    }
  }
}

function validateClosureEvidence(evidence, options = {}) {
  validateReviewEvidence(evidence.subject_review, 'Closure subject review evidence');
  passingExitEvidence(evidence.verify, 'Closure verify', options.verifyRequired === false);
  passingExitEvidence(evidence.checks, 'Closure checks');
  if (options.durable === true) {
    validateDurableAcEvidence(
      evidence.ac,
      options.subject,
      options.root || null,
      options.requestPath || null,
      options.requireExternalAcEvidence === true
    );
    if (Number.isInteger(options.expectedCriteria) &&
        evidence.ac.verdicts.length !== options.expectedCriteria) {
      throw new Error('Durable AC evidence count does not match the request definition');
    }
    return;
  }
  const verdicts = evidence.ac?.verdicts;
  if (!Array.isArray(verdicts) || verdicts.length === 0 ||
      (Number.isInteger(options.expectedCriteria) &&
        verdicts.length !== options.expectedCriteria) ||
      verdicts.some((verdict, index) =>
    !verdict || typeof verdict !== 'object' || verdict.status !== 'Complete' ||
    verdict.ac !== index + 1 ||
    verdict.confidence !== 'High' || !Array.isArray(verdict.evidence) ||
    verdict.evidence.length === 0 || verdict.evidence.some((item) =>
      typeof item !== 'string' || !/^[^:\n]+:\d+(?::\d+)?$/.test(item)
    )
  )) {
    throw new Error('Closure AC evidence requires Complete/High verdicts with file:line evidence');
  }
  if (options.root && options.subject) {
    validateAcEvidenceLocations(options.root, options.subject, verdicts);
  }
}

function validateReviewEvidence(review, label) {
  if (!review || typeof review !== 'object' || Array.isArray(review)) {
    throw new Error(`${label} must be clean`);
  }
  const payload = review.evidence && typeof review.evidence === 'object'
    ? review.evidence
    : review;
  assertExactKeys(payload, [
    'gate', 'native_results', 'external_results', 'subject_bindings'
  ],
    `${label} payload`);
  const gate = payload.gate;
  if (!gate || typeof gate !== 'object' || Array.isArray(gate) ||
      ((gate.outcome || gate.status) &&
        !['clean', 'pass'].includes(gate.outcome || gate.status)) ||
      Number(gate.findings || 0) !== 0) {
    throw new Error(`${label} must be clean`);
  }
  const reviewerCount = Number(gate.reviewers || gate.results?.length ||
    gate.agents?.length || 0);
  if (reviewerCount !== 2) throw new Error(`${label} requires exactly two independent reviewers`);
  if (!Array.isArray(payload.native_results) || !Array.isArray(payload.external_results) ||
      !Array.isArray(payload.subject_bindings) ||
      payload.native_results.some((item) => item?.outcome !== 'clean' ||
        item.has_transcript !== true || !/^[a-f0-9]{64}$/.test(item.result_sha256 || '')) ||
      payload.external_results.some((item) => item?.outcome !== 'clean')) {
    throw new Error(`${label} contains non-terminal or non-clean reviewer results`);
  }
  const bindingIdentities = new Set();
  for (const binding of payload.subject_bindings) {
    assertExactKeys(binding, [
      'agent_id', 'agent_type', 'subject_sha256', 'started_at'
    ], `${label} subject binding`);
    assertSha256(binding.subject_sha256, `${label} subject binding hash`);
    assertRecordedAt(binding.started_at, `${label} subject binding started_at`);
    if (typeof binding.agent_id !== 'string' || !binding.agent_id ||
        !requiredReviewers(review.provider).includes(binding.agent_type)) {
      throw new Error(`${label} contains a malformed reviewer subject binding`);
    }
    const identity = `${binding.agent_id}\0${binding.agent_type}`;
    if (bindingIdentities.has(identity)) {
      throw new Error(`${label} contains a duplicate reviewer subject binding`);
    }
    bindingIdentities.add(identity);
  }
  const nativeTypes = new Set(payload.native_results.map((item) => item.agent_type));
  const expectedNativeTypes = requiredReviewers(review.provider);
  if (nativeTypes.size !== expectedNativeTypes.length ||
      !expectedNativeTypes.every((type) => nativeTypes.has(type)) ||
      (review.provider === 'claude' && !payload.external_results.some((item) =>
        item.reviewer === 'claude_mcp' && item.perspective === 'primary' &&
        item.findings === 0
      ))) {
    throw new Error(`${label} is missing a configured terminal reviewer result`);
  }
  if (review.binding?.kind === 'commit') {
    const subjectSha = sha256(canonicalJson(review.binding));
    if (payload.subject_bindings.some((binding) =>
      binding.subject_sha256 !== subjectSha
    )) {
      throw new Error(`${label} contains a binding for another commit subject`);
    }
    if (!requiredReviewers(review.provider).every((type) =>
      payload.native_results.some((result) =>
        result.agent_type === type && payload.subject_bindings.some((binding) =>
          binding.agent_type === type && binding.subject_sha256 === subjectSha &&
          Date.parse(binding.started_at) <= Date.parse(result.started_at)
        )
      )
    )) {
      throw new Error(`${label} is missing durable reviewer subject bindings`);
    }
  } else if (payload.subject_bindings.length !== 0) {
    throw new Error(`${label} has unexpected commit subject bindings`);
  }
}

function reviewEvidenceFromState(state, subjectBindings = []) {
  return {
    gate: canonicalValue(state.gates.review.evidence),
    native_results: canonicalValue(state.review_agents.completed),
    external_results: canonicalValue(state.external_review.completed),
    subject_bindings: canonicalValue(subjectBindings)
  };
}

function gateEvidenceEnvelope(binding, provider, evidence) {
  return {
    binding: canonicalValue(binding),
    provider,
    evidence: canonicalValue(evidence)
  };
}

function validateGateEvidenceEnvelope(value, binding, label, expectedProvider = null) {
  assertExactKeys(value, ['binding', 'provider', 'evidence'], `${label} envelope`);
  if (!['codex', 'claude'].includes(value.provider) ||
      (expectedProvider && value.provider !== expectedProvider) ||
      canonicalJson(value.binding) !== canonicalJson(binding)) {
    throw new Error(`${label} envelope is not bound to the expected provider/subject`);
  }
}

function validateEvidenceBlobSemantics(record, blobs, root = null) {
  if (record.kind === 'request-closure-pending') {
    if (record.subject.kind === 'commit' && root) {
      let tree;
      try {
        tree = String(runEvidenceGit(root, [
          'rev-parse', `${record.subject.head_sha}^{tree}`
        ])).trim();
        runEvidenceGit(root, [
          'merge-base', '--is-ancestor', record.subject.base_sha,
          record.subject.head_sha
        ]);
      } catch {
        throw new Error('Commit closure subject history is unavailable or invalid');
      }
      if (tree !== record.subject.tree_sha) {
        throw new Error('Commit closure subject tree does not match its HEAD');
      }
    }
    validateGateEvidenceEnvelope(blobs['subject-review.json'], record.subject,
      'Closure subject review evidence');
    validateGateEvidenceEnvelope(blobs['verify.json'], record.subject,
      'Closure subject verify evidence');
    if (blobs['subject-review.json'].provider !== blobs['verify.json'].provider) {
      throw new Error('Closure subject review and verify providers must match');
    }
    const requestBlob = blobs['request.json'];
    assertExactKeys(requestBlob, [
      'encoding', 'prior_bytes_base64', 'prior_sha256',
      'proposed_bytes_base64', 'proposed_sha256'
    ],
      'Closure proposed request blob');
    let requestBytes;
    let priorBytes;
    try {
      requestBytes = Buffer.from(requestBlob.proposed_bytes_base64, 'base64');
      priorBytes = Buffer.from(requestBlob.prior_bytes_base64, 'base64');
    } catch {
      throw new Error('Closure proposed request blob is not base64');
    }
    if (requestBlob.encoding !== 'base64' ||
        requestBytes.toString('base64') !== requestBlob.proposed_bytes_base64 ||
        priorBytes.toString('base64') !== requestBlob.prior_bytes_base64 ||
        requestBlob.proposed_sha256 !== record.proposed_request_content_sha256 ||
        requestBlob.prior_sha256 !== record.prior_request_content_sha256 ||
        sha256(requestBytes) !== record.proposed_request_content_sha256 ||
        sha256(priorBytes) !== record.prior_request_content_sha256) {
      throw new Error('Closure proposed request blob does not match its pending record');
    }
    assertSafeExactBytes(root, requestBytes, 'Closure proposed request blob');
    assertSafeExactBytes(root, priorBytes, 'Closure prior request blob');
    if (!completedRequest(requestBytes.toString('utf8')) ||
        sha256(canonicalJson(requestDefinition(requestBytes.toString('utf8')))) !==
          record.ac_definition_sha256) {
      throw new Error('Closure proposed request blob is not its Completed request definition');
    }
    const requestBase = implementationBaseSha(requestBytes.toString('utf8'));
    const priorRequestBase = implementationBaseSha(priorBytes.toString('utf8'));
    if (requestBase === null || priorRequestBase !== requestBase ||
        requestBase !== record.implementation_base_sha ||
        (record.subject.kind === 'commit' && requestBase !== record.subject.base_sha)) {
      throw new Error('Closure Implementation Base SHA does not match its bound subject');
    }
    if (root) {
      try {
        runEvidenceGit(root, [
          'merge-base', '--is-ancestor', requestBase, record.subject.head_sha
        ]);
      } catch {
        throw new Error('Closure Implementation Base SHA is not an ancestor of subject HEAD');
      }
    }
    validateClosureEvidence({
      subject_review: blobs['subject-review.json'],
      verify: blobs['verify.json'],
      ac: blobs['ac.json'],
      checks: blobs['checks.json']
    }, {
      verifyRequired: record.verify_required,
      durable: true,
      subject: record.subject,
      root,
      requestPath: record.request_path,
      requireExternalAcEvidence:
        record.schema_version >= EVIDENCE_SCHEMA_VERSION,
      expectedCriteria: requestDefinition(requestBytes.toString('utf8')).criteria.length
    });
    return;
  }
  if (record.kind === 'request-closure') {
    validateGateEvidenceEnvelope(blobs['docs-review.json'], {
      kind: 'worktree', fingerprint: record.docs_fingerprint
    }, 'Closure docs review evidence');
    validateReviewEvidence(blobs['docs-review.json'], 'Closure docs review evidence');
    return;
  }
  const binding = { kind: 'worktree', fingerprint: record.final_fingerprint };
  validateGateEvidenceEnvelope(blobs['review.json'], binding,
    `${record.kind} review evidence`);
  validateReviewEvidence(blobs['review.json'], `${record.kind} review evidence`);
  if (record.kind !== 'retirement') {
    validateGateEvidenceEnvelope(blobs['verify.json'], binding,
      `${record.kind} verify evidence`);
    if (blobs['review.json'].provider !== blobs['verify.json'].provider) {
      throw new Error(`${record.kind} review and verify providers must match`);
    }
    passingExitEvidence(blobs['verify.json'], `${record.kind} verify`);
  }
}

function prepareRequestClosure(cwd, options, hooks = {}) {
  const root = findRepoRoot(cwd);
  assertExactKeys(options, [
    'promotion_unit_id', 'request_path', 'proposed_request', 'subject', 'evidence',
    'recorded_at', 'supersedes_record_sha256'
  ], 'closure prepare options');
  assertExactKeys(options.evidence, [
    'subject_review', 'verify', 'ac', 'checks'
  ], 'closure prepare evidence');
  assertPromotionUnit(options.promotion_unit_id);
  validateClosureSubject(root, options.subject, 'prepare');
  const subjectState = options.subject.kind === 'dirty' ? refreshState(root) : null;
  const commitAttestation = options.subject.kind === 'commit'
    ? readCommitClosureReview(root)
    : null;
  if (options.subject.kind === 'commit' && !commitAttestation) {
    throw new Error('Commit closure prepare requires an available completed attestation');
  }
  const commitState = commitAttestation ? refreshState(root) : null;
  if (commitAttestation && (commitAttestation.status !== 'complete' ||
      canonicalJson(commitAttestation.subject) !== canonicalJson(options.subject) ||
      commitAttestation.runtime_epoch !== commitState.runtime_epoch ||
      commitAttestation.provider !== commitState.review_provider)) {
    throw new Error('Commit closure prepare requires a matching completed attestation');
  }
  if (subjectState && !isCurrentPass(subjectState, 'review')) {
    throw new Error('Dirty closure prepare requires a current subject review pass');
  }
  if (subjectState?.worktree.requires_verify && !isCurrentPass(subjectState, 'verify')) {
    throw new Error('Dirty closure prepare requires a current subject verification pass');
  }
  validateGateEvidenceEnvelope(options.evidence.subject_review, options.subject,
    'Closure subject review evidence',
    subjectState?.review_provider || commitAttestation?.provider || null);
  validateGateEvidenceEnvelope(options.evidence.verify, options.subject,
    'Closure subject verify evidence',
    subjectState?.review_provider || commitAttestation?.provider ||
      options.evidence.subject_review.provider);
  if (subjectState && canonicalJson(options.evidence.subject_review.evidence) !==
      canonicalJson(reviewEvidenceFromState(subjectState))) {
    throw new Error('Dirty closure subject review evidence does not match the current gate');
  }
  if (subjectState?.worktree.requires_verify && canonicalJson(options.evidence.verify.evidence) !==
      canonicalJson(subjectState.gates.verify.evidence)) {
    throw new Error('Dirty closure verify evidence does not match the current gate');
  }
  if (commitAttestation &&
      (canonicalJson(options.evidence.subject_review.evidence) !==
        canonicalJson(commitAttestation.review_evidence) ||
       canonicalJson(options.evidence.verify.evidence) !==
        canonicalJson(commitAttestation.verify_evidence))) {
    throw new Error('Commit closure evidence does not match the runtime attestation');
  }
  const request = requestPathInRoot(root, options.request_path);
  if (!fs.existsSync(request.absolute)) throw new Error('Closure request does not exist');
  const currentBytes = fs.readFileSync(request.absolute);
  const proposedBytes = Buffer.from(options.proposed_request);
  if (!completedRequest(proposedBytes.toString('utf8'))) {
    throw new Error('Closure proposed request must be Completed with every AC checked');
  }
  assertSafeExactBytes(root, proposedBytes, 'Closure proposed request');
  if (completedRequest(currentBytes.toString('utf8'))) {
    throw new Error('Closure prepare must run before writing Completed request bytes');
  }
  const requestBase = implementationBaseSha(proposedBytes.toString('utf8'));
  const currentRequestBase = implementationBaseSha(currentBytes.toString('utf8'));
  if (requestBase === null || currentRequestBase === null) {
    throw new Error('Closure requires an immutable Implementation Base SHA');
  }
  if (requestBase !== currentRequestBase) {
    throw new Error('Closure cannot change the request Implementation Base SHA');
  }
  if (options.subject.kind === 'commit' && requestBase !== options.subject.base_sha) {
    throw new Error('Commit closure base_sha must equal the request Implementation Base SHA');
  }
  try {
    runEvidenceGit(root, [
      'merge-base', '--is-ancestor', requestBase, options.subject.head_sha
    ]);
  } catch {
    throw new Error('Closure Implementation Base SHA must be an ancestor of subject HEAD');
  }
  const definition = requestDefinition(proposedBytes.toString('utf8'));
  validateClosureEvidence(options.evidence, {
    verifyRequired: subjectState ? subjectState.worktree.requires_verify : true,
    expectedCriteria: definition.criteria.length,
    root,
    subject: options.subject
  });
  const durableAc = durableAcEvidence(
    root, options.subject, options.evidence.ac, options.request_path
  );
  const requestBlob = {
    encoding: 'base64',
    prior_bytes_base64: currentBytes.toString('base64'),
    prior_sha256: sha256(currentBytes),
    proposed_bytes_base64: proposedBytes.toString('base64'),
    proposed_sha256: sha256(proposedBytes)
  };
  const projection = snapshotProjection(root, [request.relative]);
  const record = {
    schema_version: EVIDENCE_SCHEMA_VERSION,
    kind: 'request-closure-pending',
    promotion_unit_id: options.promotion_unit_id,
    request_path: request.relative,
    prior_request_content_sha256: sha256(currentBytes),
    proposed_request_content_sha256: sha256(proposedBytes),
    implementation_base_sha: requestBase,
    ac_definition_sha256: sha256(canonicalJson(definition)),
    non_request_projection_sha256: projection.fingerprint,
    subject: canonicalValue(options.subject),
    verify_required: subjectState ? subjectState.worktree.requires_verify : true,
    subject_review_evidence_sha256: evidenceBlobHash(root, options.evidence.subject_review),
    verify_evidence_sha256: evidenceBlobHash(root, options.evidence.verify),
    ac_evidence_sha256: evidenceBlobHash(root, durableAc),
    checks_evidence_sha256: evidenceBlobHash(root, options.evidence.checks),
    proposed_request_blob_sha256: evidenceBlobHash(root, requestBlob),
    recorded_at: options.recorded_at || now(),
    supersedes_record_sha256: options.supersedes_record_sha256 || null
  };
  record.record_sha256 = evidenceRecordHash(record);
  const currentEvidenceOid = evidenceRefOid(root);
  if (currentEvidenceOid) auditEvidenceLedger(root);
  const existingRecord = currentEvidenceOid
    ? evidenceRecordsAt(root, currentEvidenceOid).find((entry) =>
      entry.record_sha256 === record.record_sha256
    )
    : null;
  if (existingRecord) {
    readEvidenceRecord(root, record.record_sha256);
  }
  const blobs = {
    'subject-review.json': {
      field: 'subject_review_evidence_sha256', value: options.evidence.subject_review
    },
    'verify.json': { field: 'verify_evidence_sha256', value: options.evidence.verify },
    'ac.json': { field: 'ac_evidence_sha256', value: durableAc },
    'checks.json': { field: 'checks_evidence_sha256', value: options.evidence.checks },
    'request.json': { field: 'proposed_request_blob_sha256', value: requestBlob }
  };
  const expectedOldOid = evidenceRefOid(root);
  if (typeof hooks.beforeAppend === 'function') hooks.beforeAppend(record);
  let result;
  withStateLock(root, (state) => {
    const worktree = snapshot(root);
    const startingHead = currentHead(root);
    const startingTree = currentHeadTree(root);
    const provider = reviewProvider(root);
    applySnapshot(state, worktree);
    applyReviewProvider(state, provider);
    validateClosureSubject(root, options.subject, 'prepare');
    const currentRequest = requestPathInRoot(root, options.request_path);
    const currentBytes = fs.readFileSync(currentRequest.absolute);
    const currentProjection = snapshotProjection(root, [currentRequest.relative]);
    if (sha256(currentBytes) !== record.prior_request_content_sha256 ||
        sha256(Buffer.from(options.proposed_request)) !==
          record.proposed_request_content_sha256 ||
        currentProjection.fingerprint !== record.non_request_projection_sha256 ||
        (options.subject.kind === 'dirty' &&
          worktree.requires_verify !== record.verify_required)) {
      throw new Error('Closure prepare inputs drifted before evidence append');
    }
    validateClosureEvidence(options.evidence, {
      verifyRequired: worktree.requires_verify,
      expectedCriteria: definition.criteria.length,
      root,
      subject: options.subject
    });
    const currentDurableAc = durableAcEvidence(
      root, options.subject, options.evidence.ac, options.request_path
    );
    if (canonicalJson(currentDurableAc) !== canonicalJson(durableAc)) {
      throw new Error('Closure AC evidence identity drifted before append');
    }
    if (options.subject.kind === 'dirty') {
      if (!isCurrentPass(state, 'review') ||
          (worktree.requires_verify && !isCurrentPass(state, 'verify')) ||
          canonicalJson(options.evidence.subject_review.evidence) !==
            canonicalJson(reviewEvidenceFromState(state)) ||
          (worktree.requires_verify &&
           canonicalJson(options.evidence.verify.evidence) !==
            canonicalJson(state.gates.verify.evidence))) {
        throw new Error('Dirty closure gates drifted before evidence append');
      }
    } else {
      assertCurrentCommitAttestation(root, state, commitAttestation, options.subject);
    }
    if (typeof hooks.beforeFinalSnapshot === 'function') hooks.beforeFinalSnapshot();
    const endingWorktree = snapshot(root);
    if (endingWorktree.fingerprint !== worktree.fingerprint ||
        currentHead(root) !== startingHead || currentHeadTree(root) !== startingTree) {
      throw new Error('Closure prepare worktree changed during locked derivation');
    }
    if (evidenceRefOid(root) !== expectedOldOid) {
      throw new Error('Evidence ref compare-and-swap expectation is stale');
    }
    if (existingRecord) {
      result = {
        ref: EVIDENCE_REF,
        old_oid: expectedOldOid,
        oid: expectedOldOid,
        record_sha256: record.record_sha256,
        reused: true
      };
    } else {
      result = appendEvidenceRevisionUnlocked(root, record, blobs, {
        expected_old_oid: expectedOldOid
      });
    }
    return state;
  });
  return { ...result, record };
}

function applyRequestClosure(cwd, options, hooks = {}) {
  const root = findRepoRoot(cwd);
  assertExactKeys(options, ['pending_record_sha256'], 'closure apply options');
  const pendingResult = readEvidenceRecord(root, options.pending_record_sha256);
  const pending = pendingResult.record;
  if (pending.kind !== 'request-closure-pending') {
    throw new Error('Closure apply requires a pending record');
  }
  if (pending.schema_version !== EVIDENCE_SCHEMA_VERSION) {
    throw new Error('Legacy pending closure must be superseded before apply');
  }
  auditEvidenceLedger(root);
  const latestPending = latestEvidenceRecord(
    root, 'request-closure-pending', pending.promotion_unit_id
  );
  if (latestPending?.record_sha256 !== pending.record_sha256) {
    throw new Error('Closure apply pending record is superseded or stale');
  }
  const paths = String(runEvidenceGit(root, [
    'ls-tree', '-r', '--name-only', pendingResult.oid
  ])).trim().split('\n').filter(Boolean);
  const requestBlob = validateEvidenceBlobAt(
    root, pendingResult.oid, pending, 'request.json',
    'proposed_request_blob_sha256', paths
  );
  const proposedBytes = Buffer.from(requestBlob.proposed_bytes_base64, 'base64');
  const priorBytes = Buffer.from(requestBlob.prior_bytes_base64, 'base64');
  const journalPath = closureApplyJournalPath(root, pending.record_sha256);
  let result;
  withStateLock(root, (state) => {
    const assertCurrentPending = () => {
      if (evidenceRefOid(root) !== pendingResult.oid ||
          latestEvidenceRecord(root, 'request-closure-pending',
            pending.promotion_unit_id)?.record_sha256 !== pending.record_sha256) {
        throw new Error('Closure apply pending evidence became superseded or stale');
      }
    };
    if (evidenceRefOid(root) !== pendingResult.oid) {
      throw new Error('Closure apply pending evidence ref is stale');
    }
    validateClosureSubject(root, pending.subject, 'finalize');
    const startingHead = currentHead(root);
    const startingTree = currentHeadTree(root);
    const request = requestPathInRoot(root, pending.request_path);
    const pathIdentities = capturePathIdentities(root, request.relative, 'file');
    const requestIdentity = pathIdentities.at(-1).stat;
    const assertFinalApplyState = (label) => {
      assertCurrentPending();
      assertPathIdentities(pathIdentities, label, true);
      if (!readAllSync(descriptor).equals(proposedBytes) ||
          snapshotProjection(root, [request.relative]).fingerprint !==
            pending.non_request_projection_sha256 ||
          currentHead(root) !== startingHead || currentHeadTree(root) !== startingTree) {
        throw new Error(`${label} changed before journal removal`);
      }
    };
    let descriptor;
    let mutationStarted = false;
    let journalOwned = false;
    try {
      descriptor = fs.openSync(request.absolute,
        fs.constants.O_RDWR | (fs.constants.O_NOFOLLOW || 0));
      const openedIdentity = fs.fstatSync(descriptor, { bigint: true });
      if (!sameNodeIdentity(openedIdentity, requestIdentity)) {
        throw new Error('Closure apply opened a different request identity');
      }
      const currentBytes = readAllSync(descriptor);
      const currentHash = sha256(currentBytes);
      let journal = null;
      if (fs.existsSync(journalPath)) {
        journal = JSON.parse(fs.readFileSync(journalPath, 'utf8'));
        assertExactKeys(journal, [
          'schema_version', 'pending_record_sha256', 'request_path',
          'prior_sha256', 'proposed_sha256', 'dev', 'ino', 'recorded_at'
        ], 'closure apply journal');
        if (journal.schema_version !== 1 ||
            journal.pending_record_sha256 !== pending.record_sha256 ||
            journal.request_path !== pending.request_path ||
            journal.prior_sha256 !== pending.prior_request_content_sha256 ||
            journal.proposed_sha256 !== pending.proposed_request_content_sha256 ||
            journal.dev !== openedIdentity.dev.toString() ||
            journal.ino !== openedIdentity.ino.toString()) {
          throw new Error('Closure apply journal does not match the pending request identity');
        }
        assertRecordedAt(journal.recorded_at, 'closure apply journal recorded_at');
        journalOwned = true;
      }
      if (![pending.prior_request_content_sha256,
        pending.proposed_request_content_sha256].includes(currentHash)) {
        throw new Error('Closure apply request bytes drifted after prepare; refusing to overwrite');
      }
      const projection = snapshotProjection(root, [request.relative]);
      if (projection.fingerprint !== pending.non_request_projection_sha256 ||
          sha256(proposedBytes) !== pending.proposed_request_content_sha256) {
        throw new Error('Closure apply inputs drifted from the pending record');
      }
      if (currentHash === pending.proposed_request_content_sha256) {
        if (typeof hooks.beforeJournalRemove === 'function') {
          hooks.beforeJournalRemove({ request: request.absolute, reused: true });
        }
        assertFinalApplyState('Closure apply proposed replay');
        if (journalOwned) removeDurableRuntimeMarker(journalPath);
        const worktree = snapshot(root);
        applySnapshot(state, worktree);
        result = {
          pending_record_sha256: pending.record_sha256,
          request_path: request.relative,
          request_content_sha256: currentHash,
          fingerprint: worktree.fingerprint,
          reused: true
        };
        return state;
      }
      if (typeof hooks.beforeRename === 'function') {
        hooks.beforeRename({ request: request.absolute });
      }
      const currentRequest = requestPathInRoot(root, pending.request_path);
      if (currentRequest.absolute !== request.absolute ||
          !sameNodeIdentity(fs.fstatSync(descriptor, { bigint: true }), requestIdentity)) {
        throw new Error('Closure apply request or parent identity changed before write');
      }
      assertPathIdentities(pathIdentities, 'Closure apply');
      if (currentHead(root) !== startingHead || currentHeadTree(root) !== startingTree) {
        throw new Error('Closure apply HEAD/tree changed before write');
      }
      if (typeof hooks.beforeWrite === 'function') hooks.beforeWrite({ request: request.absolute });
      const boundaryIdentity = fs.fstatSync(descriptor, { bigint: true });
      const boundaryBytes = readAllSync(descriptor);
      const boundaryHash = sha256(boundaryBytes);
      if (!sameNodeIdentity(boundaryIdentity, requestIdentity) ||
          boundaryHash !== pending.prior_request_content_sha256) {
        throw new Error('Closure apply request bytes or identity changed at the write boundary');
      }
      assertCurrentPending();
      writeDurableRuntimeMarker(journalPath, {
        schema_version: 1,
        pending_record_sha256: pending.record_sha256,
        request_path: pending.request_path,
        prior_sha256: pending.prior_request_content_sha256,
        proposed_sha256: pending.proposed_request_content_sha256,
        dev: boundaryIdentity.dev.toString(),
        ino: boundaryIdentity.ino.toString(),
        recorded_at: now()
      });
      journalOwned = true;
      mutationStarted = true;
      const truncate = hooks.truncate || fs.ftruncateSync;
      const write = hooks.write || fs.writeSync;
      const sync = hooks.fsync || fs.fsyncSync;
      truncate(descriptor, 0);
      writeAllSync(descriptor, proposedBytes, 0, write);
      sync(descriptor);
      const appliedBytes = readAllSync(descriptor);
      const appliedProjection = snapshotProjection(root, [request.relative]);
      if (!appliedBytes.equals(proposedBytes) ||
          sha256(appliedBytes) !== pending.proposed_request_content_sha256 ||
          appliedProjection.fingerprint !== pending.non_request_projection_sha256 ||
          currentHead(root) !== startingHead || currentHeadTree(root) !== startingTree) {
        throw new Error('Closure apply did not preserve the pending transaction');
      }
      if (typeof hooks.beforeJournalRemove === 'function') {
        hooks.beforeJournalRemove({ request: request.absolute, reused: false });
      }
      assertFinalApplyState('Closure apply request');
      removeDurableRuntimeMarker(journalPath);
      journalOwned = false;
    } catch (error) {
      if (descriptor !== undefined && mutationStarted && journalOwned) {
        throw new Error(`${error.message}; closure apply recovery remains journaled`);
      }
      throw error;
    } finally {
      if (descriptor !== undefined) fs.closeSync(descriptor);
    }
    const appliedBytes = proposedBytes;
    const worktree = snapshot(root);
    applySnapshot(state, worktree);
    result = {
      pending_record_sha256: pending.record_sha256,
      request_path: request.relative,
      request_content_sha256: sha256(appliedBytes),
      fingerprint: worktree.fingerprint
    };
    return state;
  });
  return result;
}

function recoverRequestClosure(cwd, options, hooks = {}) {
  const root = findRepoRoot(cwd);
  assertExactKeys(options, [
    'pending_record_sha256', 'action', 'expected_current_sha256'
  ],
    'closure recover options');
  if (!['restore-prior', 'abandon'].includes(options.action)) {
    throw new Error('Closure recover action must be restore-prior or abandon');
  }
  assertSha256(options.expected_current_sha256,
    'closure recover expected_current_sha256');
  const pendingResult = readEvidenceRecord(root, options.pending_record_sha256);
  const pending = pendingResult.record;
  if (pending.kind !== 'request-closure-pending') {
    throw new Error('Closure recover requires a pending record');
  }
  auditEvidenceLedger(root);
  if (latestEvidenceRecord(root, 'request-closure-pending',
    pending.promotion_unit_id)?.record_sha256 !== pending.record_sha256) {
    throw new Error('Closure recover pending record is superseded or stale');
  }
  const paths = String(runEvidenceGit(root, [
    'ls-tree', '-r', '--name-only', pendingResult.oid
  ])).trim().split('\n').filter(Boolean);
  const requestBlob = validateEvidenceBlobAt(
    root, pendingResult.oid, pending, 'request.json',
    'proposed_request_blob_sha256', paths
  );
  const priorBytes = Buffer.from(requestBlob.prior_bytes_base64, 'base64');
  const journalPath = closureApplyJournalPath(root, pending.record_sha256);
  const recoveryDirectory = path.join(root, '.sd0x', 'closure-recovery');
  const recoveryJournalPath = path.join(recoveryDirectory,
    `${pending.record_sha256}.json`);
  let result;
  withStateLock(root, (state) => {
    const assertCurrentPending = () => {
      if (evidenceRefOid(root) !== pendingResult.oid ||
          latestEvidenceRecord(root, 'request-closure-pending',
            pending.promotion_unit_id)?.record_sha256 !== pending.record_sha256) {
        throw new Error('Closure recover evidence changed before recovery');
      }
    };
    assertCurrentPending();
    const requestAbsolute = path.join(root, ...pending.request_path.split('/'));
    const requestParentRelative = path.posix.dirname(pending.request_path);
    const requestParentIdentities = capturePathIdentities(
      root, requestParentRelative, 'directory'
    );
    let recoveryPaths = containedDirectoryIdentities(
      root, '.sd0x/closure-recovery'
    );
    const assertRecoveryDirectory = () => {
      if (!recoveryPaths) {
        throw new Error('Closure recovery directory is unavailable');
      }
      assertPathNodeIdentities(recoveryPaths, 'Closure recovery directory');
    };
    const readJournal = (required = true) => {
      const journalStat = fs.lstatSync(journalPath, {
        bigint: true,
        throwIfNoEntry: false
      });
      if (!journalStat) {
        if (!required) return null;
        throw new Error('Closure recover requires a regular apply journal');
      }
      if (!journalStat.isFile() || journalStat.isSymbolicLink()) {
        throw new Error('Closure recover requires a regular apply journal');
      }
      let journal;
      try {
        journal = JSON.parse(fs.readFileSync(journalPath, 'utf8'));
      } catch {
        throw new Error('Closure recover requires a readable apply journal');
      }
      assertExactKeys(journal, [
        'schema_version', 'pending_record_sha256', 'request_path',
        'prior_sha256', 'proposed_sha256', 'dev', 'ino', 'recorded_at'
      ], 'closure apply journal');
      if (journal.schema_version !== 1 ||
          journal.pending_record_sha256 !== pending.record_sha256 ||
          journal.request_path !== pending.request_path ||
          journal.prior_sha256 !== pending.prior_request_content_sha256 ||
          journal.proposed_sha256 !== pending.proposed_request_content_sha256) {
        throw new Error('Closure recover journal does not match the pending request');
      }
      assertRecordedAt(journal.recorded_at, 'closure apply journal recorded_at');
      return journal;
    };
    const recoveryArtifacts = (recovery) => {
      assertExactKeys(recovery, [
        'schema_version', 'pending_record_sha256', 'request_path',
        'expected_current_sha256', 'prior_sha256', 'nonce', 'original_mode',
        'phase', 'recorded_at'
      ], 'closure recovery journal');
      if (recovery.schema_version !== 1 ||
          recovery.pending_record_sha256 !== pending.record_sha256 ||
          recovery.request_path !== pending.request_path ||
          recovery.prior_sha256 !== pending.prior_request_content_sha256 ||
          !/^[a-f0-9-]{36}$/.test(recovery.nonce || '') ||
          !Number.isInteger(recovery.original_mode) ||
          recovery.original_mode < 0 || recovery.original_mode > 0o7777 ||
          !['prepared', 'displaced', 'installed'].includes(recovery.phase)) {
        throw new Error('Closure recovery journal does not match the pending request');
      }
      assertSha256(recovery.expected_current_sha256,
        'closure recovery journal expected_current_sha256');
      assertRecordedAt(recovery.recorded_at,
        'closure recovery journal recorded_at');
      const prefix = `${pending.record_sha256}.${recovery.nonce}`;
      return {
        priorTemporary: path.join(recoveryDirectory, `${prefix}.prior`),
        displacedBackup: path.join(recoveryDirectory, `${prefix}.displaced`)
      };
    };
    const readRecovery = () => {
      if (!recoveryPaths) return null;
      assertRecoveryDirectory();
      const recoveryStat = fs.lstatSync(recoveryJournalPath, {
        bigint: true,
        throwIfNoEntry: false
      });
      if (!recoveryStat) return null;
      if (!recoveryStat.isFile() || recoveryStat.isSymbolicLink()) {
        throw new Error('Closure recover requires a regular recovery journal');
      }
      let recovery;
      try {
        recovery = JSON.parse(fs.readFileSync(recoveryJournalPath, 'utf8'));
      } catch {
        throw new Error('Closure recover requires a readable recovery journal');
      }
      assertRecoveryDirectory();
      return { recovery, ...recoveryArtifacts(recovery) };
    };
    const readRegular = (filePath, label) => {
      const stat = fs.lstatSync(filePath, { bigint: true, throwIfNoEntry: false });
      if (!stat) return null;
      if (!stat.isFile() || stat.isSymbolicLink()) {
        throw new Error(`${label} is not a regular file`);
      }
      let descriptor;
      try {
        descriptor = fs.openSync(filePath,
          fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
        const opened = fs.fstatSync(descriptor, { bigint: true });
        if (!sameNodeIdentity(opened, stat)) {
          throw new Error(`${label} identity changed while opening`);
        }
        return { stat: opened, bytes: readAllSync(descriptor) };
      } finally {
        if (descriptor !== undefined) fs.closeSync(descriptor);
      }
    };
    const finishRecovery = (recoveryState, journal) => {
      const { recovery, priorTemporary, displacedBackup } = recoveryState;
      assertRecoveryDirectory();
      if (options.action === 'abandon') {
        const current = readRegular(requestAbsolute, 'Closure recovery request');
        if (!current || sha256(current.bytes) !== options.expected_current_sha256) {
          throw new Error('Closure recover request bytes differ from operator expectation');
        }
        assertCurrentPending();
        assertPathNodeIdentities(requestParentIdentities, 'Closure recover parent');
        assertRecoveryDirectory();
        if (journal) removeDurableRuntimeMarker(journalPath);
        fs.rmSync(priorTemporary, { force: true });
        assertRecoveryDirectory();
        removeDurableRuntimeMarker(recoveryJournalPath);
        const worktree = snapshot(root);
        applySnapshot(state, worktree);
        result = {
          pending_record_sha256: pending.record_sha256,
          request_path: pending.request_path,
          action: options.action,
          request_content_sha256: sha256(current.bytes),
          displaced_backup_path: fs.existsSync(displacedBackup)
            ? path.relative(root, displacedBackup).split(path.sep).join('/')
            : null,
          fingerprint: worktree.fingerprint
        };
        return state;
      }
      if (options.expected_current_sha256 !== recovery.expected_current_sha256) {
        throw new Error('Closure recover expectation does not match the active recovery');
      }
      let displaced = readRegular(displacedBackup,
        'Closure recovery displaced backup');
      let current = readRegular(requestAbsolute, 'Closure recovery request');
      let prior = readRegular(priorTemporary, 'Closure recovery prior temporary');
      if (!displaced) {
        if (!current || !prior ||
            sha256(current.bytes) !== recovery.expected_current_sha256 ||
            sha256(prior.bytes) !== pending.prior_request_content_sha256 ||
            (Number(prior.stat.mode & 0o7777n) !== recovery.original_mode) ||
            !journal || journal.dev !== current.stat.dev.toString() ||
            journal.ino !== current.stat.ino.toString()) {
          throw new Error('Closure recovery prepared phase cannot be resumed safely');
        }
        assertCurrentPending();
        assertPathNodeIdentities(requestParentIdentities, 'Closure recover parent');
        assertRecoveryDirectory();
        fs.renameSync(requestAbsolute, displacedBackup);
        fsyncDirectory(path.dirname(requestAbsolute));
        fsyncDirectory(recoveryDirectory);
        if (typeof hooks.afterRecoveryRename === 'function') {
          hooks.afterRecoveryRename({
            request: requestAbsolute,
            displaced: displacedBackup
          });
        }
        assertRecoveryDirectory();
        recovery.phase = 'displaced';
        writeDurableRuntimeMarker(recoveryJournalPath, recovery);
        if (typeof hooks.afterDisplace === 'function') {
          hooks.afterDisplace({
            request: requestAbsolute,
            displaced: displacedBackup
          });
        }
        displaced = readRegular(displacedBackup,
          'Closure recovery displaced backup');
        current = null;
      }
      if (sha256(displaced.bytes) !== recovery.expected_current_sha256 ||
          (journal && (journal.dev !== displaced.stat.dev.toString() ||
            journal.ino !== displaced.stat.ino.toString()))) {
        throw new Error('Closure recovery displaced bytes or identity changed');
      }
      if (!current) {
        assertRecoveryDirectory();
        prior = readRegular(priorTemporary, 'Closure recovery prior temporary');
        if (!prior || sha256(prior.bytes) !== pending.prior_request_content_sha256 ||
            Number(prior.stat.mode & 0o7777n) !== recovery.original_mode) {
          throw new Error('Closure recovery prior temporary is unavailable');
        }
        try {
          const linkPrior = hooks.linkPrior || fs.linkSync;
          linkPrior(priorTemporary, requestAbsolute);
          fsyncDirectory(path.dirname(requestAbsolute));
          if (typeof hooks.afterRecoveryLink === 'function') {
            hooks.afterRecoveryLink({ request: requestAbsolute });
          }
        } catch (error) {
          let rollbackError = null;
          try {
            if (!fs.existsSync(requestAbsolute)) {
              assertRecoveryDirectory();
              fs.linkSync(displacedBackup, requestAbsolute);
              fsyncDirectory(path.dirname(requestAbsolute));
            }
            const reinstalled = readRegular(
              requestAbsolute, 'Closure recovery reinstalled request'
            );
            if (!reinstalled ||
                !sameNodeIdentity(reinstalled.stat, displaced.stat)) {
              throw new Error(
                'Closure recovery live path was occupied during rollback'
              );
            }
            fs.rmSync(priorTemporary, { force: true });
            assertRecoveryDirectory();
            removeDurableRuntimeMarker(recoveryJournalPath);
          } catch (rollback) {
            rollbackError = rollback;
          }
          if (rollbackError) {
            throw new Error(
              `Closure recover prior install failed and remains journaled: ${error.message}; ${rollbackError.message}`
            );
          }
          throw new Error(
            `Closure recover could not install prior bytes; current bytes were reinstalled without overwrite: ${error.message}`
          );
        }
        assertRecoveryDirectory();
        recovery.phase = 'installed';
        writeDurableRuntimeMarker(recoveryJournalPath, recovery);
        if (typeof hooks.afterInstall === 'function') {
          hooks.afterInstall({ request: requestAbsolute });
        }
        current = readRegular(requestAbsolute, 'Closure recovery request');
      }
      if (!current || sha256(current.bytes) !== pending.prior_request_content_sha256 ||
          Number(current.stat.mode & 0o7777n) !== recovery.original_mode) {
        throw new Error('Closure recovery installed request changed');
      }
      assertRecoveryDirectory();
      fs.rmSync(priorTemporary, { force: true });
      fsyncDirectory(recoveryDirectory);
      if (typeof hooks.beforeJournalRemove === 'function') {
        hooks.beforeJournalRemove({
          request: requestAbsolute,
          action: options.action
        });
      }
      current = readRegular(requestAbsolute, 'Closure recovery request');
      displaced = readRegular(displacedBackup,
        'Closure recovery displaced backup');
      if (!current || !displaced ||
          sha256(current.bytes) !== pending.prior_request_content_sha256 ||
          Number(current.stat.mode & 0o7777n) !== recovery.original_mode ||
          sha256(displaced.bytes) !== recovery.expected_current_sha256) {
        throw new Error('Closure recover request bytes changed before journal removal');
      }
      assertCurrentPending();
      assertPathNodeIdentities(requestParentIdentities, 'Closure recover parent');
      assertRecoveryDirectory();
      if (journal) removeDurableRuntimeMarker(journalPath);
      removeDurableRuntimeMarker(recoveryJournalPath);
      const worktree = snapshot(root);
      applySnapshot(state, worktree);
      result = {
        pending_record_sha256: pending.record_sha256,
        request_path: pending.request_path,
        action: options.action,
        request_content_sha256: sha256(current.bytes),
        displaced_backup_path: path.relative(root, displacedBackup)
          .split(path.sep).join('/'),
        fingerprint: worktree.fingerprint
      };
      return state;
    };
    const activeRecovery = readRecovery();
    if (activeRecovery) {
      return finishRecovery(activeRecovery, readJournal(false));
    }
    const request = requestPathInRoot(root, pending.request_path);
    const identities = capturePathIdentities(root, request.relative, 'file');
    let descriptor;
    try {
      const journal = readJournal();
      descriptor = fs.openSync(request.absolute,
        (options.action === 'restore-prior'
          ? fs.constants.O_RDWR : fs.constants.O_RDONLY) |
          (fs.constants.O_NOFOLLOW || 0));
      const identity = fs.fstatSync(descriptor, { bigint: true });
      if (!sameNodeIdentity(identity, identities.at(-1).stat)) {
        throw new Error('Closure recover opened a different request identity');
      }
      if (options.action === 'restore-prior' &&
          (journal.dev !== identity.dev.toString() ||
           journal.ino !== identity.ino.toString())) {
        throw new Error('Closure recover journal does not match the request identity');
      }
      if (sha256(readAllSync(descriptor)) !== options.expected_current_sha256) {
        throw new Error('Closure recover request bytes differ from operator expectation');
      }
      if (typeof hooks.beforeMutation === 'function') {
        hooks.beforeMutation({ request: request.absolute, action: options.action });
      }
      if (sha256(readAllSync(descriptor)) !== options.expected_current_sha256) {
        throw new Error('Closure recover request bytes changed before recovery');
      }
      assertCurrentPending();
      if (options.action === 'restore-prior') {
        if (typeof hooks.afterAuthorizationCheck === 'function') {
          hooks.afterAuthorizationCheck({ request: request.absolute });
        }
        if (sha256(readAllSync(descriptor)) !== options.expected_current_sha256 ||
            !sameNodeIdentity(fs.fstatSync(descriptor, { bigint: true }), identity)) {
          throw new Error('Closure recover request changed after authorization');
        }
        assertCurrentPending();
        assertPathIdentities(identities, 'Closure recover');
        recoveryPaths = containedDirectoryIdentities(
          root, '.sd0x/closure-recovery', { create: true }
        );
        assertRecoveryDirectory();
        const nonce = crypto.randomUUID();
        const priorTemporary = path.join(recoveryDirectory,
          `${pending.record_sha256}.${nonce}.prior`);
        const originalMode = Number(identity.mode & 0o7777n);
        let temporaryDescriptor;
        try {
          temporaryDescriptor = fs.openSync(priorTemporary,
            fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL, 0o600);
          fs.fchmodSync(temporaryDescriptor, originalMode);
          writeAllSync(temporaryDescriptor, priorBytes);
          fs.fsyncSync(temporaryDescriptor);
        } finally {
          if (temporaryDescriptor !== undefined) fs.closeSync(temporaryDescriptor);
        }
        const recovery = {
          schema_version: 1,
          pending_record_sha256: pending.record_sha256,
          request_path: pending.request_path,
          expected_current_sha256: options.expected_current_sha256,
          prior_sha256: pending.prior_request_content_sha256,
          nonce,
          original_mode: originalMode,
          phase: 'prepared',
          recorded_at: now()
        };
        writeDurableRuntimeMarker(recoveryJournalPath, recovery);
        if (typeof hooks.afterRecoveryPrepared === 'function') {
          hooks.afterRecoveryPrepared({
            request: request.absolute,
            recovery_journal: recoveryJournalPath
          });
        }
        assertRecoveryDirectory();
        fs.closeSync(descriptor);
        descriptor = undefined;
        return finishRecovery({
          recovery,
          priorTemporary,
          displacedBackup: path.join(recoveryDirectory,
            `${pending.record_sha256}.${nonce}.displaced`)
        }, journal);
      }
      if (typeof hooks.beforeJournalRemove === 'function') {
        hooks.beforeJournalRemove({ request: request.absolute, action: options.action });
      }
      const finalBytes = readAllSync(descriptor);
      const expectedFinalHash = options.action === 'restore-prior'
        ? pending.prior_request_content_sha256
        : options.expected_current_sha256;
      if (sha256(finalBytes) !== expectedFinalHash) {
        throw new Error('Closure recover request bytes changed before journal removal');
      }
      assertCurrentPending();
      if (options.action === 'restore-prior') {
        const restored = capturePathIdentities(root, request.relative, 'file');
        if (!sameNodeIdentity(fs.fstatSync(descriptor, { bigint: true }),
          restored.at(-1).stat)) {
          throw new Error('Closure recover restored path identity changed');
        }
        assertPathIdentities(restored, 'Closure recover');
      } else {
        assertPathIdentities(identities, 'Closure recover');
      }
      removeDurableRuntimeMarker(journalPath);
      const worktree = snapshot(root);
      applySnapshot(state, worktree);
      result = {
        pending_record_sha256: pending.record_sha256,
        request_path: request.relative,
        action: options.action,
        request_content_sha256: sha256(finalBytes),
        displaced_backup_path: null,
        fingerprint: worktree.fingerprint
      };
      return state;
    } finally {
      if (descriptor !== undefined) fs.closeSync(descriptor);
    }
  });
  return result;
}

function finalizeRequestClosure(cwd, options, hooks = {}) {
  const root = findRepoRoot(cwd);
  assertExactKeys(options, [
    'pending_record_sha256', 'recorded_at', 'supersedes_record_sha256'
  ], 'closure finalize options');
  const pending = readEvidenceRecord(root, options.pending_record_sha256).record;
  if (pending.kind !== 'request-closure-pending') {
    throw new Error('Closure finalize requires a pending record');
  }
  if (pending.schema_version !== EVIDENCE_SCHEMA_VERSION) {
    throw new Error('Legacy pending closure must be superseded before finalization');
  }
  auditEvidenceLedger(root);
  const latestPending = latestEvidenceRecord(
    root, 'request-closure-pending', pending.promotion_unit_id
  );
  if (latestPending?.record_sha256 !== pending.record_sha256) {
    throw new Error('Closure finalize pending record is superseded or stale');
  }
  const recordedAt = options.recorded_at || now();
  const derive = (state) => {
    validateClosureSubject(root, pending.subject, 'finalize');
    const request = readBoundRegularFile(root, pending.request_path, {
      beforeRead: hooks.beforeRequestRead
    });
    const requestBytes = request.bytes;
    if (sha256(requestBytes) !== pending.proposed_request_content_sha256 ||
        !completedRequest(requestBytes.toString('utf8'))) {
      throw new Error('Closure request bytes drifted from the pending Completed proposal');
    }
    const projection = snapshotProjection(root, [request.relative]);
    if (projection.fingerprint !== pending.non_request_projection_sha256) {
      throw new Error('Closure non-request projection drifted after prepare');
    }
    if (!isCurrentPass(state, 'review')) {
      throw new Error('Closure finalize requires a current docs review pass');
    }
    const docsReview = gateEvidenceEnvelope({
      kind: 'worktree', fingerprint: state.worktree.fingerprint
    }, state.review_provider, reviewEvidenceFromState(state));
    const docsReviewHash = evidenceBlobHash(root, docsReview);
    if (docsReviewHash === pending.subject_review_evidence_sha256) {
      throw new Error('Closure subject and docs review evidence must be distinct');
    }
    const record = {
      schema_version: EVIDENCE_SCHEMA_VERSION,
      kind: 'request-closure',
      promotion_unit_id: pending.promotion_unit_id,
      pending_record_sha256: pending.record_sha256,
      request_path: request.relative,
      request_content_sha256: sha256(requestBytes),
      implementation_base_sha: pending.implementation_base_sha,
      ac_definition_sha256: pending.ac_definition_sha256,
      subject_review_evidence_sha256: pending.subject_review_evidence_sha256,
      docs_review_evidence_sha256: docsReviewHash,
      docs_fingerprint: state.worktree.fingerprint,
      recorded_at: recordedAt,
      supersedes_record_sha256: options.supersedes_record_sha256 || null
    };
    record.record_sha256 = evidenceRecordHash(record);
    return { record, docsReview };
  };
  const starting = derive(refreshState(root));
  const expectedOldOid = evidenceRefOid(root);
  const existing = evidenceRecordsAt(root, evidenceRefOid(root)).find((record) =>
    record.kind === 'request-closure' &&
    record.pending_record_sha256 === pending.record_sha256
  );
  if (existing) {
    if (existing.request_content_sha256 !== starting.record.request_content_sha256 ||
        existing.implementation_base_sha !== pending.implementation_base_sha ||
        existing.ac_definition_sha256 !== pending.ac_definition_sha256 ||
        existing.subject_review_evidence_sha256 !== pending.subject_review_evidence_sha256 ||
        existing.docs_review_evidence_sha256 !==
          starting.record.docs_review_evidence_sha256 ||
        existing.docs_fingerprint !== starting.record.docs_fingerprint) {
      throw new Error('Existing request closure no longer matches current closure evidence');
    }
  }
  if (typeof hooks.beforeAppend === 'function') hooks.beforeAppend(starting.record);
  let result;
  let finalRecord;
  withStateLock(root, (state) => {
    const worktree = snapshot(root);
    const startingHead = currentHead(root);
    const startingTree = currentHeadTree(root);
    const provider = reviewProvider(root);
    applySnapshot(state, worktree);
    applyReviewProvider(state, provider);
    if (latestEvidenceRecord(root, 'request-closure-pending',
      pending.promotion_unit_id)?.record_sha256 !== pending.record_sha256) {
      throw new Error('Closure finalize pending record became superseded or stale');
    }
    const current = derive(state);
    if (typeof hooks.beforeFinalSnapshot === 'function') hooks.beforeFinalSnapshot();
    const endingWorktree = snapshot(root);
    if (endingWorktree.fingerprint !== worktree.fingerprint ||
        currentHead(root) !== startingHead || currentHeadTree(root) !== startingTree ||
        current.record.request_content_sha256 !== starting.record.request_content_sha256 ||
        current.record.docs_review_evidence_sha256 !==
          starting.record.docs_review_evidence_sha256 ||
        current.record.docs_fingerprint !== starting.record.docs_fingerprint ||
        evidenceRefOid(root) !== expectedOldOid) {
      throw new Error('Closure finalize inputs drifted before evidence append');
    }
    if (existing) {
      finalRecord = existing;
      result = {
        ref: EVIDENCE_REF,
        old_oid: expectedOldOid,
        oid: expectedOldOid,
        record_sha256: existing.record_sha256,
        reused: true
      };
    } else {
      finalRecord = current.record;
      result = appendEvidenceRevisionUnlocked(root, current.record, {
        'docs-review.json': {
          field: 'docs_review_evidence_sha256', value: current.docsReview
        }
      }, { expected_old_oid: expectedOldOid });
    }
    return state;
  });
  return { ...result, record: finalRecord };
}

function normalizedDispositionRows(rows) {
  const values = rows.map((row) => ['pack-ready', 'promoted'].includes(row.delivery_state)
    ? { ...row, delivery_state: 'candidate' }
    : row).sort((left, right) => Buffer.from(left.source_name).compare(
      Buffer.from(right.source_name)
    ));
  return values.length === 1 ? values[0] : values;
}

function dispositionEvidenceForUnit(root, promotionUnitId) {
  const relative = 'migration/source-disposition.json';
  let dispositionPath = root;
  const ancestorIdentities = [];
  for (const segment of relative.split('/')) {
    dispositionPath = path.join(dispositionPath, segment);
    const stat = fs.lstatSync(dispositionPath, { throwIfNoEntry: false });
    if (!stat || stat.isSymbolicLink()) {
      throw new Error('Promotion disposition path is missing or symlinked');
    }
    ancestorIdentities.push({
      path: dispositionPath,
      dev: stat.dev,
      ino: stat.ino
    });
  }
  const dispositionReal = fs.realpathSync(dispositionPath);
  const containment = path.relative(fs.realpathSync(root), dispositionReal);
  if (containment === '..' || containment.startsWith(`..${path.sep}`) ||
      path.isAbsolute(containment) || !fs.statSync(dispositionReal).isFile()) {
    throw new Error('Promotion disposition path escapes the repository or is not regular');
  }
  let disposition;
  let descriptor;
  try {
    descriptor = fs.openSync(dispositionReal,
      fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
    const before = fs.fstatSync(descriptor, { bigint: true });
    const capturedLeaf = ancestorIdentities.at(-1);
    if (before.dev !== BigInt(capturedLeaf.dev) ||
        before.ino !== BigInt(capturedLeaf.ino)) {
      throw new Error('Promotion disposition opened a different file identity');
    }
    const bytes = readAllSync(descriptor);
    const after = fs.fstatSync(descriptor, { bigint: true });
    if (before.dev !== after.dev || before.ino !== after.ino ||
        before.size !== after.size || before.mtimeNs !== after.mtimeNs ||
        before.ctimeNs !== after.ctimeNs ||
        fs.realpathSync(dispositionPath) !== dispositionReal ||
        ancestorIdentities.some((identity) => {
          const current = fs.lstatSync(identity.path, { throwIfNoEntry: false });
          return !current || current.isSymbolicLink() ||
            current.dev !== identity.dev || current.ino !== identity.ino;
        })) {
      throw new Error('Promotion disposition changed while it was read');
    }
    disposition = JSON.parse(bytes.toString('utf8'));
  } catch (error) {
    throw new Error(`Promotion disposition is unavailable: ${error.message}`);
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
  }
  const rows = Array.isArray(disposition.skills)
    ? disposition.skills.filter((row) => row.promotion_unit_id === promotionUnitId)
    : [];
  if (rows.length === 0) {
    throw new Error(`Promotion disposition has no rows for ${promotionUnitId}`);
  }
  return normalizedDispositionRows(rows);
}

function promotionPayloadPath(row, kind) {
  const rows = Array.isArray(row) ? row : [row];
  const targets = [...new Set(rows.map((item) => item.target_skill))];
  const packages = [...new Set(rows.map((item) => item.target_package))];
  if (targets.length !== 1 || packages.length !== 1) {
    throw new Error('Promotion disposition rows disagree on target skill/package');
  }
  if (!/^[a-z0-9][a-z0-9-]*$/.test(targets[0] || '') ||
      !/^[a-z0-9][a-z0-9-]*$/.test(packages[0] || '')) {
    throw new Error('Promotion target skill/package must be canonical slugs');
  }
  if (kind === 'promotion') {
    if (packages[0] !== 'core') throw new Error('Core promotion requires target_package=core');
    return `plugin/sd0x-dev-flow-codex/skills/${targets[0]}`;
  }
  if (kind === 'pack-ready') {
    if (packages[0] === 'core' || packages[0] === 'retired') {
      throw new Error('Pack-ready evidence requires a non-core package row');
    }
    return `migration/packs/${packages[0]}/${targets[0]}`;
  }
  return null;
}

function hashPayloadTree(root, relative, hooks = {}) {
  const ancestors = capturePathIdentities(root, relative, 'directory');
  const directory = ancestors.at(-1).absolute;
  const containment = path.relative(fs.realpathSync(root), fs.realpathSync(directory));
  if (containment === '..' || containment.startsWith(`..${path.sep}`) ||
      path.isAbsolute(containment)) {
    throw new Error(`Promotion payload directory escapes the repository: ${relative}`);
  }
  const captureManifest = () => {
    const directories = [];
    const files = [];
    const visit = (current, prefix) => {
      const directoryStat = fs.lstatSync(current, {
        bigint: true,
        throwIfNoEntry: false
      });
      if (!directoryStat?.isDirectory() || directoryStat.isSymbolicLink()) {
        throw new Error(`Promotion payload directory changed: ${prefix || relative}`);
      }
      const names = fs.readdirSync(current).sort((left, right) =>
        Buffer.from(left).compare(Buffer.from(right))
      );
      const directoryEntry = {
        relative: prefix,
        identity: statIdentity(directoryStat),
        entries: names
      };
      directories.push(directoryEntry);
      for (const name of names) {
        const child = path.join(current, name);
        const childRelative = prefix ? `${prefix}/${name}` : name;
        const childStat = fs.lstatSync(child, {
          bigint: true,
          throwIfNoEntry: false
        });
        if (!childStat || childStat.isSymbolicLink()) {
          throw new Error(`Promotion payload contains a missing path or symlink: ${childRelative}`);
        }
        if (childStat.isDirectory()) {
          visit(child, childRelative);
        } else if (childStat.isFile()) {
          files.push({
            relative: childRelative,
            absolute: child,
            identity: statIdentity(childStat)
          });
        } else {
          throw new Error(`Promotion payload contains a non-regular file: ${childRelative}`);
        }
      }
    };
    visit(directory, '');
    return { directories, files };
  };
  const manifest = captureManifest();
  if (typeof hooks.beforePayloadTraversal === 'function') {
    hooks.beforePayloadTraversal({ directory, relative });
  }
  const files = manifest.files.map((file) => {
    const pathStat = fs.lstatSync(file.absolute, {
      bigint: true,
      throwIfNoEntry: false
    });
    if (!pathStat?.isFile() || pathStat.isSymbolicLink() ||
        canonicalJson(statIdentity(pathStat)) !== canonicalJson(file.identity)) {
      throw new Error(`Promotion payload file identity changed: ${file.relative}`);
    }
    let descriptor;
    try {
      descriptor = fs.openSync(file.absolute,
        fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
      const before = fs.fstatSync(descriptor, { bigint: true });
      if (canonicalJson(statIdentity(before)) !== canonicalJson(file.identity)) {
        throw new Error(`Promotion payload opened a different file: ${file.relative}`);
      }
      const bytes = readAllSync(descriptor);
      const after = fs.fstatSync(descriptor, { bigint: true });
      if (!sameStatIdentity(before, after)) {
        throw new Error(`Promotion payload changed while read: ${file.relative}`);
      }
      return { relative: file.relative, bytes };
    } finally {
      if (descriptor !== undefined) fs.closeSync(descriptor);
    }
  });
  if (typeof hooks.afterPayloadTraversal === 'function') {
    hooks.afterPayloadTraversal({ directory, relative });
  }
  const endingManifest = captureManifest();
  const comparable = (value) => ({
    directories: value.directories,
    files: value.files.map(({ relative: fileRelative, identity }) => ({
      relative: fileRelative,
      identity
    }))
  });
  if (canonicalJson(comparable(manifest)) !== canonicalJson(comparable(endingManifest))) {
    throw new Error(`Promotion payload tree changed while it was read: ${relative}`);
  }
  assertPathIdentities(ancestors, 'Promotion payload');
  return sha256(Buffer.concat(files.flatMap((file) => [
    Buffer.from(`${file.relative}\0`),
    file.bytes,
    Buffer.from('\0')
  ])));
}

function derivePromotionEvidence(root, options, closure, state, hooks = {}) {
  const request = readBoundRegularFile(root, closure.request_path, {
    beforeRead: hooks.beforeRequestRead
  });
  const requestBytes = request.bytes;
  if (sha256(requestBytes) !== closure.request_content_sha256 ||
      sha256(canonicalJson(requestDefinition(requestBytes.toString('utf8')))) !==
        closure.ac_definition_sha256 || !completedRequest(requestBytes.toString('utf8'))) {
    throw new Error('Promotion request closure is stale or the request is no longer Completed');
  }
  const row = dispositionEvidenceForUnit(root, options.promotion_unit_id);
  const suppliedRows = Array.isArray(options.disposition_row)
    ? options.disposition_row
    : [options.disposition_row];
  if (suppliedRows.some((item) => !item || typeof item !== 'object' ||
      typeof item.source_name !== 'string') ||
      canonicalJson(normalizedDispositionRows(suppliedRows)) !== canonicalJson(row)) {
    throw new Error('Promotion disposition row does not match current repository disposition');
  }
  if (!isCurrentPass(state, 'review')) {
    throw new Error('Promotion evidence requires a current final review pass');
  }
  const retirement = options.kind === 'retirement';
  if (!retirement && !isCurrentPass(state, 'verify')) {
    throw new Error('Promotion evidence requires a current final verification pass');
  }
  const rows = Array.isArray(row) ? row : [row];
  const promotionRequests = [...new Set(rows.map((item) => item.promotion_request))];
  if (promotionRequests.length !== 1 || typeof promotionRequests[0] !== 'string' ||
      promotionRequests[0] !== closure.request_path) {
    throw new Error('Promotion closure request does not match the unit gate owner');
  }
  const payloadRelative = retirement ? null : promotionPayloadPath(row, options.kind);
  const actualPayloadHash = retirement ? null : hashPayloadTree(root, payloadRelative, hooks);
  if (retirement && (rows.some((item) => item.target_package !== 'retired' ||
      item.delivery_state !== 'retired' || item.disposition !== 'retire' ||
      item.license_status !== 'approved' || item.target_skill !== null ||
      item.routing_owner !== null) || !options.reason ||
      options.payload_tree_sha256 !== null)) {
    throw new Error('Retirement requires retired disposition, approved reason, and null payload');
  }
  if (!retirement && options.payload_tree_sha256 !== actualPayloadHash) {
    throw new Error('Promotion payload tree SHA-256 does not match current payload bytes');
  }
  const finalBinding = { kind: 'worktree', fingerprint: state.worktree.fingerprint };
  const reviewEvidence = gateEvidenceEnvelope(
    finalBinding, state.review_provider, reviewEvidenceFromState(state)
  );
  const verifyEvidence = retirement ? null : gateEvidenceEnvelope(
    finalBinding, state.review_provider, state.gates.verify.evidence
  );
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
    payload_tree_sha256: actualPayloadHash,
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
  return { record, blobs };
}

function recordPromotionEvidence(cwd, options, hooks = {}) {
  const root = findRepoRoot(cwd);
  assertExactKeys(options, [
    'kind', 'promotion_unit_id', 'request_closure_record_sha256',
    'disposition_row', 'payload_tree_sha256', 'reason', 'recorded_at',
    'supersedes_record_sha256'
  ], 'promotion evidence options');
  if (!['promotion', 'pack-ready', 'retirement'].includes(options.kind)) {
    throw new Error(`Unsupported promotion evidence kind: ${options.kind}`);
  }
  const normalizedOptions = {
    ...options,
    recorded_at: options.recorded_at || now()
  };
  auditEvidenceLedger(root);
  const closure = readEvidenceRecord(root,
    normalizedOptions.request_closure_record_sha256).record;
  if (closure.kind !== 'request-closure' ||
      closure.promotion_unit_id !== normalizedOptions.promotion_unit_id) {
    throw new Error('Promotion evidence requires a matching final request closure');
  }
  const latestClosure = latestEvidenceRecord(
    root, 'request-closure', normalizedOptions.promotion_unit_id
  );
  const latestPending = latestEvidenceRecord(
    root, 'request-closure-pending', normalizedOptions.promotion_unit_id
  );
  if (latestClosure?.record_sha256 !== closure.record_sha256 ||
      latestClosure?.pending_record_sha256 !== latestPending?.record_sha256) {
    throw new Error('Promotion request closure is superseded or stale');
  }
  const starting = derivePromotionEvidence(
    root, normalizedOptions, closure, refreshState(root), hooks
  );
  const expectedOldOid = evidenceRefOid(root);
  if (typeof hooks.beforeAppend === 'function') hooks.beforeAppend(starting.record);
  let result;
  let finalRecord;
  withStateLock(root, (state) => {
    const worktree = snapshot(root);
    const startingHead = currentHead(root);
    const startingTree = currentHeadTree(root);
    const provider = reviewProvider(root);
    applySnapshot(state, worktree);
    applyReviewProvider(state, provider);
    if (evidenceRefOid(root) !== expectedOldOid) {
      throw new Error('Evidence ref compare-and-swap expectation is stale');
    }
    const lockedClosure = latestEvidenceRecord(
      root, 'request-closure', normalizedOptions.promotion_unit_id
    );
    const lockedPending = latestEvidenceRecord(
      root, 'request-closure-pending', normalizedOptions.promotion_unit_id
    );
    if (lockedClosure?.record_sha256 !==
          normalizedOptions.request_closure_record_sha256 ||
        lockedClosure?.pending_record_sha256 !== lockedPending?.record_sha256) {
      throw new Error('Promotion request closure became superseded or stale');
    }
    const currentClosure = readEvidenceRecord(
      root, normalizedOptions.request_closure_record_sha256
    ).record;
    const current = derivePromotionEvidence(
      root, normalizedOptions, currentClosure, state, hooks
    );
    if (typeof hooks.beforeFinalSnapshot === 'function') hooks.beforeFinalSnapshot();
    const endingWorktree = snapshot(root);
    if (endingWorktree.fingerprint !== worktree.fingerprint ||
        currentHead(root) !== startingHead || currentHeadTree(root) !== startingTree ||
        canonicalJson(current.record) !== canonicalJson(starting.record) ||
        canonicalJson(current.blobs) !== canonicalJson(starting.blobs)) {
      throw new Error('Promotion evidence inputs drifted before append');
    }
    finalRecord = current.record;
    result = appendEvidenceRevisionUnlocked(root, current.record, current.blobs, {
      expected_old_oid: expectedOldOid
    });
    return state;
  });
  return { ...result, record: finalRecord };
}

const EVIDENCE_RECORD_FIELDS = {
  'request-closure-pending': [
    'schema_version', 'kind', 'promotion_unit_id', 'request_path',
    'prior_request_content_sha256', 'proposed_request_content_sha256',
    'implementation_base_sha', 'ac_definition_sha256',
    'non_request_projection_sha256', 'subject',
    'verify_required',
    'subject_review_evidence_sha256', 'verify_evidence_sha256',
    'ac_evidence_sha256', 'checks_evidence_sha256',
    'proposed_request_blob_sha256', 'recorded_at',
    'supersedes_record_sha256', 'record_sha256'
  ],
  'request-closure': [
    'schema_version', 'kind', 'promotion_unit_id', 'pending_record_sha256',
    'request_path', 'request_content_sha256', 'implementation_base_sha',
    'ac_definition_sha256',
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

function requiredEvidenceBlobs(record) {
  if (record.kind === 'request-closure-pending') return [
    ['ac.json', 'ac_evidence_sha256'],
    ['checks.json', 'checks_evidence_sha256'],
    ['request.json', 'proposed_request_blob_sha256'],
    ['subject-review.json', 'subject_review_evidence_sha256'],
    ['verify.json', 'verify_evidence_sha256']
  ];
  if (record.kind === 'request-closure') {
    return [['docs-review.json', 'docs_review_evidence_sha256']];
  }
  return record.kind === 'retirement'
    ? [['review.json', 'review_evidence_sha256']]
    : [['review.json', 'review_evidence_sha256'], ['verify.json', 'verify_evidence_sha256']];
}

function validateEvidenceRecordShape(record) {
  if (!record || ![
    LEGACY_EVIDENCE_SCHEMA_VERSION, EVIDENCE_SCHEMA_VERSION
  ].includes(record.schema_version) ||
      typeof record.kind !== 'string') {
    throw new Error('Evidence record requires supported schema_version and kind');
  }
  const fields = EVIDENCE_RECORD_FIELDS[record.kind];
  if (!fields) throw new Error(`Unsupported evidence record kind: ${record.kind}`);
  assertExactKeys(record, fields, `${record.kind} evidence record`);
  assertPromotionUnit(record.promotion_unit_id);
  assertRecordedAt(record.recorded_at);
  assertSha256(record.record_sha256, 'record_sha256');
  if (!/^docs\/features\/[A-Za-z0-9._-]+\/requests\/[A-Za-z0-9._-]+\.md$/.test(
    record.request_path || ''
  ) || path.posix.normalize(record.request_path) !== record.request_path ||
      record.request_path.split('/').some((segment) => segment === '.' || segment === '..')) {
    throw new Error('Evidence request_path is invalid or non-canonical');
  }
  if (record.supersedes_record_sha256 !== null) {
    assertSha256(record.supersedes_record_sha256, 'supersedes_record_sha256');
  }
  if (record.kind === 'request-closure-pending') {
    for (const field of [
      'prior_request_content_sha256', 'proposed_request_content_sha256',
      'ac_definition_sha256',
      'subject_review_evidence_sha256', 'verify_evidence_sha256',
      'ac_evidence_sha256', 'checks_evidence_sha256',
      'proposed_request_blob_sha256'
    ]) assertSha256(record[field], field);
    assertFingerprint(record.non_request_projection_sha256,
      'non_request_projection_sha256');
    validateClosureSubjectShape(record.subject);
    if (!/^[a-f0-9]{40}$/.test(record.implementation_base_sha || '')) {
      throw new Error('implementation_base_sha must be one commit OID');
    }
    if (record.subject.kind === 'commit' &&
        record.implementation_base_sha !== record.subject.base_sha) {
      throw new Error('Commit closure subject must match implementation_base_sha');
    }
    if (typeof record.verify_required !== 'boolean') {
      throw new Error('request-closure-pending verify_required must be boolean');
    }
    return;
  }
  if (record.kind === 'request-closure') {
    for (const field of [
      'pending_record_sha256', 'request_content_sha256', 'ac_definition_sha256',
      'subject_review_evidence_sha256', 'docs_review_evidence_sha256',
      'docs_fingerprint'
    ]) assertSha256(record[field], field);
    if (!/^[a-f0-9]{40}$/.test(record.implementation_base_sha || '')) {
      throw new Error('implementation_base_sha must be one commit OID');
    }
    return;
  }
  for (const field of [
    'request_content_sha256', 'ac_definition_sha256',
    'request_closure_record_sha256', 'disposition_row_sha256',
    'final_fingerprint', 'review_evidence_sha256'
  ]) assertSha256(record[field], field);
  if (!/^[a-f0-9]{40}$/.test(record.head_sha || '')) {
    throw new Error('head_sha must be one commit OID');
  }
  if (record.request_status !== 'Completed') {
    throw new Error('completion evidence request_status must be Completed');
  }
  if (record.kind === 'retirement') {
    if (record.payload_tree_sha256 !== null || record.verify_evidence_sha256 !== null ||
        typeof record.reason !== 'string' || !record.reason.trim()) {
      throw new Error('retirement evidence requires null payload/verify and a reason');
    }
  } else {
    assertSha256(record.payload_tree_sha256, 'payload_tree_sha256');
    assertSha256(record.verify_evidence_sha256, 'verify_evidence_sha256');
    if (record.reason !== null) {
      throw new Error(`${record.kind} evidence reason must be null`);
    }
  }
}

function evidenceRecordsAt(root, oid) {
  const paths = String(runEvidenceGit(root, ['ls-tree', '-r', '--name-only', oid]))
    .trim().split('\n').filter((file) => file.startsWith('records/'));
  return paths.map((filePath) => {
    const bytes = evidenceFileBytes(root, oid, filePath);
    const record = JSON.parse(bytes);
    validateEvidenceRecordShape(record);
    if (canonicalJson(record) !== bytes || evidenceRecordHash(record) !== record.record_sha256 ||
        !filePath.endsWith(`/${record.record_sha256}.json`)) {
      throw new Error(`Evidence record is corrupt: ${filePath}`);
    }
    return record;
  });
}

function latestEvidenceRecord(root, kind, promotionUnitId, oid = evidenceRefOid(root)) {
  if (!oid) return null;
  return evidenceRecordsAt(root, oid).filter((record) =>
    record.kind === kind && record.promotion_unit_id === promotionUnitId
  ).sort((left, right) => Date.parse(left.recorded_at) - Date.parse(right.recorded_at)).at(-1) ||
    null;
}

function evidenceFileBytes(root, oid, filePath) {
  return String(runEvidenceGit(root, ['show', `${oid}:${filePath}`]));
}

function validateEvidenceBlobAt(root, oid, record, name, field, paths = null) {
  const blobPath = `evidence/${record.record_sha256}/${name}`;
  if (paths && !paths.includes(blobPath)) {
    throw new Error(`Evidence blob is missing or corrupt: ${blobPath}`);
  }
  let bytes;
  try {
    bytes = evidenceFileBytes(root, oid, blobPath);
  } catch {
    throw new Error(`Evidence blob is missing or corrupt: ${blobPath}`);
  }
  if (sha256(bytes) !== record[field]) {
    throw new Error(`Evidence blob is missing or corrupt: ${blobPath}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(bytes);
  } catch {
    throw new Error(`Evidence blob is missing or corrupt: ${blobPath}`);
  }
  assertExactKeys(parsed, ['redactor_version', 'value'], 'evidence blob envelope');
  if (parsed.redactor_version !== REDACTOR_VERSION || canonicalJson(parsed) !== bytes ||
      canonicalEvidenceBlob(root, parsed.value) !== bytes) {
    throw new Error(`Evidence blob redaction metadata is stale or non-canonical: ${blobPath}`);
  }
  return parsed.value;
}

function auditEvidenceLedger(cwd, expected = {}, hooks = {}) {
  const root = findRepoRoot(cwd);
  const oid = evidenceRefOid(root);
  if (!oid) throw new Error('Evidence ref is missing');
  if (typeof hooks.afterOidCapture === 'function') hooks.afterOidCapture(oid);
  const history = String(runEvidenceGit(root, [
    'rev-list', '--reverse', '--parents', oid
  ])).trim().split('\n').filter(Boolean).map((line) => line.split(' '));
  const seenRecords = new Map();
  const latestRevision = new Map();
  const latestCompletion = new Map();
  for (let index = 0; index < history.length; index += 1) {
    const entry = history[index];
    if (index === 0 && entry.length !== 1) {
      throw new Error('Evidence root commit must have no parent');
    }
    if (index > 0 && (entry.length !== 2 || entry[1] !== history[index - 1][0])) {
      throw new Error('Evidence commit history must be one parent-linked append chain');
    }
    const changes = String(runEvidenceGit(root, [
      'diff-tree', '--root', '--no-commit-id', '--name-status', '-r', entry[0]
    ])).trim().split('\n').filter(Boolean);
    if (changes.length === 0 || changes.some((line) => !line.startsWith('A\t'))) {
      throw new Error('Evidence commits must append files without modifying or deleting history');
    }
    const added = changes.map((line) => line.slice(2));
    const recordPaths = added.filter((file) => file.startsWith('records/'));
    if (recordPaths.length !== 1) {
      throw new Error('Each evidence commit must append exactly one record');
    }
    const match = /^records\/([a-z-]+)\/([a-f0-9]{64})\.json$/.exec(recordPaths[0]);
    if (!match) {
      throw new Error('Evidence commit blobs must belong to its one appended record');
    }
    const appendedRecord = JSON.parse(evidenceFileBytes(root, entry[0], recordPaths[0]));
    validateEvidenceRecordShape(appendedRecord);
    const expectedAdded = [
      `records/${appendedRecord.kind}/${appendedRecord.record_sha256}.json`,
      ...requiredEvidenceBlobs(appendedRecord).map(([name]) =>
        `evidence/${appendedRecord.record_sha256}/${name}`
      )
    ].sort();
    if (match[1] !== appendedRecord.kind || match[2] !== appendedRecord.record_sha256 ||
        JSON.stringify(added.sort()) !== JSON.stringify(expectedAdded)) {
      throw new Error('Evidence commit paths must exactly match its record kind and blobs');
    }
    const recordBytes = evidenceFileBytes(root, entry[0], recordPaths[0]);
    if (canonicalJson(appendedRecord) !== recordBytes ||
        evidenceRecordHash(appendedRecord) !== appendedRecord.record_sha256) {
      throw new Error(`Evidence record is corrupt: ${recordPaths[0]}`);
    }
    const blobValues = {};
    for (const [name, field] of requiredEvidenceBlobs(appendedRecord)) {
      blobValues[name] = validateEvidenceBlobAt(
        root, entry[0], appendedRecord, name, field, added
      );
    }
    validateEvidenceBlobSemantics(appendedRecord, blobValues, root);
    const revisionKey = `${appendedRecord.kind}\0${appendedRecord.promotion_unit_id}`;
    const priorRevision = latestRevision.get(revisionKey) || null;
    if ((appendedRecord.supersedes_record_sha256 || null) !==
        (priorRevision?.record_sha256 || null)) {
      throw new Error(
        'Evidence revision must reference the prior commit-order record for its kind/unit'
      );
    }
    if (priorRevision && Date.parse(appendedRecord.recorded_at) <=
        Date.parse(priorRevision.recorded_at)) {
      throw new Error('Evidence revision timestamps must advance in commit order');
    }
    if (appendedRecord.kind === 'request-closure') {
      const pending = seenRecords.get(appendedRecord.pending_record_sha256);
      const currentPending = latestRevision.get(
        `request-closure-pending\0${appendedRecord.promotion_unit_id}`
      );
      if (!pending || pending.kind !== 'request-closure-pending' ||
          currentPending?.record_sha256 !== pending.record_sha256 ||
          pending.promotion_unit_id !== appendedRecord.promotion_unit_id ||
          pending.proposed_request_content_sha256 !==
            appendedRecord.request_content_sha256 ||
          pending.implementation_base_sha !== appendedRecord.implementation_base_sha ||
          pending.ac_definition_sha256 !== appendedRecord.ac_definition_sha256 ||
          pending.subject_review_evidence_sha256 !==
            appendedRecord.subject_review_evidence_sha256 ||
          appendedRecord.subject_review_evidence_sha256 ===
            appendedRecord.docs_review_evidence_sha256 ||
          Date.parse(appendedRecord.recorded_at) <= Date.parse(pending.recorded_at)) {
        throw new Error(
          'Final closure must follow and exactly match its pending commit-order record'
        );
      }
    }
    if (['promotion', 'pack-ready', 'retirement'].includes(appendedRecord.kind)) {
      const closure = seenRecords.get(appendedRecord.request_closure_record_sha256);
      const currentClosure = latestRevision.get(
        `request-closure\0${appendedRecord.promotion_unit_id}`
      );
      const currentPending = latestRevision.get(
        `request-closure-pending\0${appendedRecord.promotion_unit_id}`
      );
      const priorCompletion = latestCompletion.get(appendedRecord.promotion_unit_id);
      if (!closure || closure.kind !== 'request-closure' ||
          currentClosure?.record_sha256 !== closure.record_sha256 ||
          closure.pending_record_sha256 !== currentPending?.record_sha256 ||
          closure.promotion_unit_id !== appendedRecord.promotion_unit_id ||
          closure.request_content_sha256 !== appendedRecord.request_content_sha256 ||
          closure.ac_definition_sha256 !== appendedRecord.ac_definition_sha256 ||
          Date.parse(appendedRecord.recorded_at) <= Date.parse(closure.recorded_at)) {
        throw new Error(
          'Promotion evidence must follow and match its commit-order closure record'
        );
      }
      if (priorCompletion && Date.parse(appendedRecord.recorded_at) <=
          Date.parse(priorCompletion.recorded_at)) {
        throw new Error(
          'Completion evidence timestamps must advance across commit-order record kinds'
        );
      }
      latestCompletion.set(appendedRecord.promotion_unit_id, appendedRecord);
    }
    if (seenRecords.has(appendedRecord.record_sha256)) {
      throw new Error('Duplicate evidence record hash');
    }
    seenRecords.set(appendedRecord.record_sha256, appendedRecord);
    latestRevision.set(revisionKey, appendedRecord);
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
    validateEvidenceRecordShape(record);
    if (![
      LEGACY_EVIDENCE_SCHEMA_VERSION, EVIDENCE_SCHEMA_VERSION
    ].includes(record.schema_version) ||
        canonicalJson(record) !== bytes || evidenceRecordHash(record) !== record.record_sha256 ||
        !filePath.endsWith(`/${record.record_sha256}.json`)) {
      throw new Error(`Evidence record is corrupt: ${filePath}`);
    }
    if (records.has(record.record_sha256)) throw new Error('Duplicate evidence record hash');
    records.set(record.record_sha256, record);
  }
  const expectedTreePaths = [...records.values()].flatMap((record) => [
    `records/${record.kind}/${record.record_sha256}.json`,
    ...requiredEvidenceBlobs(record).map(([name]) =>
      `evidence/${record.record_sha256}/${name}`
    )
  ]).sort();
  if (JSON.stringify([...paths].sort()) !== JSON.stringify(expectedTreePaths)) {
    throw new Error('Evidence tree contains orphan, extra, or misplaced blobs');
  }
  for (const record of records.values()) {
    const blobValues = {};
    for (const [name, field] of requiredEvidenceBlobs(record)) {
      blobValues[name] = validateEvidenceBlobAt(root, oid, record, name, field, paths);
    }
    validateEvidenceBlobSemantics(record, blobValues, root);
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
          pending.implementation_base_sha !== record.implementation_base_sha ||
          pending.ac_definition_sha256 !== record.ac_definition_sha256 ||
          pending.subject_review_evidence_sha256 !== record.subject_review_evidence_sha256 ||
          record.subject_review_evidence_sha256 === record.docs_review_evidence_sha256) {
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
  const revisions = new Map();
  for (const record of records.values()) {
    const key = `${record.kind}\0${record.promotion_unit_id}`;
    if (!revisions.has(key)) revisions.set(key, []);
    revisions.get(key).push(record);
  }
  for (const values of revisions.values()) {
    values.sort((left, right) => Date.parse(left.recorded_at) - Date.parse(right.recorded_at));
    for (let index = 0; index < values.length; index += 1) {
      const expectedPrior = index === 0 ? null : values[index - 1].record_sha256;
      if (values[index].supersedes_record_sha256 !== expectedPrior) {
        throw new Error('Evidence revision chain must link every matching kind/unit revision');
      }
      if (index > 0 && Date.parse(values[index].recorded_at) <=
          Date.parse(values[index - 1].recorded_at)) {
        throw new Error('Evidence revision timestamps must advance monotonically');
      }
    }
  }
  const selected = expected.promotion_unit_id
    ? [...seenRecords.values()].filter((record) =>
        record.promotion_unit_id === expected.promotion_unit_id &&
        ['promotion', 'pack-ready', 'retirement'].includes(record.kind)
      ).at(-1)
    : null;
  if (expected.promotion_unit_id && !selected) {
    throw new Error(`Evidence has no completion record for ${expected.promotion_unit_id}`);
  }
  if (selected) {
    const currentClosure = latestRevision.get(
      `request-closure\0${selected.promotion_unit_id}`
    );
    const currentPending = latestRevision.get(
      `request-closure-pending\0${selected.promotion_unit_id}`
    );
    if (currentClosure?.record_sha256 !== selected.request_closure_record_sha256 ||
        currentClosure?.pending_record_sha256 !== currentPending?.record_sha256) {
      throw new Error('Selected completion references a superseded request closure');
    }
    for (const [field, value] of Object.entries(expected)) {
      if (field === 'promotion_unit_id') continue;
      if (selected[field] !== value) {
        throw new Error(`Evidence completion mismatch for ${field}`);
      }
    }
    const request = readBoundRegularFile(root, selected.request_path, {
      beforeRead: hooks.beforeRequestRead
    });
    const bytes = request.bytes;
    if (sha256(bytes) !== selected.request_content_sha256 ||
        sha256(canonicalJson(requestDefinition(bytes.toString('utf8')))) !==
          selected.ac_definition_sha256 || !completedRequest(bytes.toString('utf8'))) {
      throw new Error('Current request no longer matches durable completion evidence');
    }
  }
  if (evidenceRefOid(root) !== oid) {
    throw new Error('Evidence ref changed while it was audited');
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
      collaboration_round_id: null,
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
    windowsHide: true,
    env: cleanGitEnvironment()
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

function closureApplyJournalPath(cwd, recordSha) {
  assertSha256(recordSha, 'closure apply journal record hash');
  return resolveRuntimeMetadataPath(cwd, path.join(
    'closure-apply-journals', `${recordSha}.json`
  ));
}

function fsyncDirectory(directory) {
  let descriptor;
  try {
    descriptor = fs.openSync(directory, fs.constants.O_RDONLY);
    fs.fsyncSync(descriptor);
  } catch (error) {
    if (!['EINVAL', 'ENOTSUP', 'EISDIR'].includes(error.code)) throw error;
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
  }
}

function writeAllSync(descriptor, bytes, position = 0, write = fs.writeSync) {
  let offset = 0;
  while (offset < bytes.length) {
    const written = write(descriptor, bytes, offset, bytes.length - offset,
      position + offset);
    if (!Number.isInteger(written) || written <= 0) {
      throw new Error('Descriptor write made no progress');
    }
    offset += written;
  }
}

function readAllSync(descriptor) {
  const stat = fs.fstatSync(descriptor, { bigint: true });
  if (stat.size > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('Descriptor is too large to read safely');
  }
  const bytes = Buffer.alloc(Number(stat.size));
  let offset = 0;
  while (offset < bytes.length) {
    const read = fs.readSync(descriptor, bytes, offset, bytes.length - offset, offset);
    if (!Number.isInteger(read) || read <= 0) {
      throw new Error('Descriptor read ended before its captured size');
    }
    offset += read;
  }
  return bytes;
}

function writeDurableRuntimeMarker(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${process.pid}.${crypto.randomUUID()}.tmp`;
  let descriptor;
  try {
    descriptor = fs.openSync(temporary,
      fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL, 0o600);
    const bytes = Buffer.from(`${JSON.stringify(value)}\n`);
    writeAllSync(descriptor, bytes);
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;
    fs.renameSync(temporary, filePath);
    fsyncDirectory(path.dirname(filePath));
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
    fs.rmSync(temporary, { force: true });
  }
}

function removeDurableRuntimeMarker(filePath) {
  fs.rmSync(filePath, { force: true });
  fsyncDirectory(path.dirname(filePath));
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

function assertCurrentStateShape(value, options = {}) {
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
  if (!(options.allowMissingCollaborationRoundId &&
        value.review_agents.collaboration_round_id === undefined) &&
      value.review_agents.collaboration_round_id !== null &&
      (typeof value.review_agents.collaboration_round_id !== 'string' ||
        !value.review_agents.collaboration_round_id)) {
    throw new Error(
      'runtime state.review_agents.collaboration_round_id must be a string or null'
    );
  }
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

function collaborationRoundId(agentId, prefix) {
  if (typeof agentId !== 'string' || !agentId.startsWith(prefix)) return null;
  const remainder = agentId.slice(prefix.length);
  const separator = remainder.indexOf(':');
  return separator > 0 ? remainder.slice(0, separator) : null;
}

function inferLegacyCollaborationRound(reviewAgents) {
  const started = reviewAgents.started.filter((entry) =>
    typeof entry.agent_id === 'string' && entry.agent_id.startsWith('collaboration:')
  );
  const completed = reviewAgents.completed.filter((entry) =>
    typeof entry.agent_id === 'string' &&
      entry.agent_id.startsWith('collaboration-result:')
  );
  if (started.length === 0 && completed.length === 0) {
    return { present: false, roundId: null };
  }
  const startedRoundIds = started.map((entry) =>
    collaborationRoundId(entry.agent_id, 'collaboration:')
  );
  const completedRoundIds = completed.map((entry) =>
    collaborationRoundId(entry.agent_id, 'collaboration-result:')
  );
  if (startedRoundIds.includes(null) || completedRoundIds.includes(null)) {
    return { present: true, roundId: null };
  }
  const active = new Set(startedRoundIds);
  let roundId = completedRoundIds[completedRoundIds.length - 1];
  if (started.length > 0) roundId = active.size === 1 ? [...active][0] : null;
  return {
    present: true,
    roundId
  };
}

function normalizeState(value) {
  const base = defaultState();
  if (!value || ![1, 2, 3, 4, 5, 6, 7, SCHEMA_VERSION].includes(value.schema_version)) {
    throw new Error('runtime state schema_version is missing or unsupported');
  }
  if (value.schema_version === SCHEMA_VERSION) assertCurrentStateShape(value);
  const invalidatesLegacyEvidence = value.schema_version <= 7;
  const legacyCollaborationRound = value.schema_version === 6
    ? inferLegacyCollaborationRound(value.review_agents)
    : { present: false, roundId: null };
  const invalidatesV6CollaborationEvidence = legacyCollaborationRound.present &&
    legacyCollaborationRound.roundId === null;
  const invalidatesReviewEvidence = invalidatesLegacyEvidence ||
    invalidatesV6CollaborationEvidence;
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
      review: invalidatesReviewEvidence
        ? base.gates.review
        : { ...base.gates.review, ...(value.gates?.review || {}) },
      verify: invalidatesReviewEvidence
        ? base.gates.verify
        : { ...base.gates.verify, ...(value.gates?.verify || {}) }
    },
    review_agents: invalidatesReviewEvidence ? base.review_agents : {
      ...base.review_agents,
      ...(value.review_agents || {}),
      collaboration_round_id: value.schema_version === 6
        ? legacyCollaborationRound.roundId
        : value.review_agents?.collaboration_round_id || null,
      started: !migratingV4State && Array.isArray(value.review_agents?.started)
        ? value.review_agents.started
        : [],
      completed: Array.isArray(value.review_agents?.completed)
        ? value.review_agents.completed
        : []
    },
    external_review: invalidatesReviewEvidence ? base.external_review : {
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
    collaboration_round_id: null,
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
  return [primary, 'sd0x_test_reviewer'];
}

function validateEvidence(gate, status, evidence, provider = DEFAULT_REVIEW_PROVIDER) {
  if (!['pass', 'fail'].includes(status)) {
    throw new Error('Gate status must be pass or fail');
  }
  if (!evidence || typeof evidence !== 'object') {
    throw new Error('Gate evidence must be a JSON object');
  }
  if (gate === 'review' && status === 'pass') {
    if (evidence.reviewers !== 2) {
      throw new Error('A passing review gate requires evidence.reviewers === 2');
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
        evidence.agents.length !== required.length ||
        new Set(evidence.agents).size !== required.length ||
        !required.every((reviewer) => evidence.agents.includes(reviewer))) {
      throw new Error(
        `A passing review gate requires exactly the ${provider} primary and test reviewer evidence`
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

function bindCommitClosureReviewer(cwd, state, entry) {
  const markerPath = commitClosureReviewPath(cwd);
  if (!fs.existsSync(markerPath)) return;
  const marker = readCommitClosureReview(cwd);
  if (!marker || marker.status !== 'pending' ||
      marker.runtime_epoch !== state.runtime_epoch ||
      marker.provider !== state.review_provider ||
      Date.parse(entry.recorded_at) < Date.parse(marker.started_at)) return;
  validateClosureSubject(findRepoRoot(cwd), marker.subject, 'prepare');
  const binding = {
    agent_id: entry.agent_id,
    agent_type: entry.agent_type,
    subject_sha256: marker.subject_sha256,
    started_at: entry.recorded_at
  };
  const existing = marker.reviewer_bindings.findIndex((item) =>
    item.agent_id === binding.agent_id && item.agent_type === binding.agent_type
  );
  if (existing >= 0) marker.reviewer_bindings[existing] = binding;
  else marker.reviewer_bindings.push(binding);
  writeCommitClosureReview(cwd, marker);
}

function normalizeCommitClosureReviewerResult(cwd, result) {
  const markerPath = commitClosureReviewPath(cwd);
  if (!fs.existsSync(markerPath)) return result;
  const marker = readCommitClosureReview(cwd);
  if (!marker || marker.status !== 'pending') return result;
  const terminal = `Commit-Subject-SHA256: ${marker.subject_sha256}`;
  const lines = result.trim().split(/\r?\n/);
  if (lines.at(-1) !== terminal) {
    throw new Error(
      `Commit closure reviewer result must end with exactly: ${terminal}`
    );
  }
  const message = lines.slice(0, -1).join('\n').trim();
  if (!message) throw new Error('Commit closure reviewer result is empty');
  return message;
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
        collaboration_round_id: null,
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
      const rawResult = typeof details.last_assistant_message === 'string'
        ? details.last_assistant_message.trim()
        : '';
      if (!rawResult) return state;
      const result = normalizeCommitClosureReviewerResult(cwd, rawResult);
      state.review_agents.started.splice(startedIndex, 1);
      entry.started_at = started.recorded_at;
      entry.result_sha256 = crypto.createHash('sha256').update(rawResult).digest('hex');
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
    if (phase === 'start') bindCommitClosureReviewer(cwd, state, entry);
    if (phase === 'stop') {
      state.review_agents.started = state.review_agents.started.filter((item) =>
        !(item.agent_type === entry.agent_type &&
          item.agent_id.startsWith('collaboration:'))
      );
    }
    if (phase === 'stop' && entry.outcome === 'findings') {
      blockGatesForFinding(state, worktree, entry.agent_type);
    }
    return state;
  });
}

function collaborationRoundAgentId(roundId, agentType) {
  return `collaboration:${roundId}:${agentType}`;
}

function currentCollaborationRound(reviewAgents) {
  return reviewAgents.collaboration_round_id;
}

function recordCollaborationRoundStart(cwd, details) {
  if (!details || typeof details !== 'object' ||
      typeof details.expected_fingerprint !== 'string' ||
      !['codex', 'claude'].includes(details.expected_provider) ||
      typeof details.expected_runtime_epoch !== 'string' ||
      typeof details.round_id !== 'string' || !details.round_id) {
    throw new Error('Collaboration review round start is malformed');
  }
  return withStateLock(cwd, (state) => {
    const worktree = snapshot(cwd);
    const provider = reviewProvider(cwd);
    if (worktree.fingerprint !== details.expected_fingerprint ||
        provider !== details.expected_provider ||
        state.runtime_epoch !== details.expected_runtime_epoch) {
      throw new Error('Collaboration review round start is stale');
    }
    applySnapshot(state, worktree);
    applyReviewProvider(state, provider);
    if (state.review_agents.fingerprint !== worktree.fingerprint) {
      state.review_agents = {
        fingerprint: worktree.fingerprint,
        collaboration_round_id: null,
        started: [],
        completed: []
      };
    }
    if (state.review_agents.started.some((entry) =>
      entry.agent_id.startsWith('collaboration:')
    )) {
      throw new Error('A collaboration review round is already active');
    }
    state.review_agents.collaboration_round_id = details.round_id;
    for (const agentType of requiredReviewers(provider)) {
      const entry = {
        agent_id: collaborationRoundAgentId(
          details.round_id,
          agentType
        ),
        agent_type: agentType,
        recorded_at: now()
      };
      const existing = state.review_agents.started.findIndex((item) =>
        item.agent_id === entry.agent_id && item.agent_type === entry.agent_type
      );
      if (existing >= 0) state.review_agents.started[existing] = entry;
      else state.review_agents.started.push(entry);
      bindCommitClosureReviewer(cwd, state, entry);
    }
    return state;
  });
}

function recordCollaborationReview(cwd, details) {
  if (!details || typeof details !== 'object' ||
      typeof details.expected_fingerprint !== 'string' ||
      !['codex', 'claude'].includes(details.expected_provider) ||
      typeof details.expected_runtime_epoch !== 'string' ||
      typeof details.expected_round_id !== 'string' || !details.expected_round_id ||
      !(details.expected_commit_subject_sha256 === null ||
        details.expected_commit_subject_sha256 === undefined ||
        /^[a-f0-9]{64}$/.test(details.expected_commit_subject_sha256)) ||
      !(details.expected_commit_attestation_generation === null ||
        details.expected_commit_attestation_generation === undefined ||
        /^[0-9a-f-]{36}$/i.test(details.expected_commit_attestation_generation)) ||
      typeof details.transcript_path !== 'string' ||
      !Array.isArray(details.results)) {
    throw new Error('Collaboration review evidence is malformed');
  }
  const required = requiredReviewers(details.expected_provider);
  if (new Set(details.results.map((entry) => entry?.agent_type)).size !==
        required.length ||
      !required.every((agentType) => details.results.some((entry) =>
        entry?.agent_type === agentType
      ))) {
    throw new Error('Collaboration review evidence is missing a required reviewer');
  }
  for (const result of details.results) {
    if (!result || !required.includes(result.agent_type) ||
        typeof result.agent_id !== 'string' || !result.agent_id ||
        typeof result.result !== 'string' || !result.result.trim() ||
        (details.expected_commit_subject_sha256 &&
          result.commit_subject_sha256 !==
            details.expected_commit_subject_sha256)) {
      throw new Error('Collaboration reviewer result is malformed');
    }
  }

  return withStateLock(cwd, (state) => {
    const worktree = snapshot(cwd);
    const provider = reviewProvider(cwd);
    if (worktree.fingerprint !== details.expected_fingerprint ||
        provider !== details.expected_provider ||
        state.runtime_epoch !== details.expected_runtime_epoch) {
      throw new Error(
        'Collaboration review evidence is stale for the current runtime state'
      );
    }
    if (details.expected_commit_subject_sha256) {
      const identity = commitClosureReviewIdentity(cwd);
      if (identity?.subject_sha256 !== details.expected_commit_subject_sha256 ||
          identity?.generation !== details.expected_commit_attestation_generation) {
        throw new Error('Collaboration review commit attestation generation is stale');
      }
    }
    applySnapshot(state, worktree);
    applyReviewProvider(state, provider);
    if (state.review_agents.fingerprint !== worktree.fingerprint) {
      state.review_agents = {
        fingerprint: worktree.fingerprint,
        collaboration_round_id: null,
        started: [],
        completed: []
      };
    }
    const superseded = currentCollaborationRound(state.review_agents) !==
      details.expected_round_id;
    const roundAgentIds = new Set(required.map((agentType) =>
      collaborationRoundAgentId(
        details.expected_round_id,
        agentType
      )
    ));
    if (!superseded) {
      state.review_agents.started = state.review_agents.started.filter((entry) =>
        !roundAgentIds.has(entry.agent_id)
      );
    }
    for (const result of details.results) {
      const message = result.result.trim();
      const entry = {
        agent_id: `collaboration-result:${details.expected_round_id}:${result.agent_id}`,
        agent_type: result.agent_type,
        recorded_at: now(),
        started_at: typeof result.started_at === 'string' &&
            Number.isFinite(Date.parse(result.started_at))
          ? result.started_at
          : now(),
        result_sha256: sha256(message),
        outcome: /^no actionable findings(?: remain)?\.?$/i.test(message)
          ? 'clean'
          : 'findings',
        has_transcript: true
      };
      if (superseded && entry.outcome === 'clean') continue;
      const existing = state.review_agents.completed.findIndex((item) =>
        item.agent_id === entry.agent_id &&
        item.agent_type === entry.agent_type &&
        item.result_sha256 === entry.result_sha256
      );
      if (existing >= 0) state.review_agents.completed[existing] = entry;
      else state.review_agents.completed.push(entry);
      if (entry.outcome === 'findings') {
        blockGatesForFinding(state, worktree, entry.agent_type);
      }
    }
    return state;
  });
}

function recordCollaborationFailure(cwd, details, evidence) {
  if (!details || typeof details !== 'object' ||
      typeof details.expected_fingerprint !== 'string' ||
      !['codex', 'claude'].includes(details.expected_provider) ||
      typeof details.expected_runtime_epoch !== 'string' ||
      typeof details.expected_round_id !== 'string' ||
      !details.expected_round_id) {
    throw new Error('Collaboration failure identity is malformed');
  }
  validateEvidence('review', 'fail', evidence, details.expected_provider);
  let recorded = false;
  let reason = 'identity-changed';
  const state = withStateLock(cwd, (current) => {
    const worktree = snapshot(cwd);
    const provider = reviewProvider(cwd);
    if (current.runtime_epoch !== details.expected_runtime_epoch ||
        worktree.fingerprint !== details.expected_fingerprint ||
        provider !== details.expected_provider) {
      applySnapshot(current, worktree);
      applyReviewProvider(current, provider);
      return current;
    }
    if (currentCollaborationRound(current.review_agents) !==
        details.expected_round_id) {
      reason = 'round-superseded';
      return current;
    }
    if (typeof details.before_record === 'function') details.before_record();
    const finalWorktree = snapshot(cwd);
    const finalProvider = reviewProvider(cwd);
    if (current.runtime_epoch !== details.expected_runtime_epoch ||
        finalWorktree.fingerprint !== details.expected_fingerprint ||
        finalProvider !== details.expected_provider) {
      applySnapshot(current, finalWorktree);
      applyReviewProvider(current, finalProvider);
      return current;
    }
    if (currentCollaborationRound(current.review_agents) !==
        details.expected_round_id) {
      reason = 'round-superseded';
      return current;
    }
    applySnapshot(current, worktree);
    applyReviewProvider(current, provider);
    current.gates.review = {
      status: 'fail',
      fingerprint: worktree.fingerprint,
      evidence,
      updated_at: now()
    };
    current.gates.verify = defaultGate();
    recorded = true;
    reason = null;
    return current;
  });
  return { recorded, reason, state };
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
  const current = value.status === 'pass' &&
    value.fingerprint === state.worktree.fingerprint;
  if (!current) return false;
  if (gate === 'review') return !hasOutstandingReviewers(state);
  if (gate === 'verify') return isCurrentPass(state, 'review');
  return true;
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
    const written = writeState(cwd, reset);
    return written;
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
  attestCommitClosureReview,
  auditEvidenceLedger,
  appendEvidenceRevision,
  applyRequestClosure,
  applySnapshot,
  beginCommitClosureReview,
  claimSetupDeferral,
  clearSetupDeferral,
  clearSessionActivationFailure,
  commitClosureReviewerContext,
  commitClosureReviewIdentity,
  evidenceRefOid,
  consumeSetupDeferral,
  defaultState,
  discardExternalReviewStart,
  hasSetupDeferral,
  hasSessionActivationFailure,
  hashPayloadTree,
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
  recordCollaborationFailure,
  recordCollaborationReview,
  recordCollaborationRoundStart,
  recordPromotionEvidence,
  recoverRequestClosure,
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
