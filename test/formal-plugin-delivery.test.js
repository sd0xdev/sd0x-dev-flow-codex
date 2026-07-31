'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  applyOverlayTransaction,
  candidateValidationResult,
  criterionEvidence,
  proposal,
  recordPendingPromotions,
  records,
  requestCriteria,
  writeDeliveryManifest
} = require('../scripts/complete-formal-plugin-delivery');
const {
  validateCandidateRequestEvidence
} = require('../scripts/skill-migration-audit');
const {
  atomicWriteContainedFile,
  readContainedFile
} = require('../scripts/contained-file');
const {
  canonicalEvidenceBlob
} = require('../plugin/sd0x-dev-flow-codex/scripts/runtime/state');

const ROOT = path.resolve(__dirname, '..');
const FORMAL_DELIVERY_STATES = new Set(['candidate', 'promoted']);

function formalRecords() {
  const disposition = JSON.parse(fs.readFileSync(
    path.join(ROOT, 'migration', 'source-disposition.json'), 'utf8'
  ));
  return records(disposition, FORMAL_DELIVERY_STATES);
}

function candidateMarkdown(markdown) {
  if (/^> \*\*Status\*\*: Candidate Complete$/m.test(markdown)) return markdown;
  assert.match(markdown, /^> \*\*Status\*\*: Completed$/m);
  const candidate = markdown
    .replace(
      /^> \*\*Status\*\*: Completed$/m,
      '> **Status**: Candidate Complete'
    )
    .replace(/ Final audit `[a-f0-9]{64}` passed\./, '')
    .replace(
      /^\| Acceptance \| Complete \|.*\|$/m,
      '| Acceptance | Candidate Complete | Awaiting runtime-owned R3 closure and promotion evidence. |'
    )
    .replace(
      'R3 closure inputs identify this exact request, promotion unit, evidence kind, and final-fingerprint fields.',
      'Closure and promotion evidence extend the latest durable owner lineage.'
    );
  assert.match(candidate, /^> \*\*Status\*\*: Candidate Complete$/m);
  assert.match(candidate, /^\| Acceptance \| Candidate Complete \|/m);
  assert.doesNotMatch(candidate, /Final audit `[a-f0-9]{64}` passed\./);
  return candidate;
}

test('every formal delivery dirty AC source is byte-preserving under evidence redaction', () => {
  const evidenceFiles = new Set();
  for (const record of formalRecords()) {
    const markdown = candidateMarkdown(
      fs.readFileSync(path.join(ROOT, record.request_path), 'utf8')
    );
    const proposed = proposal(markdown, {
      promotion_unit_id: record.promotion_unit_id,
      audit_fingerprint: 'a'.repeat(64)
    });
    const verdicts = criterionEvidence(
      record,
      requestCriteria(proposed),
      auditedIdentity(record, markdown)
    );
    for (const verdict of verdicts) {
      for (const location of verdict.evidence) {
        evidenceFiles.add(location.replace(/:\d+$/, ''));
      }
    }
  }
  assert.ok(evidenceFiles.size > 300);
  for (const relative of [...evidenceFiles].sort()) {
    const text = fs.readFileSync(path.join(ROOT, relative), 'utf8');
    const redacted = JSON.parse(canonicalEvidenceBlob(ROOT, text)).value;
    assert.equal(redacted, text, relative);
  }
});

function auditedIdentity(record, markdown) {
  const hashes = [...markdown.matchAll(/`([a-f0-9]{64})`/g)]
    .map((match) => match[1]);
  assert.ok(hashes.length >= 2);
  return {
    promotion_unit_id: record.promotion_unit_id,
    lifecycle: 'move-window',
    payload_tree_sha256: hashes[0],
    preflight_audit_fingerprint: hashes[1],
    audit_fingerprint: digest(`final-audit\0${record.promotion_unit_id}`)
  };
}

function formalRecord(unit) {
  return formalRecords().find((entry) => entry.promotion_unit_id === unit);
}

function evidenceLines(verdict) {
  return verdict.evidence.map((location) => {
    const match = /^(.*):(\d+)$/.exec(location);
    return fs.readFileSync(path.join(ROOT, match[1]), 'utf8')
      .split(/\r?\n/)[Number(match[2]) - 1];
  }).join('\n');
}

test('formal proposals require production final-audit identity and pass candidate validation', () => {
  for (const record of formalRecords()) {
    const markdown = candidateMarkdown(
      fs.readFileSync(path.join(ROOT, record.request_path), 'utf8')
    );
    const audit = auditedIdentity(record, markdown);
    assert.throws(() => proposal(markdown, {
      ...audit,
      audit_fingerprint: undefined
    }), /final audit identity is invalid/);
    assert.throws(() => candidateValidationResult(record, {
      ...audit,
      audit_fingerprint: undefined
    }), /production audit identity is incomplete/);
    const proposed = proposal(markdown, audit);
    const closureExpectations = [];
    const validated = validateCandidateRequestEvidence(
      proposed,
      candidateValidationResult(record, audit),
      record.request_path,
      { root: ROOT, closureExpectations }
    );
    assert.equal(validated.final_audit_fingerprint, audit.audit_fingerprint);
    assert.deepEqual(closureExpectations, [{
      promotion_unit_id: record.promotion_unit_id,
      kind: 'request-closure',
      request_path: record.request_path
    }]);
    assert.match(proposed, new RegExp(
      '^\\| Testing \\| Complete \\|.*Final audit `' +
        audit.audit_fingerprint + '` passed\\. \\|$',
      'm'
    ));
    assert.match(proposed,
      /^\| Acceptance \| Complete \| Runtime-owned R3 closure and promotion evidence bind this Completed owner\. \|$/m);
  }
});

test('formal request fixtures cover candidate and finalized or overlaid registry phases', () => {
  const formal = formalRecords();
  assert.equal(formal.length, 82);
  assert.equal(formalRecord('deep-research/default'), undefined,
    'the replacement owner is closed by its own request lifecycle');
  for (const record of formal) {
    const current = fs.readFileSync(path.join(ROOT, record.request_path), 'utf8');
    const candidate = candidateMarkdown(current);
    const existingFinalAudit = /Final audit `([a-f0-9]{64})` passed\./
      .exec(current)?.[1];
    const auditFingerprint = existingFinalAudit ||
      digest(`final-audit\0${record.promotion_unit_id}`);
    const finalized = proposal(candidate, {
      promotion_unit_id: record.promotion_unit_id,
      audit_fingerprint: auditFingerprint
    });
    assert.match(finalized, /^> \*\*Status\*\*: Completed$/m);
    assert.match(finalized, /^\| Acceptance \| Complete \|/m);
    if (existingFinalAudit) assert.equal(finalized, current);
  }
});

test('formal delivery binds legacy criteria to audited and durable identities', () => {
  const record = formalRecord('ask/default');
  assert.ok(record);
  const markdown = candidateMarkdown(
    fs.readFileSync(path.join(ROOT, record.request_path), 'utf8')
  );
  const proposed = proposal(markdown, {
    promotion_unit_id: record.promotion_unit_id,
    audit_fingerprint: 'a'.repeat(64)
  });
  const criteria = requestCriteria(proposed);
  const verdicts = criterionEvidence(record, criteria, auditedIdentity(record, markdown));
  assert.equal(verdicts.length, 7);
  assert.deepEqual(verdicts.map((verdict) => verdict.ac), [1, 2, 3, 4, 5, 6, 7]);
  assert.equal(verdicts.every((verdict) =>
    verdict.status === 'Complete' && verdict.confidence === 'High' &&
    verdict.evidence.length >= 2 &&
    verdict.evidence.every((location) =>
      !location.endsWith('SKILL.md:1') &&
      !/scripts\/[^:]+:\d+$/.test(location) ||
      !/function /.test(fs.readFileSync(
        path.join(ROOT, location.replace(/:\d+$/, '')), 'utf8'
      ).split(/\r?\n/)[Number(location.match(/:(\d+)$/)[1]) - 1])
    )
  ), true);
  assert.equal(new Set(verdicts.map((verdict) =>
    JSON.stringify(verdict.evidence)
  )).size, 7);
  for (const verdict of verdicts) {
    for (const location of verdict.evidence) {
      const relative = location.replace(/:\d+$/, '');
      assert.equal(fs.statSync(path.join(ROOT, relative)).isFile(), true);
    }
  }
  assert.doesNotMatch(proposed,
    /Closure and promotion evidence extend the latest durable owner lineage/);
  assert.match(proposed,
    /R3 closure inputs identify this exact request, promotion unit/);
  assert.match(verdicts[2].evidence.join('\n'),
    /2026-07-15-wave2-ask-pack-ready\.md/);
  assert.match(verdicts[2].evidence.join('\n'),
    /migration\/packs\/research-pack\/ask\/migration-contract\.json/);
});

test('formal delivery binds direct criteria to alias and exact audit identities', () => {
  const record = formalRecord('create-pr/default');
  const markdown = candidateMarkdown(
    fs.readFileSync(path.join(ROOT, record.request_path), 'utf8')
  );
  const criteria = requestCriteria(proposal(markdown, {
    promotion_unit_id: record.promotion_unit_id,
    audit_fingerprint: 'b'.repeat(64)
  }));
  const audit = auditedIdentity(record, markdown);
  const verdicts = criterionEvidence(record, criteria, audit);
  assert.match(verdicts[2].evidence.join('\n'), /migration\/alias-capability\.json/);
  assert.match(evidenceLines(verdicts[4]),
    new RegExp(audit.preflight_audit_fingerprint));
  assert.match(evidenceLines(verdicts[5]),
    new RegExp(audit.payload_tree_sha256));
  assert.throws(() => criterionEvidence(record, criteria, {
    ...audit,
    payload_tree_sha256: '0'.repeat(64)
  }), /criterion evidence anchor is missing/);
});

test('distributed core skill resources contain no stale pack-only boundary claims', () => {
  const root = path.join(
    ROOT, 'plugin', 'sd0x-dev-flow-codex', 'skills'
  );
  const files = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile() && entry.name.endsWith('.md')) files.push(absolute);
    }
  };
  visit(root);
  const stale = /(?:research|development)?-?pack-ready source material|outside (?:the )?core (?:plugin manifest and live skill discovery|discovery)|later separate-plugin repository|not a core skill|not published from this repository|not released here|not a released separate plugin/i;
  for (const file of files) {
    assert.doesNotMatch(
      fs.readFileSync(file, 'utf8'),
      stale,
      path.relative(ROOT, file)
    );
  }
});

function digest(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function transactionFixture(root) {
  const pending = [];
  const names = [
    'migration/source-disposition.json',
    'docs/PROJECT-MIGRATION-GUIDE.md',
    'docs/features/skill-toolkit-migration/2-tech-spec.md'
  ];
  const targets = names.map((name, index) => {
    const prior = Buffer.from(`old-${index}\n`);
    const next = Buffer.from(`new-${index}\n`);
    fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    fs.writeFileSync(path.join(root, name), prior);
    pending.push(next);
    return {
      path: name,
      prior_sha256: digest(prior),
      next_sha256: digest(next),
      next_bytes_base64: next.toString('base64'),
      applied: false
    };
  });
  return {
    pending,
    expected: structuredClone(targets),
    manifest: { phase: 'overlaying', overlay_targets: targets }
  };
}

function transactionHooks(root, persist, injection = null) {
  return {
    read(target) {
      return readContainedFile(root, path.join(root, target.path));
    },
    write(target, bytes, current) {
      atomicWriteContainedFile(root, path.join(root, target.path), bytes, {
        captured: current.captured
      });
      if (injection?.kind === 'after' && injection.path === target.path) {
        throw new Error('injected after-write cut');
      }
    },
    beforeWrite(target) {
      if (injection?.kind === 'before' && injection.path === target.path) {
        throw new Error('injected before-write cut');
      }
    },
    persist
  };
}

test('formal overlay resumes every before/after write crash boundary', (t) => {
  for (const kind of ['before', 'after']) {
    for (const targetName of [
      'migration/source-disposition.json',
      'docs/PROJECT-MIGRATION-GUIDE.md',
      'docs/features/skill-toolkit-migration/2-tech-spec.md'
    ]) {
      const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-overlay-cut-'));
      t.after(() => fs.rmSync(root, { recursive: true, force: true }));
      const fixture = transactionFixture(root);
      let persisted = structuredClone(fixture.manifest);
      const persist = (manifest) => { persisted = structuredClone(manifest); };
      assert.throws(() => applyOverlayTransaction(
        persisted,
        transactionHooks(root, persist, { kind, path: targetName }),
        fixture.expected
      ), /injected/);
      for (const target of persisted.overlay_targets) {
        const current = digest(fs.readFileSync(path.join(root, target.path)));
        assert.ok([target.prior_sha256, target.next_sha256].includes(current));
      }
      applyOverlayTransaction(
        persisted, transactionHooks(root, persist), fixture.expected
      );
      assert.equal(persisted.phase, 'overlaid');
      assert.equal(persisted.overlay_targets.every((target) =>
        digest(fs.readFileSync(path.join(root, target.path))) === target.next_sha256
      ), true);
    }
  }
});

test('formal delivery rejects manifest and overlay symlink escapes', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-delivery-link-'));
  const external = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-delivery-external-'));
  t.after(() => {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(external, { recursive: true, force: true });
  });
  const externalManifest = path.join(external, 'manifest.json');
  fs.writeFileSync(externalManifest, 'external\n');
  fs.symlinkSync(external, path.join(root, '.sd0x'));
  assert.throws(() => writeDeliveryManifest(
    root,
    path.join(root, '.sd0x', 'formal-plugin-delivery.json'),
    { schema_version: 2 }
  ), /ancestor must be a real directory/);
  assert.equal(fs.readFileSync(externalManifest, 'utf8'), 'external\n');

  fs.rmSync(path.join(root, '.sd0x'));
  const fixture = transactionFixture(root);
  const externalTarget = path.join(external, 'target.txt');
  fs.writeFileSync(externalTarget, 'outside\n');
  const linkedTarget = path.join(root, 'docs', 'PROJECT-MIGRATION-GUIDE.md');
  fs.rmSync(linkedTarget);
  fs.symlinkSync(externalTarget, linkedTarget);
  assert.throws(() => applyOverlayTransaction(
    fixture.manifest,
    transactionHooks(root, () => {}),
    fixture.expected
  ), /regular file/);
  assert.equal(fs.readFileSync(externalTarget, 'utf8'), 'outside\n');
});

test('formal overlay rejects a redirected fixed target before mutation', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-overlay-redirect-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const fixture = transactionFixture(root);
  fs.writeFileSync(path.join(root, 'package.json'), '{"safe":true}\n');
  fixture.manifest.overlay_targets[0].path = 'package.json';
  assert.throws(() => applyOverlayTransaction(
    fixture.manifest,
    transactionHooks(root, () => {}),
    fixture.expected
  ), /deterministic targets/);
  assert.equal(fs.readFileSync(path.join(root, 'package.json'), 'utf8'),
    '{"safe":true}\n');
  assert.deepEqual(fixture.expected.map((target) =>
    fs.readFileSync(path.join(root, target.path), 'utf8')
  ), ['old-0\n', 'old-1\n', 'old-2\n']);
});

test('formal promotion recording resumes without replaying completed appends', () => {
  let persisted = {
    schema_version: 1,
    phase: 'finalized',
    pending: ['one/default', 'two/default', 'three/default'].map(
      (promotion_unit_id) => ({ promotion_unit_id })
    )
  };
  const appended = [];
  const hashes = new Map();
  const persist = (manifest) => {
    persisted = structuredClone(manifest);
  };
  assert.throws(() => recordPendingPromotions(persisted, {
    latest(record) {
      return hashes.has(record.promotion_unit_id)
        ? { record_sha256: hashes.get(record.promotion_unit_id) }
        : null;
    },
    intent(record, index) {
      return { recorded_at: new Date(index + 1).toISOString(), supersedes_record_sha256: null };
    },
    append(record) {
      appended.push(record.promotion_unit_id);
      if (record.promotion_unit_id === 'two/default') throw new Error('append cut');
      const hash = record.promotion_unit_id === 'one/default'
        ? '1'.repeat(64)
        : '3'.repeat(64);
      hashes.set(record.promotion_unit_id, hash);
      return { record_sha256: hash };
    },
    persist
  }), /append cut/);
  assert.equal(persisted.phase, 'recording');
  assert.equal(persisted.pending[0].promotion_record_sha256, '1'.repeat(64));

  recordPendingPromotions(persisted, {
    latest(record) {
      return hashes.has(record.promotion_unit_id)
        ? { record_sha256: hashes.get(record.promotion_unit_id) }
        : null;
    },
    intent(record, index) {
      return { recorded_at: new Date(index + 1).toISOString(), supersedes_record_sha256: null };
    },
    append(record) {
      appended.push(record.promotion_unit_id);
      const hash = record.promotion_unit_id === 'two/default'
        ? '2'.repeat(64)
        : '3'.repeat(64);
      hashes.set(record.promotion_unit_id, hash);
      return { record_sha256: hash };
    },
    persist
  });
  assert.equal(persisted.phase, 'recorded');
  assert.deepEqual(appended, [
    'one/default', 'two/default', 'two/default', 'three/default'
  ]);
  assert.deepEqual(persisted.pending.map((record) =>
    record.promotion_record_sha256
  ), ['1'.repeat(64), '2'.repeat(64), '3'.repeat(64)]);
});

test('formal promotion recording reuses a post-append pre-persist intent', () => {
  let persisted = {
    phase: 'finalized',
    pending: [{ promotion_unit_id: 'one/default' }]
  };
  const revisions = [];
  let cut = true;
  const run = () => recordPendingPromotions(persisted, {
    latest() {
      return revisions.length > 0
        ? { record_sha256: revisions[0].hash }
        : null;
    },
    intent() {
      return { recorded_at: '2026-07-28T00:00:00.000Z', supersedes_record_sha256: null };
    },
    append(record) {
      assert.equal(record.promotion_recorded_at, '2026-07-28T00:00:00.000Z');
      if (revisions.length === 0) revisions.push({ hash: 'a'.repeat(64) });
      if (cut) {
        cut = false;
        throw new Error('post-append cut');
      }
      return { record_sha256: revisions[0].hash, reused: true };
    },
    persist(manifest) {
      persisted = structuredClone(manifest);
    }
  });
  assert.throws(run, /post-append cut/);
  assert.equal(persisted.pending[0].promotion_record_sha256, undefined);
  run();
  assert.equal(revisions.length, 1);
  assert.equal(persisted.pending[0].promotion_record_sha256, 'a'.repeat(64));
  assert.equal(persisted.phase, 'recorded');
});
