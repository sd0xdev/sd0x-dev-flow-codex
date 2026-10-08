'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const resolverPath = path.resolve(__dirname, '../plugin/sd0x-dev-flow-codex/skills/create-request/scripts/request-tool.js');
const resolver = require(resolverPath);
const docs = require('../plugin/sd0x-dev-flow-codex/scripts/runtime/feature-docs');
function fixture(t, files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'v5-docs-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const [name, body] of Object.entries(files)) {
    const file = path.join(root, 'docs/features/API_v2', name);
    fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, body);
  }
  return root;
}
const intent = '# North star\nKeep behavior.\n## Non-goals\nNo expansion.\n## Invariants\n- INV-001 preserve\n- INV-002 validate\n- INV-003 observe\n## Acceptance sketch\nActual evidence.\n';
test('split mains round-trip through owner, roles partition and archived records remain historical', t => {
  const root = fixture(t, {
    '2-tech-spec/2-tech-spec.md': '# Design\n',
    '2-tech-spec/1-detail.md': '# Detail\n',
    'notes/2-tech-spec.md': '# Not main\n',
    'requests/archived/2026-01-01-old.md': '# Old\n',
    'archived/2-tech-spec.md': '# Hidden\n',
    'live.md': '# Live\n> **Doc role**: History record\n> **Current behavior authority**: Yes\n',
    'intent-API_v2.md': intent,
    'intent-wrong.md': intent
  });
  const context = resolver.resolveFeature(root, { feature: 'API_v2' });
  assert.equal(resolver.isContextShape(context), true);
  assert.equal(context.scan_error, false);
  assert.equal(context.canonical_docs.tech_spec, 'docs/features/API_v2/2-tech-spec/2-tech-spec.md');
  assert.equal(resolver.resolveFeature(root, { path: context.canonical_docs.tech_spec }).key, context.key);
  assert.equal(context.current_authority.length, 1);
  assert.equal(context.work_records.length, 1);
  assert.equal(context.design_records.find(item => item.file.endsWith('1-detail.md')).type, 'tech-spec');
  assert.equal(context.doc_inventory.some(item => item.file.includes('/archived/')), false);
  assert.equal(docs.readIntent(root, context).valid, true);
  assert.deepEqual(context.intent.strays, ['docs/features/API_v2/intent-wrong.md']);
});
test('root variants are ambiguous and nested incidental mains cannot steal selection', t => {
  const root = fixture(t, { '2-tech-spec-v2.md': '# v2', 'notes/2-tech-spec.md': '# incidental' });
  let context = resolver.resolveFeature(root, { feature: 'API_v2' });
  assert.match(context.canonical_docs.tech_spec, /2-tech-spec-v2.md$/);
  fs.writeFileSync(path.join(root, 'docs/features/API_v2/2-tech-spec-v3.md'), '# v3');
  context = resolver.resolveFeature(root, { feature: 'API_v2' });
  assert.equal(context.canonical_docs.tech_spec, null);
  assert.equal(context.canonical_ambiguities.tech_spec.length, 2);
});
test('read errors and symlinks refuse a complete corpus; partial shapes are invalid', t => {
  const root = fixture(t, { '2-tech-spec.md': '# Design' });
  const original = fs.readdirSync;
  try {
    fs.readdirSync = function (name, ...args) {
      if (String(name).endsWith('API_v2')) throw Object.assign(new Error('fixture EIO'), { code: 'EIO' });
      return original.call(this, name, ...args);
    };
    assert.throws(() => resolver.resolveFeature(root, { feature: 'API_v2' }), /EIO/);
  } finally { fs.readdirSync = original; }
  fs.symlinkSync('2-tech-spec.md', path.join(root, 'docs/features/API_v2/link.md'));
  assert.throws(() => resolver.resolveFeature(root, { feature: 'API_v2' }), /symlink/);
  for (const invalid of [null, [], {}, { scan_error: false }, { ...docs.emptyDocs(), source: 'none' }]) {
    assert.equal(resolver.isContextShape(invalid), false);
  }
});
test('failed Git discovery is unknown rather than a complete empty context', t => {
  const root = fixture(t, {});
  const source = `require('node:child_process').execFileSync=()=>{throw Object.assign(new Error('EIO'),{code:'EIO'})};require(${JSON.stringify(resolverPath)}).resolveFeature(${JSON.stringify(root)})`;
  const result = spawnSync(process.execPath, ['-e', source], { encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /discovery failed/);
});
test('intent creation is exclusive, bounded and never adopts or replaces an existing intent', t => {
  const root = fixture(t, { '1-requirements.md': '# accepted', 'intent-wrong.md': intent });
  assert.throws(() => docs.createIntent(root, { feature: 'API_v2', text: '# not an intent' }), /requires at most/);
  assert.equal(docs.createIntent(root, { feature: 'API_v2', text: intent }).status, 'created');
  assert.equal(docs.createIntent(root, { feature: 'API_v2', text: intent + 'new' }).status, 'preserved');
  assert.equal(fs.readFileSync(path.join(root, 'docs/features/API_v2/intent-API_v2.md'), 'utf8'), intent);
});

test('Windows scanner paths normalize before canonical selection and owner round-trip', t => {
  const root = fixture(t, {
    '2-tech-spec/2-tech-spec.md': '# Design\n',
    '2-tech-spec/1-detail.md': '# Detail\n',
    '1-requirements-v2.md': '# Requirements v2\n',
    '1-requirements-v3.md': '# Requirements v3\n',
    'notes/intent-nested.md': intent,
    'intent-API_v2.md': intent,
    'intent-wrong.md': intent
  });
  const classifierPath = path.resolve(__dirname,
    '../plugin/sd0x-dev-flow-codex/scripts/runtime/doc-classifier.js');
  const source = `
    const classifier = require(${JSON.stringify(classifierPath)});
    const original = classifier.scanFeatureDocs;
    classifier.scanFeatureDocs = (...args) => {
      const result = original(...args);
      for (const key of ['doc_inventory', ...Object.keys(classifier.emptySourceSets())]) {
        result[key] = result[key].map(item => ({ ...item,
          file: require('node:path').win32.join(...item.file.split('/')) }));
      }
      return result;
    };
    const resolver = require(${JSON.stringify(resolverPath)});
    const context = resolver.resolveFeature(${JSON.stringify(root)}, { feature: 'API_v2' });
    const roundTrip = context.canonical_docs.tech_spec
      ? resolver.resolveFeature(${JSON.stringify(root)}, { path: context.canonical_docs.tech_spec }).key
      : null;
    console.log(JSON.stringify({ context, roundTrip }));
  `;
  const result = spawnSync(process.execPath, ['-e', source], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const observed = JSON.parse(result.stdout);
  assert.equal(observed.context.canonical_docs.tech_spec, 'docs/features/API_v2/2-tech-spec/2-tech-spec.md');
  assert.deepEqual(observed.context.canonical_ambiguities.requirements,
    ['docs/features/API_v2/1-requirements-v2.md', 'docs/features/API_v2/1-requirements-v3.md']);
  assert.equal(observed.roundTrip, 'API_v2');
  assert.deepEqual(observed.context, resolver.resolveFeature(root, { feature: 'API_v2' }));
});
