'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { scanFeatureDocs, emptySourceSets } = require('./doc-classifier');
const { CONTRACT_ROLES } = require('./doc-metadata');

function emptyDocs() {
  return { doc_inventory: [], ...emptySourceSets(), scan_error: false,
    canonical_ambiguities: { requirements: [], tech_spec: [] },
    intent: { path: null, exists: false, strays: [] } };
}

function selectCanonical(items, type, exact) {
  const candidates = items.filter(item => item.type === type);
  const root = candidates.find(item => item.file === exact);
  if (root) return { selected: root.file, ambiguous: [] };
  const split = candidates.filter(item => item.file === `${exact.slice(0, -3)}/${exact}`);
  const pool = split.length ? split : candidates.filter(item => !item.file.includes('/') && item.file.startsWith(exact.slice(0, -3)));
  return { selected: pool.length === 1 ? pool[0].file : null,
    ambiguous: pool.length > 1 ? pool.map(item => item.file).sort() : [] };
}

function scan(root, key) {
  const relative = `docs/features/${key}`;
  const directory = path.join(root, relative);
  const scanned = scanFeatureDocs(directory);
  for (const set of ['doc_inventory', ...Object.keys(emptySourceSets())]) {
    scanned[set] = scanned[set].map(item => ({ ...item, file: item.file.replaceAll('\\', '/') }));
  }
  const result = { ...emptyDocs(), ...scanned, canonical_docs: {} };
  for (const [name, type, exact] of [
    ['requirements', 'requirements', '1-requirements.md'],
    ['tech_spec', 'tech-spec', '2-tech-spec.md']
  ]) {
    const selected = selectCanonical(scanned.doc_inventory, type, exact);
    result.canonical_docs[name] = selected.selected ? `${relative}/${selected.selected}` : null;
    result.canonical_ambiguities[name] = selected.ambiguous.map(file => `${relative}/${file}`);
  }
  const intentName = `intent-${key}.md`;
  result.intent = { path: `${relative}/${intentName}`,
    exists: scanned.doc_inventory.some(item => item.file === intentName),
    strays: scanned.doc_inventory.filter(item => /^intent-[^/]+\.md$/.test(item.file) && item.file !== intentName)
      .map(item => `${relative}/${item.file}`).sort() };
  for (const set of ['doc_inventory', ...Object.keys(emptySourceSets())]) {
    result[set] = scanned[set].map(item => ({ ...item, file: `${relative}/${item.file}` }))
      .sort((a, b) => a.file < b.file ? -1 : a.file > b.file ? 1 : 0);
  }
  return result;
}

function isContextShape(value) {
  const object = input => input !== null && typeof input === 'object' && !Array.isArray(input);
  const nullable = input => input === null || typeof input === 'string';
  const entry = input => object(input) && typeof input.file === 'string' && input.file.trim() &&
    typeof input.type === 'string' && CONTRACT_ROLES.includes(input.role);
  return Boolean(object(value) && typeof value.scan_error === 'boolean' &&
    ['key', 'confidence', 'docs_path'].every(key => key in value && nullable(value[key])) &&
    typeof value.source === 'string' && typeof value.exists === 'boolean' &&
    ['doc_inventory', ...Object.keys(emptySourceSets())].every(key => Array.isArray(value[key]) && value[key].every(entry)) &&
    object(value.canonical_docs) && ['requirements', 'tech_spec'].every(key => key in value.canonical_docs && nullable(value.canonical_docs[key])) &&
    object(value.canonical_ambiguities) && ['requirements', 'tech_spec'].every(key => Array.isArray(value.canonical_ambiguities[key]) && value.canonical_ambiguities[key].every(item => typeof item === 'string')) &&
    Array.isArray(value.active_requests) && object(value.intent) && nullable(value.intent.path) &&
    typeof value.intent.exists === 'boolean' && Array.isArray(value.intent.strays) && value.intent.strays.every(item => typeof item === 'string'));
}

function readIntent(root, context) {
  if (!isContextShape(context) || context.scan_error) throw new Error('Incomplete feature context');
  if (!context.intent.exists) return { exists: false, path: context.intent.path, strays: context.intent.strays };
  const expected = `docs/features/${context.key}/intent-${context.key}.md`;
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(context.key) || context.intent.path !== expected) throw new Error('Intent key/path mismatch');
  const { containedPath } = require('../../skills/create-request/scripts/request-tool');
  const checked = containedPath(fs.realpathSync(root), expected);
  const stat = fs.lstatSync(checked.absolute);
  if (!stat.isFile() || !(stat.mode & 0o444)) throw new Error('Intent is not readable');
  const text = fs.readFileSync(checked.absolute, 'utf8');
  const lines = text.replace(/\r\n?/g, '\n').trimEnd().split('\n').length;
  const invariants = [...new Set(text.match(/\bINV-\d{3}\b/g) || [])];
  return { exists: true, path: expected, text, lines, invariants,
    valid: lines <= 60 && invariants.length >= 3 && invariants.length <= 7 &&
      /north star/i.test(text) && /non-goals/i.test(text) && /acceptance sketch/i.test(text) };
}

function createIntent(root, options) {
  const resolver = require('../../skills/create-request/scripts/request-tool');
  const context = resolver.resolveFeature(root, { feature: options?.feature });
  if (!context.key || typeof options?.text !== 'string') throw new Error('Intent requires resolved feature and accepted planning text');
  const checked = resolver.containedPath(fs.realpathSync(root), context.intent.path);
  if (checked.exists) return { status: 'preserved', path: checked.relative };
  const text = options.text.replace(/\r\n?/g, '\n').trimEnd() + '\n';
  const ids = text.match(/\bINV-\d{3}\b/g) || [];
  if (text.trimEnd().split('\n').length > 60 || new Set(ids).size < 3 || new Set(ids).size > 7 ||
      !/north star/i.test(text) || !/non-goals/i.test(text) || !/acceptance sketch/i.test(text)) {
    throw new Error('Intent requires at most 60 lines, 3–7 invariant IDs, North star, Non-goals and Acceptance sketch');
  }
  fs.mkdirSync(path.dirname(checked.absolute), { recursive: true });
  resolver.containedPath(fs.realpathSync(root), checked.relative);
  fs.writeFileSync(checked.absolute, text, { flag: 'wx', mode: 0o644 });
  return { status: 'created', path: checked.relative };
}

module.exports = { emptyDocs, scan, selectCanonical, isContextShape, readIntent, createIntent };
