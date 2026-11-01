'use strict';

const {
  assert,
  fs,
  path,
  test,
  auditSource,
  applyRequestClosure,
  auditEvidenceLedger,
  finalizeRequestClosure,
  hashPayloadTree,
  latestCompletionEvidence,
  prepareRequestClosure,
  recordPromotionEvidence,
  git,
  fixtureRoot,
  readJson,
  writeJson,
  recordPassingGates,
  writeRequest
} = require('../../helpers/migration-context');

test('historical replay: durable owner revisions preserve prior requests and chain every successor', (t) => {
  const values = fixtureRoot({ copyEvidenceRef: true });
  t.after(() => fs.rmSync(values.workspace, { recursive: true, force: true }));
  const dispositionPath = 'migration/source-disposition.json';
  const disposition = readJson(values.root, dispositionPath);
  const row = disposition.skills.find((entry) =>
    entry.promotion_unit_id === 'create-request/default'
  );
  const predecessorRequestPath = row.promotion_request;
  const predecessorRequest = fs.readFileSync(
    path.join(values.root, predecessorRequestPath), 'utf8'
  );
  const requestPath =
    'docs/features/skill-toolkit-migration/requests/' +
    '2026-07-27-create-request-successor-repromotion.md';
  const requestAbsolute = path.join(values.root, requestPath);
  const candidateRequest = predecessorRequest
    .replace(/^# .+$/m, '# Create Request Successor Re-Promotion')
    .replace('> **Status**: Completed', '> **Status**: Candidate Complete')
    .replace(/^> \*\*Depends On\*\*:.*$/m,
      `> **Depends On**: [Current durable owner](./${path.basename(predecessorRequestPath)})`)
    .replace(/^\| Acceptance \| Complete \|.*$/m,
      '| Acceptance | Candidate Complete | Successor closure remains pending. |');
  fs.writeFileSync(requestAbsolute, candidateRequest);
  row.promotion_request = requestPath;
  writeJson(values.root, dispositionPath, disposition);
  const completedRequest = candidateRequest.replace(
    '> **Status**: Candidate Complete', '> **Status**: Completed'
  );
  const priorPromotion = auditEvidenceLedger(values.root, {
    promotion_unit_id: row.promotion_unit_id,
    kind: 'promotion'
  }).selected;
  const priorClosure = auditEvidenceLedger(values.root, {
    promotion_unit_id: row.promotion_unit_id,
    kind: 'request-closure'
  }).selected;
  const recordedAfter = Math.max(
    Date.parse(priorPromotion.recorded_at),
    Date.parse(priorClosure.recorded_at)
  );
  const recordedAt = (offset) =>
    new Date(recordedAfter + offset * 1000).toISOString();
  const priorRequestAbsolute = path.join(values.root, priorPromotion.request_path);
  const priorRequestBytes = fs.readFileSync(priorRequestAbsolute);
  const subjectState = recordPassingGates(values.root, 'owner-revision-subject');
  const subject = {
    kind: 'dirty',
    fingerprint: subjectState.worktree.fingerprint,
    head_sha: git(values.root, ['rev-parse', 'HEAD']).toString().trim()
  };
  const acCount = (completedRequest.match(/^- \[x\] /gm) || []).length;
  const pending = prepareRequestClosure(values.root, {
    promotion_unit_id: row.promotion_unit_id,
    request_path: requestPath,
    proposed_request: completedRequest,
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
        verdicts: Array.from({ length: acCount }, (_, index) => ({
          ac: index + 1,
          status: 'Complete',
          confidence: 'High',
          evidence: ['AGENTS.md:1']
        }))
      },
      checks: { commands: [{ argv: ['node', '--test'], exit_code: 0 }] }
    },
    recorded_at: recordedAt(1),
    supersedes_record_sha256: priorClosure.pending_record_sha256
  });
  applyRequestClosure(values.root, {
    pending_record_sha256: pending.record_sha256
  });
  recordPassingGates(values.root, 'owner-revision-docs');
  const closure = finalizeRequestClosure(values.root, {
    pending_record_sha256: pending.record_sha256,
    recorded_at: recordedAt(2),
    supersedes_record_sha256: priorClosure.record_sha256
  });
  row.delivery_state = 'promoted';
  writeJson(values.root, dispositionPath, disposition);
  recordPassingGates(values.root, 'owner-revision-promotion');
  const successorPromotion = recordPromotionEvidence(values.root, {
    kind: 'promotion',
    promotion_unit_id: row.promotion_unit_id,
    request_closure_record_sha256: closure.record_sha256,
    disposition_row: row,
    payload_tree_sha256: hashPayloadTree(
      values.root, 'plugin/sd0x-dev-flow-codex/skills/create-request'
    ),
    reason: null,
    recorded_at: recordedAt(3),
    supersedes_record_sha256: priorPromotion.record_sha256
  });
  assert.deepEqual(fs.readFileSync(priorRequestAbsolute), priorRequestBytes);
  assert.equal(latestCompletionEvidence(values.root).find((record) =>
    record.promotion_unit_id === row.promotion_unit_id
  ).request_path, requestPath);
  assert.equal(auditSource({ root: values.root }).ok, true);

  const secondRequest = writeRequest(
    values.root, '2026-07-23-fixture-create-request-second-revision.md'
  );
  const secondAbsolute = path.join(values.root, secondRequest);
  const secondCandidate = fs.readFileSync(secondAbsolute, 'utf8')
    .replace('> **Status**: Pending', '> **Status**: Candidate Complete')
    .replace('> **Priority**: P1',
      `> **Priority**: P1\n> **Depends On**: [Prior owner](./${path.basename(requestPath)})`)
    .replace('- [ ] Fixture evidence passes.', '- [x] Fixture evidence passes.');
  fs.writeFileSync(secondAbsolute, secondCandidate);
  row.delivery_state = 'candidate';
  row.promotion_request = secondRequest;
  writeJson(values.root, dispositionPath, disposition);
  assert.equal(auditSource({ root: values.root }).ok, true);
  fs.writeFileSync(secondAbsolute, secondCandidate
    .replace(/^> \*\*Depends On\*\*:.*\n/m, ''));
  assert.throws(() => auditSource({ root: values.root }),
    /replacement gate owner lacks latest durable lineage/);
  fs.writeFileSync(secondAbsolute, secondCandidate);

  const ask = disposition.skills.find((entry) =>
    entry.promotion_unit_id === 'ask/default'
  );
  const priorAsk = {
    delivery_state: ask.delivery_state,
    promotion_request: ask.promotion_request
  };
  const askReplacement = writeRequest(
    values.root, '2026-07-23-fixture-ask-owner-revision.md'
  );
  const askAbsolute = path.join(values.root, askReplacement);
  fs.writeFileSync(askAbsolute, fs.readFileSync(askAbsolute, 'utf8')
    .replace('> **Status**: Pending', '> **Status**: Candidate Complete')
    .replace('- [ ] Fixture evidence passes.', '- [x] Fixture evidence passes.'));
  ask.delivery_state = 'candidate';
  ask.promotion_request = askReplacement;
  writeJson(values.root, dispositionPath, disposition);
  assert.throws(() => auditSource({ root: values.root }),
    /ask\/default: replacement gate owner lacks latest durable lineage/);
  ask.delivery_state = priorAsk.delivery_state;
  ask.promotion_request = priorAsk.promotion_request;

  const invalidSecondCandidate = secondCandidate
    .replace(/^> \*\*Depends On\*\*:.*\n/m, '');
  fs.writeFileSync(secondAbsolute, invalidSecondCandidate);
  writeJson(values.root, dispositionPath, disposition);
  const secondSubjectState = recordPassingGates(
    values.root, 'second-owner-revision-subject'
  );
  const secondSubject = {
    kind: 'dirty',
    fingerprint: secondSubjectState.worktree.fingerprint,
    head_sha: git(values.root, ['rev-parse', 'HEAD']).toString().trim()
  };
  const secondCompleted = invalidSecondCandidate.replace(
    '> **Status**: Candidate Complete', '> **Status**: Completed'
  );
  const secondPending = prepareRequestClosure(values.root, {
    promotion_unit_id: row.promotion_unit_id,
    request_path: secondRequest,
    proposed_request: secondCompleted,
    subject: secondSubject,
    evidence: {
      subject_review: {
        binding: secondSubject,
        provider: 'codex',
        evidence: {
          gate: secondSubjectState.gates.review.evidence,
          native_results: secondSubjectState.review_agents.completed,
          external_results: [],
          subject_bindings: []
        }
      },
      verify: {
        binding: secondSubject,
        provider: 'codex',
        evidence: secondSubjectState.gates.verify.evidence
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
    recorded_at: recordedAt(4),
    supersedes_record_sha256: pending.record_sha256
  });
  applyRequestClosure(values.root, {
    pending_record_sha256: secondPending.record_sha256
  });
  recordPassingGates(values.root, 'second-owner-revision-docs');
  const secondClosure = finalizeRequestClosure(values.root, {
    pending_record_sha256: secondPending.record_sha256,
    recorded_at: recordedAt(5),
    supersedes_record_sha256: closure.record_sha256
  });
  row.delivery_state = 'promoted';
  writeJson(values.root, dispositionPath, disposition);
  recordPassingGates(values.root, 'second-owner-revision-promotion');
  recordPromotionEvidence(values.root, {
    kind: 'promotion',
    promotion_unit_id: row.promotion_unit_id,
    request_closure_record_sha256: secondClosure.record_sha256,
    disposition_row: row,
    payload_tree_sha256: hashPayloadTree(
      values.root, 'plugin/sd0x-dev-flow-codex/skills/create-request'
    ),
    reason: null,
    recorded_at: recordedAt(6),
    supersedes_record_sha256: successorPromotion.record_sha256
  });
  assert.deepEqual(fs.readFileSync(requestAbsolute), Buffer.from(completedRequest));
  assert.throws(() => auditSource({ root: values.root }),
    /replacement gate owner lacks latest durable lineage/);
});
