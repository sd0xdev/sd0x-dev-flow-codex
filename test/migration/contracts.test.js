'use strict';

const {
  assert,
  fs,
  os,
  path,
  spawnSync,
  test,
  markdownTableColumns,
  completeAcceptanceCriteria,
  dependencyLink,
  renderContract,
  formalPlan,
  commit,
  git,
  fixtureRoot,
  ROOT,
  activeReviewSkillPath,
  readJson
} = require('../helpers/migration-context');

test('Markdown table column counting ignores escaped cell pipes', () => {
  assert.equal(markdownTableColumns('| Pattern | Regex |'), 2);
  assert.equal(markdownTableColumns('| Rule | `a\\|b\\|c` |'), 2);
  assert.equal(markdownTableColumns('| Rule | `a\\\\|b` | Extra |'), 4);
});

test('prepared contracts declare their observed sensitive operations', () => {
  const contract = renderContract({
    target: 'fixture',
    target_package: 'core',
    operations: ['read', 'pr-write', 'local-write', 'push'],
    units: [{
      promotion_unit_id: 'fixture/default',
      target_mode: null,
      source_names: ['fixture'],
      routing: { positive_triggers: ['fixture'], negative_boundaries: ['other'] }
    }]
  });
  assert.deepEqual(contract.authorization.sensitive_operations,
    ['pr-write', 'push']);
});

test('formal plugin promotion plan follows active core replacement owners', () => {
  const disposition = {
    skills: [
      {
        delivery_state: 'candidate',
        target_package: 'core',
        target_skill: 'deep-research',
        promotion_unit_id: 'deep-research/default'
      },
      {
        delivery_state: 'candidate',
        target_package: 'research-pack',
        target_skill: 'ask',
        promotion_unit_id: 'ask/default'
      },
      {
        delivery_state: 'promoted',
        target_package: 'core',
        target_skill: 'review',
        promotion_unit_id: 'review/default'
      }
    ]
  };
  assert.deepEqual(formalPlan(disposition), {
    targets: [{
      target: 'deep-research',
      target_package: 'core',
      units: [{ promotion_unit_id: 'deep-research/default' }]
    }]
  });
});

test('wave request dependencies bind their rendered title and path together', () => {
  const request =
    'docs/features/skill-toolkit-migration/requests/generated-request.md';
  assert.equal(dependencyLink({
    title: 'Formal Plugin Delivery Model',
    path: './2026-07-28-formal-plugin-delivery-model.md'
  }, request), '[Formal Plugin Delivery Model](./2026-07-28-formal-plugin-delivery-model.md)');
  assert.throws(() => dependencyLink(
    './2026-07-28-formal-plugin-delivery-model.md', request
  ), /exact \{title, path\}/);
  assert.throws(() => dependencyLink({
    title: 'R4 — Alias Registry Capability',
    path: './2026-07-28-formal-plugin-delivery-model.md'
  }, request), /title does not match the referenced request H1/);
});

test('every configured wave dependency resolves its exact request H1', () => {
  const plans = readJson(ROOT, 'scripts/skill-wave-plans.json');
  for (const [wave, plan] of Object.entries(plans.waves)) {
    const request =
      `docs/features/skill-toolkit-migration/requests/generated-wave-${wave}.md`;
    assert.equal(
      dependencyLink(plan.dependency, request),
      `[${plan.dependency.title}](${plan.dependency.path})`
    );
  }
});

test('migration fixtures reject command-scope Git configuration overrides', () => {
  const script = [
    "const fs = require('node:fs');",
    "const path = require('node:path');",
    "const { commit, git } = require('./test/helpers/git');",
    "const { fixtureRoot } = require('./test/helpers/migration-fixture');",
    'const values = fixtureRoot();',
    'try {',
    "  fs.writeFileSync(path.join(values.root, 'fixture-commit.txt'), 'fixture\\n');",
    "  git(values.root, ['add', 'fixture-commit.txt']);",
    "  commit(values.root, 'fixture identity');",
    '  process.stdout.write(JSON.stringify({',
    "    email: git(values.root, ['config', 'user.email'], { encoding: 'utf8' }).trim(),",
    "    name: git(values.root, ['config', 'user.name'], { encoding: 'utf8' }).trim(),",
    "    hooksPath: git(values.root, ['config', 'core.hooksPath'], { encoding: 'utf8' }).trim(),",
    "    localEmail: git(values.root, ['config', '--local', 'user.email'],",
    "      { encoding: 'utf8' }).trim(),",
    "    localHooksPath: git(values.root, ['config', '--local', 'core.hooksPath'],",
    "      { encoding: 'utf8' }).trim(),",
    "    author: git(values.root, ['show', '-s', '--format=%an <%ae>', 'HEAD'],",
    "      { encoding: 'utf8' }).trim(),",
    "    committer: git(values.root, ['show', '-s', '--format=%cn <%ce>', 'HEAD'],",
    "      { encoding: 'utf8' }).trim()",
    '  }));',
    '} finally {',
    '  fs.rmSync(values.workspace, { recursive: true, force: true });',
    '}'
  ].join('\n');
  const externalWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-git-config-'));
  const externalConfig = path.join(externalWorkspace, 'ambient.gitconfig');
  const externalBytes = '[user]\n\temail = external@example.com\n';
  fs.writeFileSync(externalConfig, externalBytes);
  try {
    for (const hostile of [
      {
        GIT_CONFIG_COUNT: '3',
        GIT_CONFIG_KEY_0: 'user.email',
        GIT_CONFIG_VALUE_0: 'hostile@example.com',
        GIT_CONFIG_KEY_1: 'user.name',
        GIT_CONFIG_VALUE_1: 'Hostile',
        GIT_CONFIG_KEY_2: 'core.hooksPath',
        GIT_CONFIG_VALUE_2: '/tmp/hostile-hooks'
      },
      {
        GIT_CONFIG_PARAMETERS:
          "'user.email=parameters@example.com' 'user.name=Parameters' " +
          "'core.hooksPath=/tmp/parameters-hooks'",
        GIT_AUTHOR_NAME: 'Ambient Author',
        GIT_AUTHOR_EMAIL: 'ambient-author@example.com',
        GIT_COMMITTER_NAME: 'Ambient Committer',
        GIT_COMMITTER_EMAIL: 'ambient-committer@example.com'
      },
      { GIT_CONFIG: externalConfig }
    ]) {
      const result = spawnSync(process.execPath, ['-e', script], {
        cwd: ROOT,
        encoding: 'utf8',
        env: { ...process.env, ...hostile }
      });
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const actual = JSON.parse(result.stdout);
      assert.equal(actual.email, 'test@example.com');
      assert.equal(actual.name, 'Test');
      assert.match(actual.hooksPath, /\.git\/sd0x-test-hooks$/);
      assert.equal(actual.localEmail, 'test@example.com');
      assert.match(actual.localHooksPath, /\.git\/sd0x-test-hooks$/);
      assert.equal(actual.author, 'Test <test@example.com>');
      assert.equal(actual.committer, 'Test <test@example.com>');
    }
    assert.equal(fs.readFileSync(externalConfig, 'utf8'), externalBytes);
  } finally {
    fs.rmSync(externalWorkspace, { recursive: true, force: true });
  }
});

test('Candidate Complete criteria cannot claim final audit or durable closure', () => {
  const candidateCriteria = [
    '# Request',
    '',
    '## Acceptance Criteria',
    '',
    '- [ ] Candidate preserves the complete fixture workflow and its meaningful failure boundaries.',
    '- [ ] Contract binds every assigned source name to this single canonical promotion unit.',
    '- [ ] Compatibility aliases remain mapping-only and add no discovered skill entrypoints.',
    '- [ ] Trusted routing tests distinguish positive prompts from adjacent skill boundaries.',
    '- [ ] Candidate preflight binds exact payload and behavioral-test identity.',
    '- [ ] Final pack destination and move-window comparison are fixed.',
    '- [ ] R3 closure inputs identify this exact request, promotion unit, evidence kind, and final-fingerprint fields.',
    '',
    '## Progress',
    ''
  ].join('\n').replace(
    'Final pack destination and move-window comparison are fixed.',
    'Final pack destination and move-window comparison are fixed for the accepted candidate bytes.'
  );
  const completed = completeAcceptanceCriteria(candidateCriteria, 'fixture.md');
  assert.equal((completed.match(/^- \[x\] /gm) || []).length, 7);
  for (const futureClaim of [
    '- [ ] The final quality-pack artifact has completed its source audit.',
    '- [ ] The completion ledger now binds this request.',
    '- [ ] Final pack destination and move-window comparison are not fixed for the accepted candidate bytes.',
    '- [ ] R3 completion inputs identify this exact request, promotion unit, evidence kind, and final-fingerprint fields.'
  ]) {
    assert.throws(() => completeAcceptanceCriteria(
      candidateCriteria.replace(
        '- [ ] Candidate preserves the complete fixture workflow and its meaningful failure boundaries.',
        futureClaim
      ),
      'fixture.md'
    ), /must exactly match the Candidate Complete stage contract/);
  }
});

test('Wave 4 review payload retains the executable strict gate contract', () => {
  const entrypoint = activeReviewSkillPath();
  const review = fs.readFileSync(entrypoint, 'utf8');
  assert.ok(review.includes('[review theory](references/review-theory.md)'));
  assert.ok(review.includes('[the gate protocol](references/default.md)'));
  const protocol = fs.readFileSync(path.join(
    path.dirname(entrypoint), 'references/default.md'
  ), 'utf8');
  for (const required of [
    'review/provider.js',
    'review/snapshot.js',
    'review/round.js',
    'review/gate.js',
    'node "<plugin-root>/scripts/runtime/runner.js"',
    'sd0x_codex_primary_reviewer',
    'No actionable findings remain.'
  ]) {
    assert.match(protocol, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.doesNotMatch(review + protocol, /sd0x_test_reviewer/);
});

test('Wave 4 non-default review modes have explicit no-gate execution contracts', () => {
  const review = fs.readFileSync(activeReviewSkillPath(), 'utf8');
  const modes = [
    {
      name: 'fast',
      required: [
        /staged and unstaged diff/i,
        /do not run project checks/i,
        /Re-run the canonical snapshot check/i,
        /preliminary/i
      ]
    },
    {
      name: 'full',
      required: [
        /non-mutating local build, lint, or test checks/i,
        /Re-run the canonical snapshot check/i
      ]
    },
    {
      name: 'branch',
      required: [
        /compute the merge base/i,
        /merge-base-to-HEAD\s+commit range/i,
        /Exclude\s+dirty\s+worktree-only changes/i,
        /Re-resolve the comparison base, merge base, and HEAD after review/i,
        /reject fingerprint\s+drift/i
      ]
    },
    {
      name: 'deep',
      required: [
        /Re-run the canonical snapshot check/i
      ]
    }
  ];
  for (let index = 0; index < modes.length; index += 1) {
    const mode = modes[index];
    const start = review.indexOf(`### \`${mode.name}\``);
    const next = index + 1 < modes.length
      ? review.indexOf(`### \`${modes[index + 1].name}\``, start)
      : review.indexOf('\nRepository completion always requires', start);
    assert.notEqual(start, -1, mode.name);
    assert.notEqual(next, -1, mode.name);
    const section = review.slice(start, next);
    for (const pattern of mode.required) assert.match(section, pattern);
    assert.doesNotMatch(section, /(?:round|gate)\.js/);
  }
  assert.match(review, /Non-default modes[\s\S]*`round\.js` and `gate\.js`\s+wrappers are excluded/i);
  assert.match(review,
    /run\s+`node "<plugin-root>\/scripts\/runtime\/runner\.js"[\s\S]*review\/snapshot\.js[\s\S]*Discard the reviewer output/i);
});

test('CI and release fetch transferable evidence and subject history refs', () => {
  for (const relative of [
    '.github/workflows/ci.yml',
    '.github/workflows/release.yml'
  ]) {
    const workflow = fs.readFileSync(path.join(ROOT, relative), 'utf8');
    assert.match(workflow, /uses: actions\/checkout@[^\n]+\n\s+with:\n\s+fetch-depth: 0/);
    const evidenceFetch = workflow.indexOf(
      '+refs/sd0x-dev-flow-codex/evidence/v1:refs/sd0x-dev-flow-codex/evidence/v1'
    );
    const subjectFetch = workflow.indexOf(
      '+refs/sd0x-dev-flow-codex/subjects/*:refs/sd0x-dev-flow-codex/subjects/*'
    );
    const check = workflow.indexOf('npm run check');
    assert.ok(evidenceFetch >= 0 && subjectFetch > evidenceFetch && check > subjectFetch,
      `${relative} must fetch evidence and subject refs before npm run check`);
  }
});
