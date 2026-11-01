'use strict';

const {
  assert,
  fs,
  path,
  spawnSync,
  test,
  auditCandidate,
  auditSource,
  validateDistribution,
  validateRequestDag,
  refreshState,
  snapshotWorktree,
  commit,
  git,
  copy,
  fixtureRoot,
  ROOT,
  requestDocumentCount,
  readJson,
  writeJson,
  prepareRow,
  recordPassingGates,
  writeCandidate
} = require('../helpers/migration-context');

test('pack-final audit binds moved bytes, gates, and pack-ready lifecycle', (t) => {
  const values = fixtureRoot();
  t.after(() => fs.rmSync(values.workspace, { recursive: true, force: true }));
  const prepared = prepareRow(values.root, 'architecture');
  const relative = writeCandidate(values.root, {
    target: 'architecture',
    sourceNames: ['architecture'],
    targetPackage: 'planning-pack',
    unit: 'architecture/default'
  });
  const preflight = auditCandidate({
    root: values.root,
    candidate: relative,
    target: 'architecture'
  });
  const finalRelative = 'migration/packs/planning-pack/architecture';
  fs.rmSync(path.join(values.root, finalRelative), { recursive: true, force: true });
  fs.mkdirSync(path.dirname(path.join(values.root, finalRelative)), { recursive: true });
  fs.renameSync(path.join(values.root, relative), path.join(values.root, finalRelative));
  fs.symlinkSync('missing-candidate', path.join(values.root, relative));
  assert.throws(() => auditCandidate({
    root: values.root,
    candidate: finalRelative,
    target: 'architecture',
    preflightFingerprint: preflight.audit_fingerprint
  }), /moved candidate residue must be a real directory/);
  fs.rmSync(path.join(values.root, relative), { force: true });
  copy(path.join(values.root, finalRelative), path.join(values.root, relative));
  assert.throws(() => auditCandidate({
    root: values.root,
    candidate: finalRelative,
    target: 'architecture',
    preflightFingerprint: preflight.audit_fingerprint
  }), /moved payload cannot retain a populated candidate directory/);
  fs.rmSync(path.join(values.root, relative), { recursive: true, force: true });
  assert.throws(() => auditCandidate({
    root: values.root,
    candidate: finalRelative,
    target: 'architecture',
    preflightFingerprint: preflight.audit_fingerprint
  }), /review pass/);
  recordPassingGates(values.root, 'pack-final');
  assert.throws(() => auditCandidate({
    root: values.root,
    candidate: finalRelative,
    target: 'architecture',
    preflightFingerprint: preflight.audit_fingerprint,
    beforeSourceTransactionRevalidation() {
      fs.mkdirSync(path.join(values.root, relative), { recursive: true });
      fs.writeFileSync(path.join(values.root, relative, 'late-ignored.log'), 'late\n');
    }
  }), /moved candidate residue changed during final audit/);
  fs.rmSync(path.join(values.root, relative), { recursive: true, force: true });
  const final = auditCandidate({
    root: values.root,
    candidate: finalRelative,
    target: 'architecture',
    preflightFingerprint: preflight.audit_fingerprint
  });
  assert.equal(final.phase, 'pack-final');
  assert.equal(final.payload_tree_sha256, preflight.payload_tree_sha256);

  const skillPath = path.join(values.root, finalRelative, 'SKILL.md');
  const skill = fs.readFileSync(skillPath);
  fs.appendFileSync(skillPath, '\nchanged after move\n');
  recordPassingGates(values.root, 'pack-mutated');
  assert.throws(() => auditCandidate({
    root: values.root,
    candidate: finalRelative,
    target: 'architecture',
    preflightFingerprint: preflight.audit_fingerprint
  }), /exact matching preflight fingerprint/);
  fs.writeFileSync(skillPath, skill);

  const disposition = readJson(values.root, 'migration/source-disposition.json');
  disposition.skills.find((row) => row.source_name === 'architecture').delivery_state = 'pack-ready';
  writeJson(values.root, 'migration/source-disposition.json', disposition);
  copy(path.join(values.root, finalRelative), path.join(values.root, relative));
  assert.throws(() => validateDistribution(values.root, disposition),
    /delivered target cannot retain a populated candidate directory/);
  fs.rmSync(path.join(values.root, relative), { recursive: true, force: true });
  const ownerPath = path.join(values.root, prepared.promotion_request);
  fs.writeFileSync(ownerPath, fs.readFileSync(ownerPath, 'utf8')
    .replace(/^> \*\*Status\*\*: .*$/m, '> **Status**: Completed')
    .replace(/- \[ \]/g, '- [x]'));
  recordPassingGates(values.root, 'pack-ready');
  assert.equal(auditCandidate({
    root: values.root,
    candidate: finalRelative,
    target: 'architecture',
    preflightFingerprint: preflight.audit_fingerprint
  }).phase, 'pack-final');
});

test('moving a core candidate changes audit identity and final audit requires fresh gates', (t) => {
  const values = fixtureRoot();
  t.after(() => fs.rmSync(values.workspace, { recursive: true, force: true }));
  fs.rmSync(path.join(
    values.root,
    'plugin/sd0x-dev-flow-codex/skills/req-analyze'
  ), { recursive: true, force: true });
  const prepared = prepareRow(values.root, 'req-analyze');
  const relative = writeCandidate(values.root, {
    target: 'req-analyze',
    sourceNames: ['req-analyze'],
    targetPackage: 'core',
    unit: 'req-analyze/default'
  });
  const preflight = auditCandidate({
    root: values.root,
    candidate: relative,
    target: 'req-analyze'
  });
  fs.appendFileSync(path.join(values.root, relative, 'SKILL.md'), '\n');
  const freshPreflight = auditCandidate({
    root: values.root,
    candidate: relative,
    target: 'req-analyze'
  });
  assert.notEqual(freshPreflight.audit_fingerprint, preflight.audit_fingerprint);
  recordPassingGates(values.root, 'preflight');
  const finalRelative = 'plugin/sd0x-dev-flow-codex/skills/req-analyze';
  fs.renameSync(path.join(values.root, relative), path.join(values.root, finalRelative));
  copy(path.join(values.root, finalRelative), path.join(values.root, relative));
  assert.throws(() => auditCandidate({
    root: values.root,
    candidate: finalRelative,
    target: 'req-analyze',
    preflightFingerprint: freshPreflight.audit_fingerprint
  }), /moved payload cannot retain a populated candidate directory/);
  fs.rmSync(path.join(values.root, relative), { recursive: true, force: true });
  assert.throws(() => auditCandidate({
    root: values.root,
    candidate: finalRelative,
    target: 'req-analyze',
    preflightFingerprint: preflight.audit_fingerprint
  }), /review pass/);
  assert.equal(refreshState(values.root).gates.review.status, 'pending');
  recordPassingGates(values.root, 'final');
  assert.throws(() => auditCandidate({
    root: values.root,
    candidate: finalRelative,
    target: 'req-analyze',
    preflightFingerprint: preflight.audit_fingerprint
  }), /exact matching preflight fingerprint/);
  assert.throws(() => auditCandidate({
    root: values.root,
    candidate: finalRelative,
    target: 'req-analyze',
    preflightFingerprint: '0'.repeat(64)
  }), /exact matching preflight fingerprint/);
  const stateModule = require('../../plugin/sd0x-dev-flow-codex/scripts/runtime/state');
  const originalRefreshState = stateModule.refreshState;
  const finalSkillPath = path.join(values.root, finalRelative, 'SKILL.md');
  const finalSkillBytes = fs.readFileSync(finalSkillPath);
  let refreshCalls = 0;
  stateModule.refreshState = function refreshWithConcurrentEdit(root) {
    refreshCalls += 1;
    if (refreshCalls === 2) fs.appendFileSync(finalSkillPath, '\nconcurrent edit\n');
    return originalRefreshState(root);
  };
  try {
    assert.throws(() => auditCandidate({
      root: values.root,
      candidate: finalRelative,
      target: 'req-analyze',
      preflightFingerprint: freshPreflight.audit_fingerprint
    }), /worktree changed while validation was running/);
  } finally {
    stateModule.refreshState = originalRefreshState;
    fs.writeFileSync(finalSkillPath, finalSkillBytes);
  }
  recordPassingGates(values.root, 'final-after-concurrent-edit');
  const final = auditCandidate({
    root: values.root,
    candidate: finalRelative,
    target: 'req-analyze',
    preflightFingerprint: freshPreflight.audit_fingerprint
  });
  assert.equal(final.phase, 'final');
  assert.notEqual(final.audit_fingerprint, freshPreflight.audit_fingerprint);
  assert.equal(final.payload_tree_sha256, freshPreflight.payload_tree_sha256);

  const disposition = readJson(values.root, 'migration/source-disposition.json');
  disposition.skills.find((row) => row.source_name === 'req-analyze').delivery_state = 'promoted';
  writeJson(values.root, 'migration/source-disposition.json', disposition);
  copy(path.join(values.root, finalRelative), path.join(values.root, relative));
  assert.throws(() => validateDistribution(values.root, disposition),
    /delivered target cannot retain a populated candidate directory/);
  fs.rmSync(path.join(values.root, relative), { recursive: true, force: true });
  const ownerPath = path.join(values.root, prepared.promotion_request);
  fs.writeFileSync(ownerPath, fs.readFileSync(ownerPath, 'utf8')
    .replace(/^> \*\*Status\*\*: .*$/m, '> **Status**: Completed')
    .replace(/- \[ \]/g, '- [x]'));
  recordPassingGates(values.root, 'promoted-reaudit');
  const promoted = auditCandidate({
    root: values.root,
    candidate: finalRelative,
    target: 'req-analyze',
    preflightFingerprint: freshPreflight.audit_fingerprint
  });
  assert.equal(promoted.phase, 'final');
});

test('request DAG rejects cycles, invalid bases, supersession errors, and downstream owners', (t) => {
  const values = fixtureRoot();
  t.after(() => fs.rmSync(values.workspace, { recursive: true, force: true }));
  const disposition = readJson(values.root, 'migration/source-disposition.json');
  assert.equal(validateRequestDag(values.root, disposition).requests,
    requestDocumentCount(values.root));
  const deep = path.join(values.root,
    'docs/features/skill-toolkit-migration/requests/2026-07-14-wave1-tech-spec-deep-promotion.md');
  const deepOriginal = fs.readFileSync(deep, 'utf8');
  assert.match(deepOriginal,
    /\*\*Depends On\*\*: \[Wave 1 Tech-Spec Core Promotion\]\(\.\/2026-07-14-wave1-tech-spec-promotion\.md\)/);
  for (const request of fs.readdirSync(path.dirname(deep))
    .filter((name) => /^2026-07-14-wave1-.*\.md$/.test(name))) {
    const markdown = fs.readFileSync(path.join(path.dirname(deep), request), 'utf8');
    assert.doesNotMatch(markdown, /immediately after docs review/);
    assert.match(markdown,
      /after docs review and fresh deterministic verification on the resulting Completed-request fingerprint/);
  }
  fs.writeFileSync(deep, deepOriginal.replace(/^> \*\*Depends On\*\*:.*\n/m, ''));
  assert.throws(() => validateRequestDag(values.root, disposition),
    /tech-spec\/deep: mode gate owner must depend on tech-spec\/default/);
  fs.writeFileSync(deep, deepOriginal);
  const r1 = path.join(values.root,
    'docs/features/skill-toolkit-migration/requests/2026-07-10-skill-migration-foundation-r1.md');
  const original = fs.readFileSync(r1, 'utf8');
  const requestAuditRejects = (pattern) => {
    assert.throws(() => validateRequestDag(values.root, disposition), pattern);
    assert.throws(() => auditSource({ root: values.root }), pattern);
    assert.throws(() => auditCandidate({
      root: values.root,
      candidate: 'migration/candidates/architecture',
      target: 'architecture'
    }), pattern);
  };
  fs.writeFileSync(r1, original
    .replace(/^> \*\*Status\*\*:.*\n/m, '')
    .replace(/^> \*\*Implementation Base SHA\*\*:.*\n/m, '')
    .replace('## Background',
      '## Background\n\n> **Status**: Completed\n> **Implementation Base SHA**: `0b24525489ee3be9413ebf0d81e140eeadcc3fe7`'));
  requestAuditRejects(/canonical request metadata is invalid: missing-status/);
  fs.writeFileSync(r1, original.replace(
    /^> \*\*Status\*\*:.*$/m,
    '> **Status**: Banana'
  ));
  requestAuditRejects(/canonical request metadata is invalid: invalid-status/);
  fs.writeFileSync(r1, original);
  const concurrentRequest = path.join(path.dirname(r1),
    '2026-07-14-concurrent-added-request.md');
  const additionOptions = () => {
    let added = false;
    return {
      afterRequestRead() {
        if (added) return;
        fs.writeFileSync(concurrentRequest, original);
        added = true;
      }
    };
  };
  assert.throws(() => validateRequestDag(values.root, disposition, additionOptions()),
    /request file set changed while validating the DAG/);
  fs.rmSync(concurrentRequest);
  assert.throws(() => auditSource({
    root: values.root,
    requestDag: additionOptions()
  }), /request file set changed while validating the DAG/);
  fs.rmSync(concurrentRequest);
  assert.throws(() => auditCandidate({
    root: values.root,
    candidate: 'migration/candidates/architecture',
    target: 'architecture',
    requestDag: additionOptions()
  }), /request file set changed while validating the DAG/);
  fs.rmSync(concurrentRequest);
  const mutationOptions = () => ({
    afterRequestRead({ relative }) {
      if (relative.endsWith('2026-07-10-skill-migration-foundation-r1.md')) {
        fs.writeFileSync(r1, original);
      }
    }
  });
  const missingStatus = original.replace(/^> \*\*Status\*\*:.*\n/m, '');
  fs.writeFileSync(r1, missingStatus);
  assert.throws(() => validateRequestDag(values.root, disposition, mutationOptions()),
    /canonical request metadata is invalid: missing-status/);
  fs.writeFileSync(r1, missingStatus);
  assert.throws(() => auditSource({
    root: values.root,
    requestDag: mutationOptions()
  }), /canonical request metadata is invalid: missing-status/);
  fs.writeFileSync(r1, missingStatus);
  assert.throws(() => auditCandidate({
    root: values.root,
    candidate: 'migration/candidates/architecture',
    target: 'architecture',
    requestDag: mutationOptions()
  }), /canonical request metadata is invalid: missing-status/);
  fs.writeFileSync(r1, original);
  const r4Name = './2026-07-10-skill-alias-capability-r4.md';
  fs.writeFileSync(r1, original.replace(
    '> **Tech Spec**:',
    `> **Depends On**: [R4](${r4Name})\n> **Tech Spec**:`
  ));
  assert.throws(() => validateRequestDag(values.root, disposition), /dependency cycle/);
  fs.writeFileSync(r1, original.replace(/`[0-9a-f]{40}`/, '`0000000000000000000000000000000000000000`'));
  assert.throws(() => validateRequestDag(values.root, disposition),
    /canonical request metadata is invalid: missing-implementation-base-commit/);
  const nonSuperseded = original.replace(
    /^> \*\*Status\*\*: .*$/m,
    '> **Status**: Pending'
  );
  fs.writeFileSync(r1, nonSuperseded.replace(
    '> **Tech Spec**:',
    `> **Superseded By**: [R4](${r4Name})\n> **Tech Spec**:`
  ));
  assert.throws(() => validateRequestDag(values.root, disposition), /requires Superseded status/);
  fs.writeFileSync(r1, original);

  const architecture = disposition.skills.find((row) => row.source_name === 'architecture');
  architecture.promotion_request =
    'docs/features/skill-toolkit-migration/requests/2026-07-10-skill-migration-foundation-r1.md';
  assert.throws(() => validateRequestDag(values.root, disposition), /gate owner cannot be downstream/);
});

test('source and candidate transactions bind clean HEAD and post-source changes', (t) => {
  const sourceValues = fixtureRoot();
  const candidateValues = fixtureRoot();
  t.after(() => fs.rmSync(sourceValues.workspace, { recursive: true, force: true }));
  t.after(() => fs.rmSync(candidateValues.workspace, { recursive: true, force: true }));

  git(sourceValues.root, ['add', '-A']);
  commit(sourceValues.root, 'clean source fixture');
  assert.equal(snapshotWorktree(sourceValues.root).fingerprint, 'clean');
  assert.throws(() => auditSource({
    root: sourceValues.root,
    beforeSourceSnapshotRevalidation() {
      const agentsPath = path.join(sourceValues.root, 'AGENTS.md');
      fs.writeFileSync(agentsPath, fs.readFileSync(agentsPath, 'utf8')
        .replace('sd0x-skill-migration-boundary:v2', 'removed-boundary'));
      git(sourceValues.root, ['add', 'AGENTS.md']);
      commit(sourceValues.root, 'concurrent source change');
    }
  }), /source repository identity changed while auditing/);

  prepareRow(candidateValues.root, 'architecture');
  const candidateRelative = writeCandidate(candidateValues.root, {
    target: 'architecture',
    sourceNames: ['architecture'],
    targetPackage: 'planning-pack',
    unit: 'architecture/default'
  });
  assert.throws(() => auditCandidate({
    root: candidateValues.root,
    candidate: candidateRelative,
    target: 'architecture',
    afterSourceAudit() {
      const disposition = readJson(candidateValues.root, 'migration/source-disposition.json');
      disposition.skills.find((row) => row.source_name === 'statusline-config')
        .delivery_state = 'bogus';
      writeJson(candidateValues.root, 'migration/source-disposition.json', disposition);
    }
  }), /source snapshot changed while auditing|candidate repository identity changed while auditing/);
});

test('source transaction binds the delivered-evidence ref OID', (t) => {
  const values = fixtureRoot({ copyEvidenceRef: true });
  t.after(() => fs.rmSync(values.workspace, { recursive: true, force: true }));
  const evidenceRef = 'refs/sd0x-dev-flow-codex/evidence/v1';
  const originalOid = git(values.root, ['rev-parse', evidenceRef], { encoding: 'utf8' }).trim();
  const parentOid = git(values.root, ['rev-parse', `${originalOid}^`], { encoding: 'utf8' }).trim();
  assert.notEqual(parentOid, originalOid);
  assert.throws(() => auditSource({
    root: values.root,
    beforeSourceSnapshotRevalidation() {
      git(values.root, ['update-ref', evidenceRef, parentOid, originalOid]);
    }
  }), /evidence ref changed while auditing source/);
  git(values.root, ['update-ref', evidenceRef, originalOid, parentOid]);
  assert.throws(() => auditSource({
    root: values.root,
    beforeCompletionEvidenceSnapshot() {
      git(values.root, ['update-ref', evidenceRef, parentOid, originalOid]);
    },
    afterCompletionEvidenceSnapshot(snapshot) {
      assert.equal(snapshot.oid, parentOid);
      git(values.root, ['update-ref', evidenceRef, originalOid, parentOid]);
    }
  }), /source evidence ref changed while completion owners were selected/);
});

test('candidate transaction retains source external state and tree manifests', (t) => {
  const treeValues = fixtureRoot();
  const stagingValues = fixtureRoot();
  const evidenceValues = fixtureRoot({ copyEvidenceRef: true });
  const identityValues = fixtureRoot();
  const ignoredValues = fixtureRoot();
  for (const values of [
    treeValues, stagingValues, evidenceValues, identityValues, ignoredValues
  ]) {
    t.after(() => fs.rmSync(values.workspace, { recursive: true, force: true }));
    prepareRow(values.root, 'architecture');
    values.candidate = writeCandidate(values.root, {
      target: 'architecture',
      sourceNames: ['architecture'],
      targetPackage: 'planning-pack',
      unit: 'architecture/default'
    });
  }

  assert.throws(() => auditCandidate({
    root: treeValues.root,
    candidate: treeValues.candidate,
    target: 'architecture',
    afterCandidateTreeRead({ directory }) {
      fs.writeFileSync(path.join(directory, 'concurrent-extra.log'), 'late\n');
    }
  }), /candidate tree manifest changed while auditing/);

  assert.throws(() => auditCandidate({
    root: stagingValues.root,
    candidate: stagingValues.candidate,
    target: 'architecture',
    beforeSourceTransactionRevalidation() {
      fs.writeFileSync(path.join(stagingValues.root,
        'migration/staging/post-source-extra.log'), 'late\n');
    }
  }), /migration staging manifest changed while auditing/);

  const evidenceRef = 'refs/sd0x-dev-flow-codex/evidence/v1';
  const originalOid = git(evidenceValues.root, ['rev-parse', evidenceRef], {
    encoding: 'utf8'
  }).trim();
  const parentOid = git(evidenceValues.root, ['rev-parse', `${originalOid}^`], {
    encoding: 'utf8'
  }).trim();
  assert.throws(() => auditCandidate({
    root: evidenceValues.root,
    candidate: evidenceValues.candidate,
    target: 'architecture',
    beforeSourceTransactionRevalidation() {
      git(evidenceValues.root, ['update-ref', evidenceRef, parentOid, originalOid]);
    }
  }), /evidence ref changed while auditing source/);

  assert.throws(() => auditCandidate({
    root: identityValues.root,
    candidate: identityValues.candidate,
    target: 'architecture',
    beforeSourceTransactionRevalidation() {
      const disposition = readJson(identityValues.root, 'migration/source-disposition.json');
      disposition.skills.find((row) => row.source_name === 'architecture').rationale +=
        ' Concurrent mutation.';
      writeJson(identityValues.root, 'migration/source-disposition.json', disposition);
    }
  }), /source snapshot changed while auditing|source repository identity changed while auditing/);

  assert.throws(() => auditCandidate({
    root: ignoredValues.root,
    candidate: ignoredValues.candidate,
    target: 'architecture',
    beforeSourceTransactionRevalidation() {
      fs.writeFileSync(path.join(
        ignoredValues.root,
        ignoredValues.candidate,
        'late-ignored.log'
      ), 'late\n');
    }
  }), /candidate tree manifest changed while auditing/);
});

test('audit CLI fails unknown modes', () => {
  const failure = spawnSync(process.execPath, [
    path.join(ROOT, 'scripts', 'skill-migration-audit.js'),
    'unknown'
  ], { cwd: ROOT, encoding: 'utf8' });
  assert.notEqual(failure.status, 0);
  assert.match(failure.stderr, /usage/);
});
