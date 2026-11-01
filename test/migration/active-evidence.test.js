'use strict';

const {
  assert,
  crypto,
  fs,
  path,
  test,
  auditActiveCandidates,
  auditCandidate,
  selectActiveCandidatePayload,
  validateCandidateRequestEvidence,
  applyRequestClosure,
  finalizeRequestClosure,
  prepareRequestClosure,
  commit,
  git,
  fixtureRoot,
  ROOT,
  writeJson,
  recordPassingGates
} = require('../helpers/migration-context');

test('active candidate audit binds non-routing payload bytes to request evidence', (t) => {
  const values = fixtureRoot({ copyEvidenceRef: false });
  t.after(() => fs.rmSync(values.workspace, { recursive: true, force: true }));
  const candidatesRoot = path.join(values.root, 'migration', 'candidates');
  fs.mkdirSync(candidatesRoot, { recursive: true });
  for (const target of ['bug-fix', 'feature-dev']) {
    const candidate = path.join(candidatesRoot, target);
    fs.rmSync(candidate, { recursive: true, force: true });
    fs.renameSync(
      path.join(values.root, 'plugin', 'sd0x-dev-flow-codex', 'skills', target),
      candidate
    );
  }
  for (const target of [
    'debug', 'post-dev-test', 'refactor', 'simplify', 'test-deep', 'test-gen'
  ]) {
    const candidate = path.join(candidatesRoot, target);
    fs.rmSync(candidate, { recursive: true, force: true });
    fs.renameSync(
      path.join(values.root, 'migration', 'packs', 'development-pack', target),
      candidate
    );
  }
  const fixtureDisposition = JSON.parse(fs.readFileSync(
    path.join(values.root, 'migration', 'source-disposition.json'), 'utf8'
  ));
  const selectedUnits = new Set([
    'bug-fix/default',
    'create-request/default',
    'debug/default',
    'feature-dev/default',
    'post-dev-test/default',
    'refactor/default',
    'simplify/default',
    'test-deep/default',
    'test-gen/default'
  ]);
  for (const row of fixtureDisposition.skills) {
    if (row.delivery_state === 'candidate' &&
        !selectedUnits.has(row.promotion_unit_id)) {
      row.delivery_state = 'planned';
      row.capabilities = [];
      row.operations = [];
      row.promotion_request = null;
    }
  }
  for (const target of [
    'bug-fix', 'create-request', 'debug', 'feature-dev', 'post-dev-test',
    'refactor', 'simplify', 'test-deep', 'test-gen'
  ]) {
    const rows = fixtureDisposition.skills.filter((candidate) =>
      candidate.promotion_unit_id === `${target}/default`
    );
    assert.ok(rows.length > 0, target);
    for (const row of rows) row.delivery_state = 'candidate';
    const row = rows[0];
    const requestPath = path.join(values.root, row.promotion_request);
    const finalAudit = row.target_package === 'core' ? 'Final audit' : 'Final pack audit';
    const evidenceKind = row.target_package === 'core' ? 'promotion' : 'pack-ready';
    let normalizedRequest = fs.readFileSync(requestPath, 'utf8')
      .replace('> **Status**: Completed', '> **Status**: Candidate Complete');
    if (target !== 'create-request') {
      normalizedRequest = normalizedRequest.replace(
        /^\| Acceptance \| Complete \|.*$/m,
        `| Acceptance | Candidate Complete | ${finalAudit} and subject gates passed; runtime-owned R3 closure and ${evidenceKind} evidence remain pending. |`);
    }
    fs.writeFileSync(requestPath, normalizedRequest);
  }
  writeJson(values.root, 'migration/source-disposition.json',
    fixtureDisposition);
  fs.copyFileSync(
    path.join(ROOT, 'test', 'debug-probe-policy.test.js'),
    path.join(values.root, 'test', 'debug-probe-policy.test.js')
  );
  const debugFixtureRow = fixtureDisposition.skills.find((row) =>
    row.promotion_unit_id === 'debug/default'
  );
  assert.ok(debugFixtureRow?.promotion_request,
    'debug fixture promotion request is missing');
  const debugFixtureRequest = path.join(values.root, debugFixtureRow.promotion_request);
  const debugFixtureAudit = auditCandidate({
    root: values.root,
    candidate: 'migration/candidates/debug',
    target: 'debug'
  });
  const debugFixtureMarkdown = fs.readFileSync(debugFixtureRequest, 'utf8');
  assert.match(debugFixtureMarkdown, /Preflight `[0-9a-f]{64}`/);
  fs.writeFileSync(debugFixtureRequest, debugFixtureMarkdown.replace(
    /Preflight `[0-9a-f]{64}`/,
    `Preflight \`${debugFixtureAudit.audit_fingerprint}\``
  ));

  const baseline = auditActiveCandidates({ root: values.root });
  assert.equal(baseline.ok, true);
  assert.equal(baseline.candidates, 9);
  assert.deepEqual(baseline.units.map((unit) => unit.promotion_unit_id), [
    'bug-fix/default',
    'create-request/default',
    'debug/default',
    'feature-dev/default',
    'post-dev-test/default',
    'refactor/default',
    'simplify/default',
    'test-deep/default',
    'test-gen/default'
  ]);

  const debugRequest = path.join(values.root, 'docs', 'features',
    'skill-toolkit-migration', 'requests', '2026-07-15-wave3-debug-pack-ready.md');
  let originalRequest = fs.readFileSync(debugRequest, 'utf8');
  const debugBaseline = baseline.units.find((unit) =>
    unit.promotion_unit_id === 'debug/default');
  const validateDebugRequest = (request) => validateCandidateRequestEvidence(
    request,
    debugBaseline,
    'docs/features/skill-toolkit-migration/requests/2026-07-15-wave3-debug-pack-ready.md'
  );
  assert.throws(() => validateCandidateRequestEvidence(originalRequest, {
    ...debugBaseline,
    payload_tree_sha256: '0'.repeat(64)
  }, 'docs/features/skill-toolkit-migration/requests/2026-07-15-wave3-debug-pack-ready.md'),
  /candidate payload evidence mismatch for debug\/default/);
  assert.doesNotThrow(() => validateDebugRequest(originalRequest.replace(
    '## Progress',
    'Benign paragraph <!-- inline note --> remains rendered.\n\n## Progress'
  )));
  fs.writeFileSync(debugRequest, originalRequest.replace(
    /Preflight `[0-9a-f]{64}`/,
    `Preflight \`${'0'.repeat(64)}\``
  ));
  assert.throws(() => auditActiveCandidates({ root: values.root }),
    /candidate preflight evidence mismatch for debug\/default/);
  fs.writeFileSync(debugRequest, originalRequest);

  const forgedProgress = originalRequest
    .replace('| Development | Complete |', '| Development | Pending |')
    .replace('| Testing | Complete |', '| Testing | Pending |') + [
      '',
      '```md',
      originalRequest.split('\n').find((line) => line.startsWith('| Development | Complete |')),
      originalRequest.split('\n').find((line) => line.startsWith('| Testing | Complete |')),
      '```',
      ''
    ].join('\n');
  assert.throws(() => validateDebugRequest(forgedProgress),
    /requires one Complete Development progress row/);

  const progressStart = originalRequest.indexOf('## Progress');
  const progressEnd = originalRequest.indexOf('## References', progressStart);
  const progressSection = originalRequest.slice(progressStart, progressEnd);
  const withoutRenderedProgress = originalRequest.slice(0, progressStart) +
    originalRequest.slice(progressEnd);
  assert.throws(() => validateDebugRequest(
    `${withoutRenderedProgress}\n\`\`\`md\n${progressSection}\`\`\`\n`),
    /requires one Progress section/);
  assert.throws(() => validateDebugRequest(
    `${withoutRenderedProgress}\nparagraph\r\`\`\`md\n${progressSection}\`\`\`\n`),
    /requires one Progress section/);
  assert.throws(() => validateDebugRequest(
    `${withoutRenderedProgress}\n\`\`\`md\nnoise\n\`\`\`\f\n${progressSection}`),
    /requires one Progress section/);
  assert.throws(() => validateDebugRequest(
    `${withoutRenderedProgress}\n<!--\n${progressSection}-->\n`),
    /requires one Progress section/);
  assert.throws(() => validateDebugRequest(
    `${withoutRenderedProgress}\n${progressSection.split('\n')
      .map((line) => `    ${line}`).join('\n')}`),
    /requires one Progress section/);
  assert.throws(() => validateDebugRequest(
    `${withoutRenderedProgress}\n- Evidence\n${progressSection.split('\n')
      .map((line) => `  ${line}`).join('\n')}`),
    /requires one Progress section/);
  assert.throws(() => validateDebugRequest(
    `${withoutRenderedProgress}\n<div>\n${progressSection}</div>\n`),
    /requires one Progress section/);
  assert.throws(() => validateDebugRequest(
    `${withoutRenderedProgress}\n<div>\n\f\n${progressSection}</div>\n`),
    /requires one Progress section/);
  for (const hiddenProgress of [
    `<script>\n${progressSection}</script>`,
    `<script>\n</script >\n${progressSection}</script>`,
    `<?sd0x-hidden\n${progressSection}?>`,
    `<!SD0X-HIDDEN\n${progressSection}>`,
    `<![CDATA[\n${progressSection}]]>`
  ]) {
    assert.throws(() => validateDebugRequest(
      `${withoutRenderedProgress}\n${hiddenProgress}\n`),
      /requires one Progress section/);
  }
  assert.throws(() => validateDebugRequest(
    `${withoutRenderedProgress}\n${progressSection.split('\n')
      .map((line) => `<!-- hidden -->${line}`).join('\n')}`),
    /requires one Progress section/);
  assert.throws(() => validateDebugRequest(
    `${withoutRenderedProgress}\nparagraph<!-- hidden\n-->${progressSection}`),
    /requires one Progress section/);

  const supplementalTest = path.join(values.root, 'test', 'debug-probe-policy.test.js');
  const originalSupplementalTest = fs.readFileSync(supplementalTest);
  fs.appendFileSync(supplementalTest, '\n// supplemental evidence drift\n');
  const supplementalRegistryPath = path.join(
    values.root, 'scripts', 'supplemental-behavior-tests.json'
  );
  const originalSupplementalRegistry = fs.readFileSync(supplementalRegistryPath);
  const supplementalRegistry = JSON.parse(originalSupplementalRegistry.toString('utf8'));
  supplementalRegistry.units['debug/default'].sha256 = crypto.createHash('sha256')
    .update(fs.readFileSync(supplementalTest)).digest('hex');
  fs.writeFileSync(supplementalRegistryPath,
    `${JSON.stringify(supplementalRegistry, null, 2)}\n`);
  assert.throws(() => auditCandidate({
    root: values.root,
    candidate: 'migration/candidates/debug',
    target: 'debug'
  }), /supplemental trusted module differs from its pinned implementation/);
  fs.writeFileSync(supplementalTest, originalSupplementalTest);
  fs.writeFileSync(supplementalRegistryPath, originalSupplementalRegistry);

  assert.throws(() => selectActiveCandidatePayload({
    promotionUnitId: 'debug/default',
    targetPackage: 'development-pack',
    candidatePath: 'migration/candidates/debug',
    targetPath: 'migration/packs/development-pack/debug',
    candidatePopulated: true,
    targetPopulated: true
  }), /candidate and final pack require exactly one populated payload/);

  let completionMutation = false;
  assert.throws(() => auditActiveCandidates({
    root: values.root,
    afterActiveCandidateCompletion({ candidate }) {
      if (completionMutation || candidate !== 'migration/candidates/test-gen') return;
      completionMutation = true;
      fs.appendFileSync(supplementalTest, '\n// final revalidation drift\n');
    }
  }), /active candidate repository identity changed after completion revalidation/);

  fs.writeFileSync(supplementalTest, originalSupplementalTest);
  const raceTree = git(values.root, ['write-tree'], { encoding: 'utf8' }).trim();
  const raceOid = git(values.root, [
    'commit-tree', raceTree, '-m', 'concurrent evidence advance'
  ], { encoding: 'utf8' }).trim();
  const evidenceRef = 'refs/sd0x-dev-flow-codex/evidence/v1';
  assert.throws(() => auditActiveCandidates({
    root: values.root,
    afterActiveCandidateCompletion({ candidate }) {
      if (candidate !== 'migration/candidates/test-gen') return;
      git(values.root, ['update-ref', evidenceRef, raceOid]);
    }
  }), /active candidate evidence ref changed after completion revalidation/);
  git(values.root, ['update-ref', '-d', evidenceRef, raceOid]);

  const coreCandidate = path.join(values.root, 'migration', 'candidates', 'bug-fix');
  const coreTarget = path.join(
    values.root, 'plugin', 'sd0x-dev-flow-codex', 'skills', 'bug-fix'
  );
  fs.rmSync(coreTarget, { recursive: true, force: true });
  fs.renameSync(coreCandidate, coreTarget);

  const packCandidate = path.join(values.root, 'migration', 'candidates', 'debug');
  const packTarget = path.join(
    values.root, 'migration', 'packs', 'development-pack', 'debug'
  );
  fs.mkdirSync(path.dirname(packTarget), { recursive: true });
  fs.renameSync(packCandidate, packTarget);
  fs.writeFileSync(debugRequest, originalRequest.replace(
    / Final pack audit `[0-9a-f]{64}` passed\./,
    ''
  ));
  const debugMoveWindowAudit = auditActiveCandidates({ root: values.root })
    .units.find((unit) => unit.promotion_unit_id === 'debug/default');
  assert.ok(debugMoveWindowAudit?.audit_fingerprint,
    'debug move-window audit identity is missing');
  originalRequest = originalRequest.replace(
    /Final pack audit `[0-9a-f]{64}`/,
    `Final pack audit \`${debugMoveWindowAudit.audit_fingerprint}\``
  );
  fs.writeFileSync(debugRequest, originalRequest);
  const moveWindows = auditActiveCandidates({ root: values.root });
  assert.equal(moveWindows.units.find((unit) =>
    unit.promotion_unit_id === 'bug-fix/default').lifecycle, 'move-window');
  assert.equal(moveWindows.units.find((unit) =>
    unit.promotion_unit_id === 'debug/default').lifecycle, 'move-window');

  fs.writeFileSync(debugRequest, originalRequest.replace(
    /Final pack audit `[0-9a-f]{64}`/,
    `Final pack audit \`${'0'.repeat(64)}\``
  ));
  assert.throws(() => auditActiveCandidates({ root: values.root }),
    /candidate final audit evidence mismatch for debug\/default/);
  fs.writeFileSync(debugRequest, originalRequest);
  fs.writeFileSync(debugRequest, originalRequest.replace(
    / Final pack audit `[0-9a-f]{64}` passed\./,
    ''
  ));
  assert.equal(auditActiveCandidates({ root: values.root }).units.find((unit) =>
    unit.promotion_unit_id === 'debug/default').lifecycle, 'move-window');
  fs.writeFileSync(debugRequest, originalRequest);
  for (const downgradedStatus of ['Complete', 'Pending']) {
    fs.writeFileSync(debugRequest, originalRequest
      .replace('| Acceptance | Candidate Complete |',
        `| Acceptance | ${downgradedStatus} |`)
      .replace(/ Final pack audit `[0-9a-f]{64}` passed\./, ''));
    assert.throws(() => auditActiveCandidates({ root: values.root }),
      /candidate evidence has unsupported Acceptance status/);
    fs.writeFileSync(debugRequest, originalRequest);
  }

  const bugFixRequest = path.join(values.root, 'docs', 'features',
    'skill-toolkit-migration', 'requests', '2026-07-15-wave3-bug-fix-promotion.md');
  const originalBugFixRequest = fs.readFileSync(bugFixRequest, 'utf8');
  fs.writeFileSync(bugFixRequest, originalBugFixRequest.replace(
    /Final audit `[0-9a-f]{64}`/,
    `Final audit \`${'0'.repeat(64)}\``
  ));
  assert.throws(() => auditActiveCandidates({ root: values.root }),
    /candidate final audit evidence mismatch for bug-fix\/default/);
  fs.writeFileSync(bugFixRequest, originalBugFixRequest);
  fs.writeFileSync(bugFixRequest, originalBugFixRequest.replace(
    / Final audit `[0-9a-f]{64}` passed\./,
    ''
  ));
  assert.equal(auditActiveCandidates({ root: values.root }).units.find((unit) =>
    unit.promotion_unit_id === 'bug-fix/default').lifecycle, 'move-window');
  fs.writeFileSync(bugFixRequest, originalBugFixRequest);

  const completedDebugRequest = originalRequest
    .replace('> **Status**: Candidate Complete', '> **Status**: Completed')
    .replace(/^\| Acceptance \| Candidate Complete \|.*$/m,
      '| Acceptance | Complete | Durable closure fixture. |');
  const subjectState = recordPassingGates(values.root, 'active-candidate-subject');
  const subject = {
    kind: 'dirty',
    fingerprint: subjectState.worktree.fingerprint,
    head_sha: git(values.root, ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  };
  const pending = prepareRequestClosure(values.root, {
    promotion_unit_id: 'debug/default',
    request_path: path.relative(values.root, debugRequest).split(path.sep).join('/'),
    proposed_request: completedDebugRequest,
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
        verdicts: Array.from({
          length: (completedDebugRequest.match(/^- \[x\] /gm) || []).length
        }, (_, index) => ({
          ac: index + 1,
          status: 'Complete',
          confidence: 'High',
          evidence: ['AGENTS.md:1']
        }))
      },
      checks: { commands: [{ argv: ['node', '--test'], exit_code: 0 }] }
    },
    recorded_at: '2026-07-24T01:00:00.000Z',
    supersedes_record_sha256: null
  });
  applyRequestClosure(values.root, {
    pending_record_sha256: pending.record_sha256
  });
  recordPassingGates(values.root, 'active-candidate-docs');
  finalizeRequestClosure(values.root, {
    pending_record_sha256: pending.record_sha256,
    recorded_at: '2026-07-24T01:01:00.000Z',
    supersedes_record_sha256: null
  });
  let evidenceOidCaptures = 0;
  assert.equal(auditActiveCandidates({
    root: values.root,
    evidenceAuditHooks: {
      afterOidCapture() {
        evidenceOidCaptures += 1;
      }
    }
  }).ok, true);
  assert.equal(evidenceOidCaptures, 1,
    'Completed candidate closures must share one evidence history walk');

  const debugMoveWindow = moveWindows.units.find((unit) =>
    unit.promotion_unit_id === 'debug/default');
  const debugValidation = {
    ...debugMoveWindow,
    move_window: true,
    target_package: 'development-pack',
    audit_fingerprint: debugMoveWindow.final_audit_fingerprint
  };
  assert.throws(() => validateCandidateRequestEvidence(
    completedDebugRequest,
    { ...debugValidation, promotion_unit_id: 'test-deep/default' },
    path.relative(values.root, debugRequest).split(path.sep).join('/'),
    { root: values.root }
  ), /Evidence has no request closure for test-deep\/default/);
  assert.throws(() => validateCandidateRequestEvidence(
    completedDebugRequest,
    debugValidation,
    path.relative(values.root, bugFixRequest).split(path.sep).join('/'),
    { root: values.root }
  ), /Evidence completion mismatch for request_path/);

  const closedDebugRequest = fs.readFileSync(debugRequest);
  fs.appendFileSync(debugRequest, '\n> **Status**: Candidate Complete\n');
  assert.throws(() => auditActiveCandidates({ root: values.root }),
    /Current request no longer matches durable completion evidence/);
  fs.writeFileSync(debugRequest, closedDebugRequest);
  fs.appendFileSync(debugRequest, '\npost-closure tamper\n');
  assert.throws(() => auditActiveCandidates({ root: values.root }),
    /Current request no longer matches durable completion evidence/);
  fs.writeFileSync(debugRequest, closedDebugRequest);

});
