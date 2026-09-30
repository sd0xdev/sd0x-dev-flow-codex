'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { commit, git, initRepository } = require('./helpers/git');
const {
  rewindEvidenceFixtureToStableClosureBoundary
} = require('./helpers/migration-fixture');

test('migration fixture rewinds closure evidence larger than the default Git output buffer', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-large-evidence-fixture-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  initRepository(root);
  const evidenceRef = 'refs/sd0x-dev-flow-codex/evidence/v1';
  const pendingHash = 'a'.repeat(64);
  const closureHash = 'b'.repeat(64);
  const nextPendingHash = 'c'.repeat(64);
  const common = {
    promotion_unit_id: 'fixture/default',
    request_path: 'owner.md',
    recorded_at: '2026-01-01T00:00:00.000Z'
  };
  const writeRecord = (record) => {
    const file = path.join(root, 'records', record.kind, `${record.record_sha256}.json`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const bytes = `${JSON.stringify(record)}\n`;
    fs.writeFileSync(file, bytes);
    return Buffer.byteLength(bytes);
  };
  fs.writeFileSync(path.join(root, common.request_path), '# Fixture owner\n');
  const pendingBytes = writeRecord({
    ...common,
    kind: 'request-closure-pending',
    record_sha256: pendingHash,
    fixture_padding: 'x'.repeat(1024 * 1024)
  });
  assert.ok(pendingBytes > 1024 * 1024);
  writeRecord({
    ...common,
    kind: 'request-closure',
    record_sha256: closureHash,
    pending_record_sha256: pendingHash
  });
  git(root, ['add', '.']);
  commit(root, 'Stable fixture closure');
  const stable = git(root, ['rev-parse', 'HEAD']).toString().trim();
  writeRecord({
    ...common,
    kind: 'request-closure-pending',
    record_sha256: nextPendingHash,
    recorded_at: '2026-01-02T00:00:00.000Z'
  });
  git(root, ['add', '.']);
  commit(root, `Pending fixture closure ${nextPendingHash}`);
  const pending = git(root, ['rev-parse', 'HEAD']).toString().trim();
  git(root, ['update-ref', evidenceRef, pending]);

  let failure = null;
  try {
    rewindEvidenceFixtureToStableClosureBoundary(root);
  } catch (error) {
    failure = error.code || error.message;
  }
  assert.equal(failure, null);
  assert.equal(git(root, ['rev-parse', evidenceRef]).toString().trim(), stable);
  assert.equal(git(root, ['rev-parse', 'HEAD']).toString().trim(), pending);
});
