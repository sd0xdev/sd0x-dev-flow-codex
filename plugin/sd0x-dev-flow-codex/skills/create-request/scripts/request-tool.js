'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const nodeProcess = require('node:process');
const { execFileSync } = require('node:child_process');

const SLUG_RE = new RegExp('^[a-z0-9][a-z0-9._-]*$', 'i');
const LINE_SPLIT_RE = new RegExp('\\r?\\n');
const SECTION_HEADING_RE = new RegExp('^##\\s+');
const EDGE_BACKTICK_RE = new RegExp('^\\x60|\\x60$', 'g');
const FEATURE_PATH_RE = new RegExp('^docs\\/features\\/([^/]+)$');
const LIFECYCLE_PATH_RE = new RegExp(
  '^docs\\/features\\/([^/]+)\\/(?:1-requirements|2-tech-spec)\\.md$'
);
const REQUEST_PATH_RE = new RegExp('^docs\\/features\\/([^/]+)\\/requests\\/[^/]+\\.md$');
const METADATA_LINK_RE = new RegExp('^\\[[^\\]]+\\]\\((\\.\\/[^)]+\\.md)\\)$');
const ACCEPTANCE_HEADING_RE = new RegExp('^## Acceptance Criteria\\s*$', 'm');
const NEXT_HEADING_RE = new RegExp('^##\\s+', 'm');
const ACCEPTANCE_ITEM_RE = new RegExp('^\\s*- \\[([ xX])\\]\\s+', 'gm');
const DATE_RE = new RegExp('^(\\d{4})-(\\d{2})-(\\d{2})$');
const COMMIT_RE = new RegExp('^[0-9a-f]{40}$', 'i');
const TITLE_RE = new RegExp('^#\\s+(.+)$', 'm');
const FILE_DATE_RE = new RegExp('^(\\d{4}-\\d{2}-\\d{2})-');
const CHANGED_FEATURE_RE = new RegExp('^docs\\/features\\/([^/]+)\\/');
const BRANCH_FEATURE_RE = new RegExp('^(?:feat|feature|fix|docs)\\/([^/]+)(?:\\/.*)?$');
const MILLISECONDS_TO_DAYS = 1.1574074074074074e-8;
const DONE = new Set(Array.of('completed', 'done', 'superseded'));
const STATUS_ORDER = new Map(Array.of(
  Array.of('in progress', 0),
  Array.of('in development', 0),
  Array.of('in dev', 0),
  Array.of('candidate complete', 1),
  Array.of('pending', 2),
  Array.of('unknown', 2),
  Array.of('design', 3),
  Array.of('proposed', 3)
));
const PRIORITY_ORDER = new Map(Array.of(
  Array.of('P0', 0), Array.of('P1', 1), Array.of('P2', 2)
));
const CANDIDATE_INVALID_ERRORS = new Set(Array.of(
  'missing-acceptance-criteria',
  'incomplete-acceptance-criteria'
));
const VALID_STATUSES = new Set(Array.of(
  'completed',
  'done',
  'superseded',
  'in progress',
  'in development',
  'in dev',
  'candidate complete',
  'pending',
  'design',
  'proposed'
));
const CLEAN_GIT_ENV = Object.freeze({ GIT_CONFIG_GLOBAL: os.devNull, GIT_CONFIG_NOSYSTEM: '1', GIT_NO_REPLACE_OBJECTS: '1', PATH: nodeProcess.env.PATH });

function repositoryRoot(cwd) {
  let output = '';
  try {
    output = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: cwd, encoding: 'utf8', env: CLEAN_GIT_ENV, stdio: ['ignore', 'pipe', 'pipe'] });
    return fs.realpathSync(output.trim());
  } catch {
    throw new Error('create-request requires a Git repository');
  }
}

function toPosix(value) {
  return value.split(path.sep).join('/');
}

function isInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative));
}

function containedPath(root, relativePath) {
  root = fs.realpathSync(root);
  if (typeof relativePath !== 'string' || relativePath.length === 0 || path.isAbsolute(relativePath)) {
    throw new Error('path must be a non-empty repository-relative path');
  }
  const normalized = toPosix(path.posix.normalize(relativePath.replaceAll('\\', '/')));
  if (normalized !== relativePath.replaceAll('\\', '/') || normalized === '..' || normalized.startsWith('../')) {
    throw new Error('path is not canonical or escapes the repository: ' + relativePath);
  }
  let lexicalProbe = root;
  for (const segment of normalized.split('/')) {
    lexicalProbe = path.join(lexicalProbe, segment);
    let stats;
    try {
      stats = fs.lstatSync(lexicalProbe);
    } catch (error) {
      if (error.code === 'ENOENT') break;
      throw error;
    }
    if (stats.isSymbolicLink()) {
      throw new Error('path contains a symlink and is not a trusted request path: ' + relativePath);
    }
  }
  const absolute = path.resolve(root, ...normalized.split('/'));
  let probe = absolute;
  while (!fs.existsSync(probe)) {
    const parent = path.dirname(probe);
    if (parent === probe) break;
    probe = parent;
  }
  let realProbe = '';
  realProbe = fs.realpathSync(probe);
  if (!isInside(root, realProbe)) {
    throw new Error('path escapes the repository through a symlink: ' + relativePath);
  }
  if (fs.existsSync(absolute) && !isInside(root, fs.realpathSync(absolute))) {
    throw new Error('path escapes the repository through a symlink: ' + relativePath);
  }
  return { absolute, relative: normalized, exists: fs.existsSync(absolute) };
}

function parseExplicitPath(root, explicitPath) {
  const raw = explicitPath.replaceAll('\\', '/');
  if (raw.endsWith('//')) throw new Error('path is not canonical: ' + explicitPath);
  const candidate = raw.endsWith('/') ? raw.slice(0, -1) : raw;
  const checked = containedPath(root, candidate);
  const featureMatch = checked.relative.match(FEATURE_PATH_RE);
  const lifecycleMatch = checked.relative.match(LIFECYCLE_PATH_RE);
  const requestMatch = checked.relative.match(REQUEST_PATH_RE);
  const match = featureMatch || lifecycleMatch || requestMatch;
  if (!match || !SLUG_RE.test(match.at(1))) {
    throw new Error(
      'path must be a feature directory, one canonical lifecycle Markdown file, or one request Markdown file'
    );
  }
  if (raw.endsWith('/') && !featureMatch) {
    throw new Error('only a feature directory path may end with a slash');
  }
  return { ...checked, key: match.at(1) };
}

function markdownField(content, field) {
  const lines = content.split(LINE_SPLIT_RE);
  const firstSection = lines.findIndex((line) => SECTION_HEADING_RE.test(line));
  const metadataLines = lines.slice(0, firstSection === -1 ? lines.length : firstSection);
  const firstLines = metadataLines.slice(0, 20);
  const quoted = new RegExp('^>\\s*\\*\\*' + field + '\\*\\*:\\s*(.+?)\\s*$', 'i');
  const table = new RegExp('^\\|\\s*' + field + '\\s*\\|\\s*\\*{0,2}([^|*]+?)\\*{0,2}\\s*\\|\\s*$', 'i');
  for (const line of firstLines) {
    const match = line.match(quoted);
    if (match) return match.at(1).trim().replace(EDGE_BACKTICK_RE, '');
  }
  for (const line of firstLines.slice(0, 15)) {
    const match = line.match(table);
    if (match) return match.at(1).trim().replace(EDGE_BACKTICK_RE, '');
  }
  return null;
}

function metadataLink(content, field, errorName) {
  const raw = markdownField(content, field);
  if (!raw) return { raw: null, target: null, error: null };
  const match = raw.match(METADATA_LINK_RE);
  return {
    raw,
    target: match?.at(1) || null,
    error: match ? null : errorName
  };
}

function acceptanceCounts(content) {
  const heading = content.match(ACCEPTANCE_HEADING_RE);
  if (!heading) return { checked: 0, total: 0 };
  const remainder = content.slice(heading.index + heading.at(0).length);
  const nextHeading = remainder.search(NEXT_HEADING_RE);
  const section = nextHeading === -1 ? remainder : remainder.slice(0, nextHeading);
  const items = Array.from(section.matchAll(ACCEPTANCE_ITEM_RE));
  return {
    checked: items.filter((item) => item.at(1).toLowerCase() === 'x').length,
    total: items.length
  };
}

function validDate(value) {
  const match = value?.match(DATE_RE);
  if (!match) return false;
  const timestamp = Date.UTC(Number(match.at(1)), Number(match.at(2)) - 1, Number(match.at(3)));
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
}

function implementationBaseError(root, value) {
  if (!COMMIT_RE.test(value)) return 'invalid-implementation-base';
  value = value.toLowerCase();
  let objectType = '';
  try {
    objectType = execFileSync('git', ['cat-file', '--batch-check=%(objecttype)'], { cwd: root, encoding: 'utf8', input: value, env: CLEAN_GIT_ENV, stdio: ['pipe', 'pipe', 'pipe'] });
  } catch {
    return 'missing-implementation-base-commit';
  }
  objectType = objectType.trim();
  if (objectType === value + ' missing') return 'missing-implementation-base-commit';
  if (objectType !== 'commit') return 'implementation-base-not-commit';
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', value, 'HEAD'], { cwd: root, encoding: 'utf8', env: CLEAN_GIT_ENV, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch {
    return 'implementation-base-not-ancestor';
  }
  return null;
}

function parseRequest(filePath, root, today = new Date(), baseErrors = new Map()) {
  let content = '';
  content = fs.readFileSync(filePath, 'utf8');
  const relative = toPosix(path.relative(root, filePath));
  const title = content.match(TITLE_RE)?.at(1).trim() || path.basename(filePath, '.md');
  const status = markdownField(content, 'Status') || 'unknown';
  const priority = (markdownField(content, 'Priority') || '--').toUpperCase();
  const implementationBase = markdownField(content, 'Implementation Base SHA');
  const fileDate = path.basename(filePath).match(FILE_DATE_RE)?.at(1) || null;
  const created = markdownField(content, 'Created') || fileDate;
  const counts = acceptanceCounts(content);
  const supersededBy = metadataLink(content, 'Superseded By', 'invalid-superseded-by');
  const supersedes = metadataLink(content, 'Supersedes', 'invalid-supersedes');
  const errors = Array.of();
  if (status === 'unknown') errors.push('missing-status');
  else if (!VALID_STATUSES.has(status.toLowerCase())) errors.push('invalid-status');
  if (!created) errors.push('missing-created-date');
  else if (!validDate(created)) errors.push('invalid-created-date');
  if (priority !== '--' && !PRIORITY_ORDER.has(priority)) errors.push('invalid-priority');
  if (counts.total === 0) errors.push('missing-acceptance-criteria');
  if (Array.of('completed', 'done').includes(status.toLowerCase())) {
    if (!implementationBase) errors.push('missing-implementation-base');
    else {
      if (!baseErrors.has(implementationBase)) {
        baseErrors.set(implementationBase, implementationBaseError(root, implementationBase));
      }
      const baseError = baseErrors.get(implementationBase);
      if (baseError) errors.push(baseError);
    }
    if (counts.total > 0 && counts.checked !== counts.total) {
      errors.push('incomplete-acceptance-criteria');
    }
  }
  if (status.toLowerCase() === 'candidate complete' &&
      counts.total > 0 && counts.checked !== counts.total) {
    errors.push('incomplete-acceptance-criteria');
  }
  if (supersededBy.error) errors.push(supersededBy.error);
  if (supersedes.error) errors.push(supersedes.error);
  if (status.toLowerCase() === 'superseded' && !supersededBy.raw) {
    errors.push('missing-superseded-by');
  }
  let ageDays = null;
  if (validDate(created)) {
    const timestamp = Date.parse(created + 'T00:00:00Z');
    if (Number.isFinite(timestamp)) {
      ageDays = Math.max(0, Math.floor((today.getTime() - timestamp) * MILLISECONDS_TO_DAYS));
    }
  }
  const result = {
    title,
    feature: relative.split('/').at(2) || null,
    status,
    priority,
    created,
    checked: counts.checked,
    total: counts.total,
    stale: status.toLowerCase() === 'pending' && ageDays !== null && ageDays > 30,
    age_days: ageDays,
    path: relative,
    parse_errors: errors
  };
  Object.defineProperty(result, '_supersession', {
    enumerable: false,
    value: { supersededBy, supersedes }
  });
  return result;
}

function addParseError(request, error) {
  if (!request.parse_errors.includes(error)) request.parse_errors.push(error);
}

function siblingLinkPath(request, target) {
  if (!target) return null;
  const directory = path.posix.dirname(request.path);
  const resolved = path.posix.normalize(path.posix.join(directory, target));
  return path.posix.dirname(resolved) === directory ? resolved : null;
}

function validateSupersessions(requests) {
  const byPath = new Map(requests.map((request) => Array.of(request.path, request)));
  const replacementEdges = new Map();
  for (const request of requests) {
    const links = request._supersession;
    if (request.status.toLowerCase() === 'superseded' && links.supersededBy.target) {
      const replacementPath = siblingLinkPath(request, links.supersededBy.target);
      if (!replacementPath) {
        addParseError(request, 'invalid-superseded-by');
      } else if (replacementPath === request.path) {
        addParseError(request, 'self-supersession');
      } else {
        replacementEdges.set(request.path, replacementPath);
        const replacement = byPath.get(replacementPath);
        if (!replacement) {
          addParseError(request, 'broken-superseded-by');
        } else if (siblingLinkPath(replacement, replacement._supersession.supersedes.target) !== request.path) {
          addParseError(request, 'missing-reciprocal-supersedes');
        }
      }
    }
    if (links.supersedes.target) {
      const previousPath = siblingLinkPath(request, links.supersedes.target);
      if (!previousPath) {
        addParseError(request, 'invalid-supersedes');
      } else if (previousPath === request.path) {
        addParseError(request, 'self-supersession');
      } else {
        const previous = byPath.get(previousPath);
        if (!previous) {
          addParseError(request, 'broken-supersedes');
        } else if (siblingLinkPath(previous, previous._supersession.supersededBy.target) !== request.path) {
          addParseError(request, 'missing-reciprocal-superseded-by');
        }
      }
    }
  }
  const states = new Map();
  const stack = Array.of();
  function visit(requestPath) {
    states.set(requestPath, 1);
    stack.push(requestPath);
    const replacementPath = replacementEdges.get(requestPath);
    if (replacementPath && replacementEdges.has(replacementPath)) {
      if (!states.has(replacementPath)) {
        visit(replacementPath);
      } else if (states.get(replacementPath) === 1) {
        const cycleStart = stack.indexOf(replacementPath);
        for (const cyclePath of stack.slice(cycleStart)) {
          addParseError(byPath.get(cyclePath), 'cyclic-supersession');
        }
      }
    }
    stack.pop();
    states.set(requestPath, 2);
  }
  for (const requestPath of replacementEdges.keys()) {
    if (!states.has(requestPath)) visit(requestPath);
  }
  return requests;
}

function parseRequestFiles(files, root, today, baseErrors = new Map()) {
  return validateSupersessions(files.map((file) => parseRequest(file, root, today, baseErrors)));
}

function chooseCanonical(featureDir, prefix, exactName, root) {
  if (!fs.existsSync(featureDir)) return null;
  let candidates = Array.of();
  candidates = fs.readdirSync(featureDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.startsWith(prefix) && entry.name.endsWith('.md'))
    .map((entry) => entry.name)
    .sort();
  if (candidates.includes(exactName)) return toPosix(path.relative(root, path.join(featureDir, exactName)));
  return candidates.length === 1
    ? toPosix(path.relative(root, path.join(featureDir, candidates.at(0))))
    : null;
}

function markdownFiles(root, relativeDirectory) {
  const directory = containedPath(root, relativeDirectory);
  if (!directory.exists || !fs.statSync(directory.absolute).isDirectory()) return Array.of();
  const files = Array.of();
  for (const entry of fs.readdirSync(directory.absolute, { withFileTypes: true })) {
    if (!entry.name.endsWith('.md')) continue;
    const relative = directory.relative + '/' + entry.name;
    const checked = containedPath(root, relative);
    if (checked.exists && fs.statSync(checked.absolute).isFile()) files.push(checked.absolute);
  }
  return files.sort();
}

function requestFiles(featureDir, root) {
  const featureRelative = toPosix(path.relative(root, featureDir));
  return markdownFiles(root, featureRelative + '/requests');
}

function inspectFeature(root, key, source, confidence, targetExists) {
  const relativeDir = 'docs/features/' + key;
  const checked = containedPath(root, relativeDir);
  const requests = checked.exists ? parseRequestFiles(requestFiles(checked.absolute, root), root) : [];
  return {
    key,
    source,
    confidence,
    docs_path: relativeDir,
    exists: targetExists === undefined ? checked.exists : targetExists,
    canonical_docs: {
      requirements: chooseCanonical(checked.absolute, '1-requirements', '1-requirements.md', root),
      tech_spec: chooseCanonical(checked.absolute, '2-tech-spec', '2-tech-spec.md', root)
    },
    active_requests: requests.filter((request) =>
      request.parse_errors.length > 0 || !DONE.has(request.status.toLowerCase()))
  };
}

function nullResolution() {
  return {
    key: null,
    source: 'none',
    confidence: null,
    docs_path: null,
    exists: false,
    canonical_docs: { requirements: null, tech_spec: null },
    active_requests: Array.of()
  };
}

function changedFeatureKeys(root) {
  const outputs = Array.of();
  let tracked = '';
  try {
    tracked = execFileSync('git', ['diff', '--name-only', 'HEAD', '--'], { cwd: root, encoding: 'utf8', env: CLEAN_GIT_ENV, stdio: ['ignore', 'pipe', 'pipe'] });
    outputs.push(...tracked.split(LINE_SPLIT_RE).filter(Boolean));
  } catch { /* An unborn branch may not have HEAD. */ }
  let untracked = '';
  try {
    untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8', env: CLEAN_GIT_ENV, stdio: ['ignore', 'pipe', 'pipe'] });
    outputs.push(...untracked.split(LINE_SPLIT_RE).filter(Boolean));
  } catch { /* Resolution remains conservative when Git cannot enumerate files. */ }
  return Array.from(new Set(outputs.map((file) => file.match(CHANGED_FEATURE_RE)?.at(1))
    .filter((key) => key && SLUG_RE.test(key))));
}

function featureDirectories(root) {
  const base = containedPath(root, 'docs/features');
  if (!base.exists || !fs.statSync(base.absolute).isDirectory()) return Array.of();
  let entries = Array.of();
  entries = fs.readdirSync(base.absolute, { withFileTypes: true });
  for (const entry of entries) {
    if (SLUG_RE.test(entry.name) && entry.isSymbolicLink()) {
      throw new Error('feature directory is a symlink and cannot be scanned: ' + entry.name);
    }
  }
  return entries.filter((entry) => entry.isDirectory() && SLUG_RE.test(entry.name))
    .map((entry) => entry.name)
    .sort();
}

function resolveFeature(root, options = {}) {
  root = fs.realpathSync(root);
  const explicitKey = options.feature || null;
  if (explicitKey && !SLUG_RE.test(explicitKey)) throw new Error('invalid feature key: ' + explicitKey);
  if (options.path) {
    const parsed = parseExplicitPath(root, options.path);
    if (explicitKey && explicitKey !== parsed.key) {
      throw new Error('feature key ' + explicitKey + ' does not match path feature ' + parsed.key);
    }
    return inspectFeature(root, parsed.key, 'explicit-path', 'high', parsed.exists);
  }
  if (explicitKey) return inspectFeature(root, explicitKey, 'explicit-key', 'high');
  let branch = '';
  try {
    branch = execFileSync('git', ['branch', '--show-current'], { cwd: root, encoding: 'utf8', env: CLEAN_GIT_ENV, stdio: ['ignore', 'pipe', 'pipe'] });
    branch = branch.trim();
  } catch { /* no branch */ }
  const branchMatch = branch.match(BRANCH_FEATURE_RE);
  if (branchMatch && SLUG_RE.test(branchMatch.at(1)) &&
      featureDirectories(root).includes(branchMatch.at(1))) {
    return inspectFeature(root, branchMatch.at(1), 'branch', 'high');
  }
  const changed = changedFeatureKeys(root);
  if (changed.length === 1) return inspectFeature(root, changed.at(0), 'changed-paths', 'medium');
  const directories = featureDirectories(root);
  if (directories.length === 1) return inspectFeature(root, directories.at(0), 'single-feature', 'low');
  return nullResolution();
}

function compareRequests(a, b) {
  const aRawStatus = a.status.toLowerCase();
  const bRawStatus = b.status.toLowerCase();
  const aInvalidCompletion = (DONE.has(aRawStatus) && a.parse_errors.length > 0) ||
    (aRawStatus === 'candidate complete' && a.parse_errors.some((error) => CANDIDATE_INVALID_ERRORS.has(error)));
  const bInvalidCompletion = (DONE.has(bRawStatus) && b.parse_errors.length > 0) ||
    (bRawStatus === 'candidate complete' && b.parse_errors.some((error) => CANDIDATE_INVALID_ERRORS.has(error)));
  const aStatus = VALID_STATUSES.has(aRawStatus) && !aInvalidCompletion
    ? aRawStatus
    : 'unknown';
  const bStatus = VALID_STATUSES.has(bRawStatus) && !bInvalidCompletion
    ? bRawStatus
    : 'unknown';
  const status = (STATUS_ORDER.get(aStatus) ?? 4) - (STATUS_ORDER.get(bStatus) ?? 4);
  if (status !== 0) return status;
  const priority = (PRIORITY_ORDER.get(a.priority) ?? 3) - (PRIORITY_ORDER.get(b.priority) ?? 3);
  if (priority !== 0) return priority;
  return (a.created || '9999-99-99').localeCompare(b.created || '9999-99-99') || a.path.localeCompare(b.path);
}

function scanRequests(root, options = {}) {
  root = fs.realpathSync(root);
  if (options.today && !validDate(options.today)) {
    throw new Error('invalid --today date: ' + options.today);
  }
  const today = options.today ? new Date(options.today + 'T00:00:00Z') : new Date();
  const requests = Array.of();
  const baseErrors = new Map();
  let archived = 0;
  for (const key of featureDirectories(root)) {
    const featureDir = path.join(root, 'docs', 'features', key);
    requests.push(...parseRequestFiles(requestFiles(featureDir, root), root, today, baseErrors));
    archived += markdownFiles(root, 'docs/features/' + key + '/requests/archived').length;
  }
  const active = requests.filter((request) =>
    request.parse_errors.length > 0 || !DONE.has(request.status.toLowerCase())).sort(compareRequests);
  return {
    total: requests.length,
    incomplete: active.length,
    archived_excluded: archived,
    requests: active
  };
}

function argument(args, name) {
  const index = args.indexOf(name);
  if (index === -1) return null;
  if (index + 1 >= args.length || args.at(index + 1).startsWith('--')) {
    throw new Error(name + ' requires a value');
  }
  return args.at(index + 1);
}

function main(argv = process.argv.slice(2), cwd = process.cwd()) {
  const command = argv.at(0);
  if (!Array.of('resolve', 'scan').includes(command)) {
    throw new Error('usage: request-tool.js resolve [--feature <key>] [--path <path>] | scan [--today YYYY-MM-DD]');
  }
  const root = repositoryRoot(cwd);
  const known = command === 'resolve'
    ? new Set(Array.of('--feature', '--path'))
    : new Set(Array.of('--today'));
  for (let index = 1; index < argv.length; index += 2) {
    if (!known.has(argv.at(index))) throw new Error('unknown argument: ' + argv.at(index));
    if (index + 1 >= argv.length) throw new Error(argv.at(index) + ' requires a value');
  }
  const result = command === 'resolve'
    ? resolveFeature(root, { feature: argument(argv, '--feature'), path: argument(argv, '--path') })
    : scanRequests(root, { today: argument(argv, '--today') });
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  return result;
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write('create-request: ' + error.message + '\n');
    process.exitCode = 1;
  }
}

module.exports = {
  acceptanceCounts,
  containedPath,
  parseRequest,
  resolveFeature,
  scanRequests
};
