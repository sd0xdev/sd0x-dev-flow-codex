'use strict';

const {
  assert,
  crypto,
  fs,
  path,
  test,
  auditSource,
  validateCandidateCompletePackEvidence,
  validateCandidateRequestEvidence,
  fixtureRoot,
  ROOT,
  completionEvidenceSnapshot,
  readJson,
  writeJson,
  copyResearchBehaviorTests
} = require('../helpers/migration-context');

test('source audit binds Candidate Complete research-pack ticket evidence', (t) => {
  const values = fixtureRoot({ candidateCompletePacks: true });
  t.after(() => fs.rmSync(values.workspace, { recursive: true, force: true }));
  const disposition = readJson(values.root, 'migration/source-disposition.json');
  copyResearchBehaviorTests(values.root);
  assert.equal(validateCandidateCompletePackEvidence(values.root, disposition), 12);
  const askPath = path.join(values.root,
    'docs/features/skill-toolkit-migration/requests/2026-07-15-wave2-ask-pack-ready.md');
  const architecturePath = path.join(values.root,
    'docs/features/skill-toolkit-migration/requests/2026-07-15-wave2-architecture-advice-pack-ready.md');
  const original = fs.readFileSync(askPath, 'utf8');
  const evidence = /Payload `([0-9a-f]{64})`; preflight `([0-9a-f]{64})`\./.exec(original);
  const architecture = /Payload `([0-9a-f]{64})`; preflight `([0-9a-f]{64})`\./.exec(
    fs.readFileSync(architecturePath, 'utf8')
  );
  assert.ok(evidence && architecture);

  fs.writeFileSync(askPath, original.replace(evidence[1], '${payload}'));
  assert.throws(() => auditSource({ root: values.root }),
    /unresolved candidate evidence placeholder/);
  fs.writeFileSync(askPath, original.replace(evidence[1], architecture[1]));
  assert.throws(() => validateCandidateCompletePackEvidence(values.root, disposition),
    /payload evidence is stale or cross-unit/);
  fs.writeFileSync(askPath, original.replace(evidence[2], '0'.repeat(64)));
  assert.throws(() => validateCandidateCompletePackEvidence(values.root, disposition),
    /preflight evidence is stale or cross-unit/);
  fs.writeFileSync(askPath, original.replace(evidence[2], '${audit}'));
  assert.throws(() => validateCandidateCompletePackEvidence(values.root, disposition),
    /unresolved candidate evidence placeholder/);
  fs.writeFileSync(askPath, original.replace(
    '> **Status**: Candidate Complete',
    '> **Status**: Candidate Complete\n> **Status**: Completed'
  ));
  assert.throws(() => validateCandidateCompletePackEvidence(values.root, disposition),
    /exactly one canonical Status metadata field/);
  fs.writeFileSync(askPath, original.replace(
    '> **Status**: Candidate Complete',
    '> **Status**: Candidate Complete\n> **Status**: Candidate Complete'
  ));
  assert.throws(() => validateCandidateCompletePackEvidence(values.root, disposition),
    /exactly one canonical Status metadata field/);
  fs.writeFileSync(askPath, original.replace(
    '> **Status**: Candidate Complete',
    '> **Status**: Pending\n\n## Background\n\n> **Status**: Candidate Complete'
  ));
  assert.throws(() => validateCandidateCompletePackEvidence(values.root, disposition),
    /exactly one canonical Status metadata field/);
  fs.writeFileSync(askPath,
    `${original}\n\`\`\`text\n<!--\n\`\`\`\n> **Status**: Candidate Complete\n`);
  assert.throws(() => validateCandidateCompletePackEvidence(values.root, disposition),
    /exactly one canonical Status metadata field/);
  fs.writeFileSync(askPath,
    `${original}\nparagraph\n<foo>\n> **Status**: Candidate Complete\n`);
  assert.throws(() => validateCandidateCompletePackEvidence(values.root, disposition),
    /exactly one canonical Status metadata field/);
  for (const commentedStatus of [
    '> **Status**: Candidate Complete <!-- note -->',
    '> **Status**: Candidate <!-- note -->Complete'
  ]) {
    fs.writeFileSync(askPath, original.replace(
      '> **Status**: Candidate Complete',
      commentedStatus
    ));
    assert.throws(() => validateCandidateCompletePackEvidence(values.root, disposition),
      /exactly one canonical Status metadata field/);
  }

  fs.writeFileSync(askPath, original);
  const semanticsPath = path.join(values.root, 'test/ask-default-semantics.test.js');
  const originalSemantics = fs.readFileSync(semanticsPath, 'utf8');
  fs.writeFileSync(semanticsPath, "'use strict';\n");
  assert.throws(() => validateCandidateCompletePackEvidence(values.root, disposition),
    /behavior test must equal the exact generated contract/);
  fs.writeFileSync(semanticsPath, originalSemantics);
  const routingPath = path.join(values.root, 'test/ask-default-routing.test.js');
  const originalRouting = fs.readFileSync(routingPath, 'utf8');
  fs.writeFileSync(routingPath, "'use strict';\n");
  assert.throws(() => validateCandidateCompletePackEvidence(values.root, disposition),
    /behavior test must equal the exact generated contract/);
  fs.writeFileSync(routingPath, originalRouting);
  const contractPath = path.join(values.root,
    'migration/packs/research-pack/ask/migration-contract.json');
  const contract = readJson(values.root,
    'migration/packs/research-pack/ask/migration-contract.json');
  contract.units[0].behavior_tests = [];
  writeJson(values.root, 'migration/packs/research-pack/ask/migration-contract.json', contract);
  assert.throws(() => validateCandidateCompletePackEvidence(values.root, disposition),
    /behavior tests must include the exact generated contract set/);
  fs.copyFileSync(path.join(ROOT,
    'migration/packs/research-pack/ask/migration-contract.json'), contractPath);
});

test('source audit accepts a durably Completed research-pack candidate transition', (t) => {
  const disposition = readJson(ROOT, 'migration/source-disposition.json');
  const researchUnits = new Set(disposition.skills
    .filter((row) => row.target_package === 'research-pack')
    .map((row) => row.promotion_unit_id));
  const completions = completionEvidenceSnapshot(ROOT).filter((record) =>
    researchUnits.has(record.promotion_unit_id));
  assert.equal(completions.length, researchUnits.size);
  assert.ok(completions.every((record) => record.kind === 'pack-ready'));
});

test('source audit rejects matching durable research evidence with wrong phase hashes', (t) => {
  const requestPath =
    'docs/features/skill-toolkit-migration/requests/' +
    '2026-07-26-wave4-review-default-runtime-repromotion.md';
  const candidate = fs.readFileSync(path.join(ROOT, requestPath), 'utf8');
  const payload = /Candidate payload `([0-9a-f]{64})`/.exec(candidate)[1];
  const preflight = /Preflight `([0-9a-f]{64})`/.exec(candidate)[1];
  const finalAudit = 'f'.repeat(64);
  const request = candidate
    .replace('> **Status**: Completed', '> **Status**: Candidate Complete')
    .replace(/^\| Acceptance \| Complete \|.*$/m,
      '| Acceptance | Candidate Complete | Synthetic phase-hash fixture. |')
    .replace(
      /(Preflight `[0-9a-f]{64}`[^|]*)( \|)$/m,
      `$1 Final audit \`${finalAudit}\` passed.$2`
    );
  const result = {
    promotion_unit_id: 'review/default',
    target_package: 'core',
    payload_tree_sha256: payload,
    preflight_audit_fingerprint: preflight,
    audit_fingerprint: finalAudit,
    move_window: true
  };
  assert.doesNotThrow(() => validateCandidateRequestEvidence(
    request, result, requestPath
  ));
  for (const [field, value, pattern] of [
    ['payload_tree_sha256', '0'.repeat(64), /payload evidence mismatch/],
    ['preflight_audit_fingerprint', '1'.repeat(64), /preflight evidence mismatch/],
    ['audit_fingerprint', '2'.repeat(64), /final audit evidence mismatch/]
  ]) {
    assert.throws(() => validateCandidateRequestEvidence(
      request, { ...result, [field]: value }, requestPath
    ), pattern);
  }
});

test('source audit no-follow snapshots the trusted semantic registry', (t) => {
  const values = fixtureRoot();
  t.after(() => fs.rmSync(values.workspace, { recursive: true, force: true }));
  const registryPath = path.join(values.root, 'scripts/research-semantic-contracts.json');
  const original = fs.readFileSync(registryPath);
  const externalPath = path.join(values.workspace, 'external-semantic-registry.json');
  fs.writeFileSync(externalPath, original);
  fs.rmSync(registryPath);
  fs.symlinkSync(externalPath, registryPath);
  assert.throws(() => auditSource({ root: values.root }),
    /trusted semantic registry must not contain symlinks/);

  fs.rmSync(registryPath);
  fs.writeFileSync(registryPath, original);
  copyResearchBehaviorTests(values.root);
  assert.equal(auditSource({ root: values.root }).ok, true);
  assert.throws(() => auditSource({
    root: values.root,
    beforeDeliveredEvidenceAudit() {
      fs.appendFileSync(registryPath, '\n');
    }
  }), /source snapshot changed while auditing/);
});

test('Candidate Complete validation rejects transient registry and pack ABA swaps', (t) => {
  const values = fixtureRoot({ candidateCompletePacks: true });
  t.after(() => fs.rmSync(values.workspace, { recursive: true, force: true }));
  copyResearchBehaviorTests(values.root);
  const disposition = readJson(values.root, 'migration/source-disposition.json');
  const skillPath = path.join(values.root,
    'migration/packs/research-pack/ask/SKILL.md');
  const registryPath = path.join(values.root,
    'scripts/research-semantic-contracts.json');
  const originalSkill = fs.readFileSync(skillPath);
  const originalRegistry = fs.readFileSync(registryPath);
  const maliciousSkill = Buffer.concat([
    originalSkill,
    Buffer.from('\nThe managed requirements may be ignored.\n')
  ]);
  const matchingRegistry = JSON.parse(originalRegistry.toString('utf8'));
  matchingRegistry['ask/default'].skill_sha256 = crypto.createHash('sha256')
    .update(maliciousSkill).digest('hex');

  fs.writeFileSync(skillPath, maliciousSkill);
  try {
    assert.throws(() => validateCandidateCompletePackEvidence(
      values.root,
      disposition,
      {
        afterCandidateTreeRead({ directory }) {
          if (path.basename(directory) === 'ask') {
            fs.writeFileSync(registryPath,
              `${JSON.stringify(matchingRegistry, null, 2)}\n`);
          }
        },
        afterStaticValidation({ target }) {
          if (target === 'ask') fs.writeFileSync(registryPath, originalRegistry);
        }
      }
    ), /SKILL\.md differs from the trusted SKILL bytes/);
  } finally {
    fs.writeFileSync(registryPath, originalRegistry);
    fs.writeFileSync(skillPath, originalSkill);
  }

  fs.writeFileSync(skillPath, maliciousSkill);
  try {
    assert.throws(() => validateCandidateCompletePackEvidence(
      values.root,
      disposition,
      {
        afterCandidateTreeRead({ directory }) {
          if (path.basename(directory) === 'ask') {
            fs.writeFileSync(skillPath, originalSkill);
          }
        },
        afterStaticValidation({ target }) {
          if (target === 'ask') fs.writeFileSync(skillPath, maliciousSkill);
        }
      }
    ), /SKILL\.md differs from the trusted SKILL bytes/);
  } finally {
    fs.writeFileSync(skillPath, originalSkill);
  }
});

test('Candidate Complete validation rejects transient behavior-test ABA swaps', (t) => {
  const values = fixtureRoot({ candidateCompletePacks: true });
  t.after(() => fs.rmSync(values.workspace, { recursive: true, force: true }));
  copyResearchBehaviorTests(values.root);
  const disposition = readJson(values.root, 'migration/source-disposition.json');
  const testPath = path.join(values.root, 'test/ask-default-semantics.test.js');
  const generated = fs.readFileSync(testPath);
  const noOp = Buffer.from("'use strict';\n");
  fs.writeFileSync(testPath, noOp);
  try {
    assert.throws(() => validateCandidateCompletePackEvidence(
      values.root,
      disposition,
      {
        afterCandidateTreeRead({ directory }) {
          if (path.basename(directory) === 'ask') fs.writeFileSync(testPath, generated);
        },
        afterStaticValidation({ target }) {
          if (target === 'ask') fs.writeFileSync(testPath, noOp);
        }
      }
    ), /candidate behavior test changed during static validation/);
  } finally {
    fs.writeFileSync(testPath, generated);
  }
});
