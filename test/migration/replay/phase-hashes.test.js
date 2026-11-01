'use strict';

const {
  assert,
  fs,
  path,
  test,
  auditSource,
  validateCandidateCompletePackEvidence,
  applyRequestClosure,
  auditEvidenceLedger,
  finalizeRequestClosure,
  hashPayloadTree,
  prepareRequestClosure,
  recordPromotionEvidence,
  git,
  fixtureRoot,
  ROOT,
  readJson,
  writeJson,
  copyResearchBehaviorTests,
  recordPassingGates
} = require('../../helpers/migration-context');

test('historical replay: source audit rejects matching durable research evidence with wrong phase hashes', (t) => {
  for (const phase of ['payload', 'preflight', 'final']) {
  const values = fixtureRoot({ candidateCompletePacks: true });
  t.after(() => fs.rmSync(values.workspace, { recursive: true, force: true }));
  copyResearchBehaviorTests(values.root);
  const dispositionPath = 'migration/source-disposition.json';
  const disposition = readJson(values.root, dispositionPath);
  for (const row of disposition.skills) {
    if (row.target_package === 'research-pack') {
      row.delivery_state = row.source_name === 'ask' ? 'candidate' : 'planned';
    }
  }
  writeJson(values.root, dispositionPath, disposition);
  const askRow = disposition.skills.find((row) => row.source_name === 'ask');
  const requestPath = askRow.promotion_request;
  const requestAbsolute = path.join(values.root, requestPath);
  const prior = fs.readFileSync(requestAbsolute, 'utf8');
  const exact = /Payload `([0-9a-f]{64})`; preflight `([0-9a-f]{64})`\. Final pack audit `([0-9a-f]{64})` passed\./.exec(
    fs.readFileSync(path.join(ROOT, requestPath), 'utf8')
  );
  assert.ok(exact);
  const hashes = exact.slice(1);
  hashes[['payload', 'preflight', 'final'].indexOf(phase)] = '0'.repeat(64);
  const proposed = prior
    .replace('> **Status**: Candidate Complete', '> **Status**: Completed')
    .replace(/Payload `[0-9a-f]{64}`; preflight `[0-9a-f]{64}`\./,
      `Payload \`${hashes[0]}\`; preflight \`${hashes[1]}\`. Final pack audit \`${hashes[2]}\` passed.`)
    .replace(/^\| Acceptance \| Candidate Complete \|.*$/m,
      '| Acceptance | Complete | Durable closure fixture. |');
  const subjectState = recordPassingGates(values.root, `wrong-${phase}-subject`);
  const subject = {
    kind: 'dirty',
    fingerprint: subjectState.worktree.fingerprint,
    head_sha: git(values.root, ['rev-parse', 'HEAD']).toString().trim()
  };
  const acCount = (proposed.match(/^- \[x\] /gm) || []).length;
  const pending = prepareRequestClosure(values.root, {
    promotion_unit_id: askRow.promotion_unit_id,
    request_path: requestPath,
    proposed_request: proposed,
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
    recorded_at: '2026-07-15T09:00:00.000Z',
    supersedes_record_sha256: null
  });
  applyRequestClosure(values.root, {
    pending_record_sha256: pending.record_sha256
  });
  recordPassingGates(values.root, `wrong-${phase}-docs`);
  finalizeRequestClosure(values.root, {
    pending_record_sha256: pending.record_sha256,
    recorded_at: '2026-07-15T09:01:00.000Z',
    supersedes_record_sha256: null
  });

  assert.throws(() => validateCandidateCompletePackEvidence(
    values.root, readJson(values.root, dispositionPath)
  ), new RegExp(phase === 'payload'
    ? 'payload evidence is stale or cross-unit'
    : phase === 'preflight'
      ? 'preflight evidence is stale or cross-unit'
      : 'Completed final audit evidence is stale or cross-unit'));

  recordPassingGates(values.root, `wrong-${phase}-pack-ready`);
  const closure = auditEvidenceLedger(values.root, {
    promotion_unit_id: askRow.promotion_unit_id,
    kind: 'request-closure',
    request_path: requestPath
  }).selected;
  recordPromotionEvidence(values.root, {
    kind: 'pack-ready',
    promotion_unit_id: askRow.promotion_unit_id,
    request_closure_record_sha256: closure.record_sha256,
    disposition_row: askRow,
    payload_tree_sha256: hashPayloadTree(
      values.root, 'migration/packs/research-pack/ask'
    ),
    reason: null,
    recorded_at: '2026-07-15T09:02:00.000Z',
    supersedes_record_sha256: null
  });
  const delivered = readJson(values.root, dispositionPath);
  delivered.skills.find((row) => row.source_name === 'ask').delivery_state =
    'pack-ready';
  writeJson(values.root, dispositionPath, delivered);
  assert.throws(() => auditSource({ root: values.root }),
    new RegExp(`delivered ${phase === 'final' ? 'final audit' : phase} evidence is stale or cross-unit`));
  }
});
