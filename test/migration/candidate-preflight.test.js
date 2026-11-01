'use strict';

const {
  assert,
  crypto,
  fs,
  os,
  path,
  spawnSync,
  test,
  auditCandidate,
  semanticActiveContractBlock,
  semanticContractBlock,
  semanticTestSource,
  trustedSemanticContract,
  git,
  copy,
  fixtureRoot,
  readJson,
  writeJson,
  childTestEnvironment,
  prepareRow,
  writeCandidate
} = require('../helpers/migration-context');

test('candidate preflight validates contract, resources, routing, tables, and operations', (t) => {
  const values = fixtureRoot();
  t.after(() => fs.rmSync(values.workspace, { recursive: true, force: true }));
  prepareRow(values.root, 'architecture');
  const relative = writeCandidate(values.root, {
    target: 'architecture',
    sourceNames: ['architecture'],
    targetPackage: 'planning-pack',
    unit: 'architecture/default'
  });
  const result = auditCandidate({
    root: values.root,
    candidate: relative,
    target: 'architecture'
  });
  assert.equal(result.phase, 'preflight');
  assert.equal(result.virtual_target,
    'separate-plugin/planning-pack/skills/architecture');

  const contractPath = path.join(values.root, relative, 'migration-contract.json');
  const originalContract = fs.readFileSync(contractPath, 'utf8');
  const incompatibleContract = JSON.parse(originalContract);
  incompatibleContract.schema_version = 2;
  fs.writeFileSync(contractPath, `${JSON.stringify(incompatibleContract, null, 2)}\n`);
  assert.throws(() => auditCandidate({
    root: values.root,
    candidate: relative,
    target: 'architecture'
  }), /schema_version must be 1 or 3 for planning-pack/);
  fs.writeFileSync(contractPath, originalContract);

  const supplementalPath = 'test/architecture-supplemental.test.js';
  const supplementalHelperPath = 'test/architecture-supplemental-helper.js';
  const supplementalHelper = "'use strict';\nmodule.exports = 1;\n";
  fs.writeFileSync(path.join(values.root, supplementalHelperPath), supplementalHelper);
  fs.writeFileSync(path.join(values.root, supplementalPath), [
    "'use strict';",
    '// sd0x-migration-supplemental-test target=architecture unit=architecture/default',
    "const assert = require('node:assert/strict');",
    "const test = require('node:test');",
    "const supplementalFixture = require('./architecture-supplemental-helper.js');",
    "test('trusted supplemental fixture', () => {",
    '  assert.equal(supplementalFixture, 1);',
    '});',
    ''
  ].join('\n'));
  const versionedContract = JSON.parse(originalContract);
  versionedContract.units[0].supplemental_behavior_tests = [supplementalPath];
  fs.writeFileSync(contractPath, `${JSON.stringify(versionedContract, null, 2)}\n`);
  assert.throws(() => auditCandidate({
    root: values.root,
    candidate: relative,
    target: 'architecture'
  }), /contract fields must exactly equal/);
  versionedContract.schema_version = 3;
  delete versionedContract.units[0].supplemental_behavior_tests;
  fs.writeFileSync(contractPath, `${JSON.stringify(versionedContract, null, 2)}\n`);
  assert.throws(() => auditCandidate({
    root: values.root,
    candidate: relative,
    target: 'architecture'
  }), /contract fields must exactly equal/);
  versionedContract.units[0].supplemental_behavior_tests = [supplementalPath];
  const supplementalRegistryPath = path.join(
    values.root, 'scripts', 'supplemental-behavior-tests.json'
  );
  const supplementalRegistry = JSON.parse(
    fs.readFileSync(supplementalRegistryPath, 'utf8')
  );
  supplementalRegistry.units['architecture/default'] = {
    path: supplementalPath,
    sha256: crypto.createHash('sha256')
      .update(fs.readFileSync(path.join(values.root, supplementalPath))).digest('hex')
  };
  supplementalRegistry.units = Object.fromEntries(
    Object.entries(supplementalRegistry.units).sort(([left], [right]) =>
      Buffer.from(left).compare(Buffer.from(right)))
  );
  fs.writeFileSync(supplementalRegistryPath,
    `${JSON.stringify(supplementalRegistry, null, 2)}\n`);
  fs.writeFileSync(contractPath, `${JSON.stringify(versionedContract, null, 2)}\n`);
  const supplementalBaseline = auditCandidate({
    root: values.root,
    candidate: relative,
    target: 'architecture'
  });
  assert.equal(supplementalBaseline.ok, true);
  fs.writeFileSync(path.join(values.root, supplementalHelperPath),
    supplementalHelper.replace('1', '2'));
  const supplementalHelperDrift = auditCandidate({
    root: values.root,
    candidate: relative,
    target: 'architecture'
  });
  assert.notEqual(supplementalHelperDrift.audit_fingerprint,
    supplementalBaseline.audit_fingerprint);
  fs.writeFileSync(path.join(values.root, supplementalHelperPath), supplementalHelper);

  const sideEffect = path.join(values.root, 'supplemental-side-effect');
  const helperPath = path.join(values.root, 'test', 'supplemental-helper.js');
  const moduleHelperPath = path.join(values.root, 'test', 'supplemental-helper.mjs');
  const bareHeader = [
    "'use strict';",
    '// sd0x-migration-supplemental-test target=architecture unit=architecture/default'
  ];
  const header = [
    ...bareHeader,
    "const assert = require('node:assert/strict');",
    "const test = require('node:test');",
    "const supplementalFixture = require('./architecture-supplemental-helper.js');",
    "test('trusted supplemental fixture', () => {",
    '  assert.equal(supplementalFixture, 1);',
    '});'
  ];
  const maliciousCases = [
    {
      body: [...bareHeader, 'module.exports = 1;'],
      error: /supplemental entrypoint must bind node:test exactly/
    },
    {
      body: [...bareHeader, "const assert = require('node:assert/strict');",
        "const test = require('node:test');", 'module.exports = 1;'],
      error: /must register at least one direct test/
    },
    {
      body: [...bareHeader, "const assert = require('node:assert/strict');",
        "const test = require('node:test');",
        "test('empty supplemental fixture', () => {", '});'],
      error: /callback must contain an unconditional strict assertion/
    },
    {
      body: [...bareHeader, "const assert = require('node:assert/strict');",
        "const test = require('node:test');",
        "test('non-asserting supplemental fixture', () => {",
        '  const observed = 1;',
        '  void observed;',
        '});'],
      error: /callback must contain an unconditional strict assertion/
    },
    {
      body: [...bareHeader,
        'const assert = { equal() {} };',
        "const test = require('node:test');",
        "test('shadowed assertion fixture', () => {",
        '  assert.equal(1, 1);',
        '});'],
      error: /supplemental assert binding must be exact/
    },
    {
      body: [...bareHeader,
        "const assert = require('node:assert/strict');",
        "const test = require('node:test');",
        "test('nested unreachable assertion fixture', () => {",
        '  if (false) {',
        '  assert.equal(1, 2);',
        '  }',
        '});'],
      error: /callback must contain an unconditional strict assertion/
    },
    {
      body: [...header, 'process.exit(0);'],
      error: /supplemental process use is not permitted/
    },
    {
      body: [...bareHeader,
        "const assert = require('node:assert/strict');",
        "const test = require('node:test');",
        "test('callback termination fixture', () => {",
        '  process.exit(0);',
        '  assert.equal(1, 1);',
        '});'],
      error: /supplemental process use is not permitted/
    },
    {
      body: [...bareHeader,
        "const assert = require('node:assert/strict');",
        "const test = require('node:test');",
        "test('post-return assertion fixture', () => {",
        '  return;',
        '  assert.equal(1, 2);',
        '});'],
      error: /callback must contain an unconditional strict assertion/
    },
    {
      body: [...bareHeader, "const assert = require('node:assert/strict');",
        "const test = require('node:test');",
        "if (false) test('unreachable supplemental fixture', () => {});"],
      error: /must be unconditional and top-level/
    },
    {
      body: [...bareHeader, "const assert = require('node:assert/strict');",
        "const test = require('node:test');",
        "test('skipped supplemental fixture', { skip: true }, () => {});"],
      error: /must have an exact title and callback/
    },
    {
      body: [...bareHeader, "const assert = require('node:assert/strict');",
        "const test = require('node:test');",
        "test('todo supplemental fixture', { todo: true }, () => {});"],
      error: /must have an exact title and callback/
    },
    {
      body: [
        ...bareHeader,
        "const assert = require('node:assert/strict');",
        "const test = require('node:test');",
        "const fs = require('node:fs');",
        `fs.writeFileSync(${JSON.stringify(path.join(
          values.root, supplementalHelperPath
        ))}, "'use strict';\\nmodule.exports = 2;\\n");`,
        "const trusted = require('./architecture-supplemental-helper.js');",
        "test('filesystem replacement fixture', () => {",
        '  assert.equal(trusted, 2);',
        '});'
      ],
      error: /supplemental node:fs requires a pinned supplemental module/
    },
    {
      body: [
        ...header,
        `require('node:fs').writeFileSync(${JSON.stringify(sideEffect)}, 'executed');`,
        "require('../migration/./candidates/architecture/SKILL.md');"
      ],
      error: /cannot load candidate or pack code/
    },
    {
      body: [...header, 'const load = require;',
        "load('../migration/candidates/architecture/SKILL.md');"],
      error: /aliased code loading/
    },
    {
      body: [...header,
        "require.call(null, '../migration/candidates/architecture/SKILL.md');"],
      error: /aliased code loading/
    },
    {
      body: [...header,
        "module['require']('../migration/candidates/architecture/SKILL.md');"],
      error: /(?:aliased|dynamic) code loading/
    },
    {
      body: [...header,
        "module['requ' + 'ire']('../migration/candidates/architecture/SKILL.md');"],
      error: /dynamic member access/
    },
    {
      body: [...header,
        "module.constructor._load('../migration/candidates/architecture/SKILL.md');"],
      error: /reflective code loading/
    },
    {
      body: [...header,
        "requ\\u0069re('../migration/candidates/architecture/SKILL.md');"],
      error: /escaped loader tokens/
    },
    {
      body: [...header,
        "import/* loader gap */('../migration/candidates/architecture/SKILL.md');"],
      error: /commented code loading/
    },
    {
      body: [...header,
        "arguments[1]('../migration/candidates/architecture/SKILL.md');"],
      error: /reflective code loading/
    },
    {
      body: [...header,
        "globalThis['requ' + 'ire']('../migration/candidates/architecture/SKILL.md');"],
      error: /reflective code loading/
    },
    {
      body: [...header,
        "module.exports.constructor.constructor('return process')();"],
      error: /reflective code loading/
    },
    {
      body: [...header,
        "const get = 'getBuiltin' + 'Module';",
        "const kind = 'node:mo' + 'dule';",
        "process[get](kind)._load('../migration/candidates/architecture/SKILL.md');"],
      error: /dynamic member access/
    },
    {
      body: [...header,
        "const { fork } = require('node:child_process');",
        "fork('../migration/candidates/architecture/SKILL.md');"],
      error: /unsupported subprocess capability/
    },
    {
      body: [...header,
        "test.run({ files: ['../migration/candidates/architecture/runner.js'] });"],
      error: /node:test use must be a direct test registration/
    },
    {
      body: [...header,
        "import('node:test').then(({ run }) => run({ files: ['../migration/candidates/architecture/runner.js'] }));"],
      error: /node:test binding must be exact/
    },
    {
      body: [...header,
        "require ('node:test').run({ files: ['../migration/candidates/architecture/runner.js'] });"],
      error: /node:test binding must be exact/
    },
    {
      body: [...header,
        "const { Worker } = require('node:worker_threads');",
        "new Worker('../migration/candidates/architecture/worker.js');"],
      error: /unsupported built-in or external dependency/
    },
    {
      body: [
        ...header,
        "const os = require('node:os');",
        "const { spawn } = require('node:child_process');",
        "const CLOSED_GIT_ENV = Object.freeze({ GIT_CONFIG_GLOBAL: os.devNull, GIT_CONFIG_NOSYSTEM: '1', GIT_NO_REPLACE_OBJECTS: '1', GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0' });",
        "spawn('/tmp/git', ['init', '--quiet'], { cwd: process.cwd(), env: CLOSED_GIT_ENV });"
      ],
      error: /subprocess executable must be exact/
    },
    {
      body: [
        ...header,
        "const os = require('node:os');",
        "const { spawn } = require('node:child_process');",
        "const CLOSED_GIT_ENV = Object.freeze({ GIT_CONFIG_GLOBAL: os.devNull, GIT_CONFIG_NOSYSTEM: '1', GIT_NO_REPLACE_OBJECTS: '1', GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0' });",
        "spawn('git', ['init', '--quiet'], { cwd: process.cwd(), env: CLOSED_GIT_ENV });"
      ],
      error: /subprocess executable must be exact/
    },
    {
      body: [
        ...header,
        "const os = require('node:os');",
        "const { spawn } = require('node:child_process');",
        "const CLOSED_GIT_ENV = Object.freeze({ GIT_CONFIG_GLOBAL: os.devNull, GIT_CONFIG_NOSYSTEM: '1', GIT_NO_REPLACE_OBJECTS: '1', GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0' });",
        "spawn('/usr/bin/git', ['status'], { cwd: process.cwd(), env: CLOSED_GIT_ENV });"
      ],
      error: /git subprocess argv is not trusted/
    },
    {
      body: [
        ...header,
        "const os = require('node:os');",
        "const { spawn } = require('node:child_process');",
        "const CLOSED_GIT_ENV = Object.freeze({ GIT_CONFIG_GLOBAL: os.devNull, GIT_CONFIG_NOSYSTEM: '1', GIT_NO_REPLACE_OBJECTS: '1', GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0' });",
        "function trustedGitExecutable() { return '/tmp/git'; }",
        "const TRUSTED_GIT_EXECUTABLE = trustedGitExecutable();",
        "spawn(TRUSTED_GIT_EXECUTABLE, ['--no-optional-locks', '-c', 'core.hooksPath=/dev/null', '-c', 'core.fsmonitor=false', '-c', 'submodule.recurse=false', '-c', 'pager.rev-parse=false', 'rev-parse', '--verify', 'refs/sd0x-debug-probe/missing'], { cwd: process.cwd(), env: CLOSED_GIT_ENV });"
      ],
      error: /trusted Git resolver binding is not exact/
    },
    {
      body: [
        ...header,
        "const os = require('node:os');",
        "const { spawn } = require('node:child_process');",
        "const CLOSED_GIT_ENV = Object.freeze({ GIT_CONFIG_GLOBAL: os.devNull, GIT_CONFIG_NOSYSTEM: '1', GIT_NO_REPLACE_OBJECTS: '1', GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0' });",
        "spawn('/usr/bin/git', ['add', '.gitattributes', 'tracked.txt'], { cwd: process.cwd(), env: CLOSED_GIT_ENV });"
      ],
      error: /git subprocess argv is not trusted/
    },
    {
      body: [...header, "const destination = '../migration/candidates/architecture/SKILL.md';",
        'import(destination);'],
      error: /computed code loading/
    },
    {
      body: [...header, "require('./supplemental-helper.js');"],
      helper: [
        "'use strict';",
        `require('node:fs').writeFileSync(${JSON.stringify(sideEffect)}, 'executed');`,
        "require('../migration/candidates/architecture/SKILL.md');",
        ''
      ].join('\n'),
      error: /cannot load candidate or pack code/
    },
    {
      body: [...header, "require('./supplemental-helper.js');"],
      helper: [
        "'use strict';",
        `require('node:fs').writeFileSync(${JSON.stringify(sideEffect)}, 'executed');`,
        "module.constructor._load('../migration/candidates/architecture/SKILL.md');",
        ''
      ].join('\n'),
      error: /reflective code loading/
    },
    {
      body: [...header, "require('./supplemental-helper.js');"],
      helper: [
        "'use strict';",
        `require('node:fs').writeFileSync(${JSON.stringify(sideEffect)}, 'executed');`,
        "const key = 'constr' + 'uctor';",
        "module.exports[key][key]('return process')();",
        ''
      ].join('\n'),
      error: /dynamic member access/
    },
    {
      body: [...header, "require('./supplemental-helper.js');"],
      helper: [
        "'use strict';",
        `require('node:fs').writeFileSync(${JSON.stringify(sideEffect)}, 'executed');`,
        "const { fork } = require('node:child_process');",
        "fork('../migration/candidates/architecture/SKILL.md');",
        ''
      ].join('\n'),
      error: /unsupported subprocess capability/
    },
    {
      body: [...header, "require('./supplemental-helper.js');"],
      helper: [
        "'use strict';",
        `require('node:fs').writeFileSync(${JSON.stringify(sideEffect)}, 'executed');`,
        "const { run } = require('node:test');",
        "run({ files: ['../migration/candidates/architecture/runner.js'] });",
        ''
      ].join('\n'),
      error: /node:test is only permitted in the entrypoint/
    },
    {
      body: [...header, "require('./supplemental-helper.js');"],
      helper: [
        "'use strict';",
        `require('node:fs').writeFileSync(${JSON.stringify(sideEffect)}, 'executed');`,
        "import ('node:test').then(({ run }) => run({ files: ['../migration/candidates/architecture/runner.js'] }));",
        ''
      ].join('\n'),
      error: /node:test is only permitted in the entrypoint/
    },
    {
      body: [...header, "require('./supplemental-helper.js');"],
      helper: [
        "'use strict';",
        `require('node:fs').writeFileSync(${JSON.stringify(sideEffect)}, 'executed');`,
        "import('node:test').then(({ run }) => run({ files: ['../migration/candidates/architecture/runner.js'] }));",
        ''
      ].join('\n'),
      error: /node:test is only permitted in the entrypoint/
    },
    {
      body: [...header, "require('./supplemental-helper.js');"],
      helper: [
        "'use strict';",
        `require('node:fs').writeFileSync(${JSON.stringify(sideEffect)}, 'executed');`,
        "const { Worker } = require('node:worker_threads');",
        "new Worker('../migration/candidates/architecture/worker.js');",
        ''
      ].join('\n'),
      error: /unsupported built-in or external dependency/
    },
    {
      body: [...header, "import('./supplemental-helper.mjs');"],
      moduleHelper: [
        "import fs from 'node:fs';",
        `fs.writeFileSync(${JSON.stringify(sideEffect)}, 'executed');`,
        'import candidate',
        "  from '../migration/candidates/architecture/SKILL.md';",
        'void candidate;',
        ''
      ].join('\n'),
      error: /cannot load candidate or pack code/
    }
  ];
  for (const maliciousCase of maliciousCases) {
    fs.rmSync(sideEffect, { force: true });
    fs.rmSync(helperPath, { force: true });
    fs.rmSync(moduleHelperPath, { force: true });
    const sideEffectStatement =
      `require('node:fs').writeFileSync(${JSON.stringify(sideEffect)}, 'executed');`;
    if (maliciousCase.helper) fs.writeFileSync(
      helperPath,
      maliciousCase.helper.replace(`${sideEffectStatement}\n`, '')
    );
    if (maliciousCase.moduleHelper) {
      fs.writeFileSync(
        moduleHelperPath,
        maliciousCase.moduleHelper
          .replace("import fs from 'node:fs';\n", '')
          .replace(`fs.writeFileSync(${JSON.stringify(sideEffect)}, 'executed');\n`, '')
      );
    }
    const maliciousBody = maliciousCase.body.filter((line) =>
      line !== sideEffectStatement);
    const maliciousSupplemental = `${maliciousBody.join('\n')}\n`;
    fs.writeFileSync(path.join(values.root, supplementalPath), maliciousSupplemental);
    supplementalRegistry.units['architecture/default'].sha256 = crypto.createHash('sha256')
      .update(maliciousSupplemental).digest('hex');
    fs.writeFileSync(supplementalRegistryPath,
      `${JSON.stringify(supplementalRegistry, null, 2)}\n`);
    assert.throws(() => auditCandidate({
      root: values.root,
      candidate: relative,
      target: 'architecture'
    }), maliciousCase.error);
    assert.equal(fs.existsSync(sideEffect), false);
    assert.equal(fs.readFileSync(
      path.join(values.root, supplementalHelperPath), 'utf8'
    ), supplementalHelper);
  }
  fs.rmSync(helperPath, { force: true });
  fs.rmSync(moduleHelperPath, { force: true });

  versionedContract.units[0].unknown_v3_field = true;
  fs.writeFileSync(contractPath, `${JSON.stringify(versionedContract, null, 2)}\n`);
  assert.throws(() => auditCandidate({
    root: values.root,
    candidate: relative,
    target: 'architecture'
  }), /contract fields must exactly equal/);
  fs.writeFileSync(contractPath, originalContract);

  const guidePath = path.join(values.root, relative, 'references', 'guide.md');
  const guide = fs.readFileSync(guidePath, 'utf8');
  for (const assumption of [
    'mcp__codex__codex',
    'AskUserQuestion must decide.',
    'Use the Agent tool.',
    'Invoke the Skill tool.',
    'Handle PreToolUse and SessionStart directly.',
    'Handle Notification directly.',
    'Handle the Stop event directly.',
    'Read hook_event_name from tool_input.',
    'Write .claude/settings.json and CLAUDE.md.',
    'Read .claude_review_state.json.',
    'Expand $ARGUMENTS.'
  ]) {
    fs.writeFileSync(guidePath, `${guide}\n${assumption}\n`);
    assert.throws(() => auditCandidate({
      root: values.root,
      candidate: relative,
      target: 'architecture'
    }), /candidate contains unsupported/);
  }
});

test('research-pack preflight requires exact generated semantic evidence', (t) => {
  const values = fixtureRoot();
  t.after(() => fs.rmSync(values.workspace, { recursive: true, force: true }));
  prepareRow(values.root, 'ask');
  const relative = writeCandidate(values.root, {
    target: 'ask',
    sourceNames: ['ask'],
    targetPackage: 'research-pack',
    unit: 'ask/default'
  });
  copy(
    path.join(values.root, relative),
    path.join(values.root, 'migration/packs/research-pack/ask')
  );
  assert.equal(fs.existsSync(path.join(values.root,
    'migration/packs/research-pack/ask/SKILL.md')), true);
  assert.equal(auditCandidate({
    root: values.root,
    candidate: relative,
    target: 'ask'
  }).ok, true);

  const skillPath = path.join(values.root, relative, 'SKILL.md');
  const originalSkill = fs.readFileSync(skillPath, 'utf8');
  const clause = trustedSemanticContract('ask/default').required[0];
  fs.writeFileSync(skillPath, originalSkill.replace(clause, `<!-- ${clause} -->`));
  assert.throws(() => auditCandidate({ root: values.root, candidate: relative, target: 'ask' }),
    /exact active semantic contract is missing/);
  fs.writeFileSync(skillPath, originalSkill.replace(clause, `Do not ${clause}`));
  assert.throws(() => auditCandidate({ root: values.root, candidate: relative, target: 'ask' }),
    /exact active semantic contract is missing/);
  fs.writeFileSync(skillPath, originalSkill.replace(clause,
    `This workflow does not guarantee that ${clause}`));
  assert.throws(() => auditCandidate({ root: values.root, candidate: relative, target: 'ask' }),
    /exact active semantic contract is missing/);
  fs.writeFileSync(skillPath, originalSkill.replace(clause, `Never true: ${clause}`));
  assert.throws(() => auditCandidate({ root: values.root, candidate: relative, target: 'ask' }),
    /exact active semantic contract is missing/);
  const trustedContract = trustedSemanticContract('ask/default');
  const exactBlock = semanticContractBlock('ask/default', trustedContract);
  for (const contradiction of [
    `${clause} or any other policy`,
    `${clause} is false`,
    `${clause}, or any other policy`,
    `${clause}, except when convenient`,
    `${clause}. This is false`,
    `${clause} which is false`
  ]) {
    const alteredContract = {
      ...trustedContract,
      required: trustedContract.required.map((value) => value === clause ? contradiction : value)
    };
    fs.writeFileSync(skillPath, originalSkill.replace(
      exactBlock,
      semanticContractBlock('ask/default', alteredContract)
    ));
    assert.throws(() => auditCandidate({ root: values.root, candidate: relative, target: 'ask' }),
      /exact machine-readable semantic contract is missing/);
  }
  for (const contradiction of [
    `${clause} is false`,
    `${clause} is not required`,
    `${clause} should be ignored`,
    `${clause}, except when convenient`,
    `${clause}. This is false`,
    `${clause} which is false`,
    `${clause} or not`
  ]) {
    fs.writeFileSync(skillPath, originalSkill.replace(
      clause,
      contradiction
    ));
    assert.throws(() => auditCandidate({ root: values.root, candidate: relative, target: 'ask' }),
      /exact active semantic contract is missing/);
  }
  fs.writeFileSync(skillPath, originalSkill);

  const exactActiveBlock = semanticActiveContractBlock(
    'ask/default',
    trustedSemanticContract('ask/default')
  );
  fs.writeFileSync(skillPath, originalSkill.replace(
    exactActiveBlock,
    `\`\`\`markdown\n${exactActiveBlock}\n\`\`\``
  ));
  assert.throws(() => auditCandidate({ root: values.root, candidate: relative, target: 'ask' }),
    /SKILL\.md differs from the trusted SKILL bytes/);
  for (const waiver of [
    'These requirements are optional.',
    'The managed requirements may be ignored.',
    'The semantic requirements are not required.'
  ]) {
    fs.writeFileSync(skillPath, `${originalSkill}\n${waiver}\n`);
    assert.throws(() => auditCandidate({ root: values.root, candidate: relative, target: 'ask' }),
      /SKILL\.md differs from the trusted SKILL bytes/);
  }
  fs.writeFileSync(skillPath, originalSkill);

  const contract = readJson(values.root, `${relative}/migration-contract.json`);
  contract.schema_version = 1;
  writeJson(values.root, `${relative}/migration-contract.json`, contract);
  assert.throws(() => auditCandidate({
    root: values.root,
    candidate: relative,
    target: 'ask'
  }), /schema_version must be 2 for research-pack/);
  contract.schema_version = 2;
  delete contract.units[0].semantic_requirements;
  writeJson(values.root, `${relative}/migration-contract.json`, contract);
  assert.throws(() => auditCandidate({
    root: values.root,
    candidate: relative,
    target: 'ask'
  }), /semantic_requirements/);

  contract.units[0].semantic_requirements = trustedSemanticContract('ask/default');
  writeJson(values.root, `${relative}/migration-contract.json`, contract);
  const semanticPath = path.join(values.root, 'test/ask-default-semantics.test.js');
  fs.appendFileSync(semanticPath, '\n// mutation\n');
  assert.throws(() => auditCandidate({
    root: values.root,
    candidate: relative,
    target: 'ask'
  }), /exact generated contract/);

  fs.writeFileSync(semanticPath, semanticTestSource({
    target: 'ask',
    targetPackage: 'research-pack',
    unit: 'ask/default'
  }));
  const validatorPath = path.join(values.root, relative, 'scripts/redact.js');
  fs.writeFileSync(validatorPath, "throw new Error('candidate validator executed');\n");
  const semanticRun = spawnSync(process.execPath, ['--test', semanticPath], {
    cwd: values.root,
    env: childTestEnvironment(),
    encoding: 'utf8'
  });
  assert.equal(semanticRun.status, 0, semanticRun.stderr);
  assert.throws(() => auditCandidate({
    root: values.root,
    candidate: relative,
    target: 'ask'
  }), /payload validator must equal the trusted repository validator/);
});

test('deep-explore active prose cannot narrow the exact third-wave policy', (t) => {
  const values = fixtureRoot();
  t.after(() => fs.rmSync(values.workspace, { recursive: true, force: true }));
  prepareRow(values.root, 'deep-explore');
  const relative = writeCandidate(values.root, {
    target: 'deep-explore',
    sourceNames: ['deep-explore'],
    targetPackage: 'research-pack',
    unit: 'deep-explore/default'
  });
  const skillPath = path.join(values.root, relative, 'SKILL.md');
  const original = fs.readFileSync(skillPath, 'utf8');
  for (const narrower of [
    'Default to two waves; permit a third only for unresolved cross-cutting behavior.',
    'Wave three is permitted for a cross-cutting critical gap.',
    'An extra wave is reserved for unresolved cross-cutting behavior.'
  ]) {
    fs.writeFileSync(skillPath, `${original}\n${narrower}\n`);
    assert.throws(() => auditCandidate({
      root: values.root,
      candidate: relative,
      target: 'deep-explore'
    }), /active third-wave policy contradicts/);
  }
  for (const narrower of [
    'Use a third wave for unresolved cross-cutting behavior.',
    'Wave three applies to unresolved cross-cutting behavior.',
    'Run an extra wave when unresolved cross-cutting behavior remains.'
  ]) {
    fs.writeFileSync(skillPath, `${original}\n${narrower}\n`);
    assert.throws(() => auditCandidate({
      root: values.root,
      candidate: relative,
      target: 'deep-explore'
    }), /SKILL\.md differs from the trusted SKILL bytes/);
  }
});
