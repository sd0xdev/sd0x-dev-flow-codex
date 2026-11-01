'use strict';

const {
  assert,
  fs,
  path,
  test,
  auditActiveCandidates,
  auditSource,
  restageCoreCandidate,
  applyRequestClosure,
  auditEvidenceLedger,
  finalizeRequestClosure,
  prepareRequestClosure,
  git,
  fixtureRoot,
  ROOT,
  completionEvidenceSnapshot,
  readJson,
  writeJson,
  recordPassingGates,
  writeRequest
} = require('../helpers/migration-context');

test('active create-request owner tamper fails in candidate and move-window states', (t) => {
  const exercise = (values, lifecycle) => {
    t.after(() => fs.rmSync(values.workspace, { recursive: true, force: true }));
    const disposition = readJson(values.root, 'migration/source-disposition.json');
    const repositoryDisposition = JSON.parse(git(values.root, [
      'show', 'HEAD:migration/source-disposition.json'
    ]).toString());
    const repositoryStateBySource = new Map(repositoryDisposition.skills.map((row) =>
      [row.source_name, row.delivery_state]
    ));
    for (const row of disposition.skills) {
      if (row.promotion_unit_id !== 'create-request/default') {
        row.delivery_state = repositoryStateBySource.get(row.source_name);
      }
    }
    writeJson(values.root, 'migration/source-disposition.json', disposition);
    const owner = disposition.skills.find((row) =>
      row.promotion_unit_id === 'create-request/default'
    ).promotion_request;
    const result = auditActiveCandidates({ root: values.root });
    assert.equal(result.units.find((unit) =>
      unit.promotion_unit_id === 'create-request/default'
    ).lifecycle, lifecycle);
    const ownerPath = path.join(values.root, owner);
    const markdown = fs.readFileSync(ownerPath, 'utf8');
    fs.writeFileSync(ownerPath, markdown
      .replace('> **Status**: Completed', '> **Status**: Candidate Complete')
      .replace(/^\| Acceptance \| Complete \|.*$/m,
        '| Acceptance | Candidate Complete | Candidate evidence remains pending. |'));
    assert.throws(() => auditActiveCandidates({ root: values.root }),
      /Current request no longer matches durable completion evidence/);
  };

  exercise(fixtureRoot({ copyEvidenceRef: true }), 'move-window');
  const candidate = fixtureRoot({ copyEvidenceRef: true });
  restageCoreCandidate(candidate.root, 'create-request');
  exercise(candidate, 'preflight');
});

test('candidate replacement owner requires its own durable closure before Completed', (t) => {
  const values = fixtureRoot({ copyEvidenceRef: true });
  t.after(() => fs.rmSync(values.workspace, { recursive: true, force: true }));
  const dispositionPath = 'migration/source-disposition.json';
  const disposition = readJson(values.root, dispositionPath);
  const rows = disposition.skills.filter((row) =>
    row.promotion_unit_id === 'create-request/default'
  );
  const priorCompletion = completionEvidenceSnapshot(values.root).find((record) =>
    record.promotion_unit_id === 'create-request/default'
  );
  const priorOwner = priorCompletion.request_path;
  const priorClosure = auditEvidenceLedger(values.root, {
    promotion_unit_id: 'create-request/default',
    kind: 'request-closure'
  }).selected;
  const priorPending = JSON.parse(git(values.root, ['show',
    `refs/sd0x-dev-flow-codex/evidence/v1:records/request-closure-pending/${priorClosure.pending_record_sha256}.json`
  ]).toString());
  const recordedAfter = Math.max(
    Date.parse(priorPending.recorded_at),
    Date.parse(priorClosure.recorded_at)
  );
  const recordedAt = (seconds) => new Date(
    recordedAfter + seconds * 1000
  ).toISOString();
  const requestPath = writeRequest(
    values.root, '2026-07-26-fixture-create-request-transition.md'
  );
  const requestAbsolute = path.join(values.root, requestPath);
  const candidate = fs.readFileSync(requestAbsolute, 'utf8')
    .replace('> **Status**: Pending', '> **Status**: Candidate Complete')
    .replace('> **Priority**: P1',
      `> **Priority**: P1\n> **Depends On**: [Prior owner](./${path.basename(priorOwner)})`)
    .replace('- [ ] Fixture evidence passes.', '- [x] Fixture evidence passes.');
  fs.writeFileSync(requestAbsolute, candidate);
  for (const row of rows) {
    row.delivery_state = 'candidate';
    row.promotion_request = requestPath;
  }
  writeJson(values.root, dispositionPath, disposition);
  assert.equal(auditSource({ root: values.root }).ok, true);

  const completed = candidate.replace(
    '> **Status**: Candidate Complete', '> **Status**: Completed'
  );
  fs.writeFileSync(requestAbsolute, completed);
  assert.throws(() => auditSource({ root: values.root }),
    /Evidence completion mismatch for request_path/);
  fs.writeFileSync(requestAbsolute, candidate);

  const subjectState = recordPassingGates(values.root, 'candidate-closure-subject');
  const subject = {
    kind: 'dirty',
    fingerprint: subjectState.worktree.fingerprint,
    head_sha: git(values.root, ['rev-parse', 'HEAD']).toString().trim()
  };
  const pending = prepareRequestClosure(values.root, {
    promotion_unit_id: 'create-request/default',
    request_path: requestPath,
    proposed_request: completed,
    subject,
    evidence: {
      subject_review: {
        binding: subject,
        provider: 'codex',
        evidence: {
          gate: subjectState.gates.review.evidence,
          native_results: subjectState.review_agents.completed,
          external_results: [],
          subject_bindings: []
        }
      },
      verify: {
        binding: subject,
        provider: 'codex',
        evidence: subjectState.gates.verify.evidence
      },
      ac: {
        verdicts: [{
          ac: 1,
          status: 'Complete',
          confidence: 'High',
          evidence: ['AGENTS.md:1']
        }]
      },
      checks: { commands: [{ argv: ['node', '--test'], exit_code: 0 }] }
    },
    recorded_at: recordedAt(1),
    supersedes_record_sha256: priorClosure.pending_record_sha256
  });
  applyRequestClosure(values.root, {
    pending_record_sha256: pending.record_sha256
  });
  recordPassingGates(values.root, 'candidate-closure-docs');
  finalizeRequestClosure(values.root, {
    pending_record_sha256: pending.record_sha256,
    recorded_at: recordedAt(2),
    supersedes_record_sha256: priorClosure.record_sha256
  });
  assert.equal(auditSource({ root: values.root }).ok, true);
});

test('source audit rejects a Completed core candidate owner without an evidence ref', (t) => {
  const values = fixtureRoot({ copyEvidenceRef: false });
  t.after(() => fs.rmSync(values.workspace, { recursive: true, force: true }));
  const disposition = readJson(values.root, 'migration/source-disposition.json');
  const owner = disposition.skills.find((row) =>
    row.promotion_unit_id === 'create-request/default'
  ).promotion_request;
  const ownerPath = path.join(values.root, owner);
  fs.writeFileSync(ownerPath, fs.readFileSync(ownerPath, 'utf8').replace(
    '> **Status**: Candidate Complete', '> **Status**: Completed'
  ));
  assert.throws(() => auditSource({ root: values.root }),
    /Evidence ref is missing/);
});

test('durable owner revisions preserve prior requests and chain every successor', (t) => {
  const disposition = readJson(ROOT, 'migration/source-disposition.json');
  const row = disposition.skills.find((entry) =>
    entry.promotion_unit_id === 'create-request/default'
  );
  const current = completionEvidenceSnapshot(ROOT).find((record) =>
    record.promotion_unit_id === row.promotion_unit_id
  );
  assert.ok(current);
  if (row.delivery_state === 'candidate') {
    assert.notEqual(current.request_path, row.promotion_request);
    const request = fs.readFileSync(path.join(ROOT, row.promotion_request), 'utf8');
    assert.match(request, new RegExp(path.basename(current.request_path)
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    return;
  }
  assert.equal(current.request_path, row.promotion_request);
  assert.match(current.supersedes_record_sha256, /^[0-9a-f]{64}$/);
  const prior = JSON.parse(git(ROOT, ['show',
    `refs/sd0x-dev-flow-codex/evidence/v1:records/${current.kind}/` +
    `${current.supersedes_record_sha256}.json`
  ]).toString());
  assert.notEqual(prior.request_path, row.promotion_request);
  const request = fs.readFileSync(path.join(ROOT, row.promotion_request), 'utf8');
  assert.match(request, new RegExp(path.basename(prior.request_path)
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});
