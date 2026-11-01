'use strict';

const {
  assert,
  fs,
  path,
  test,
  auditCandidateStatic,
  fixtureRoot,
  prepareRow,
  writeCandidate
} = require('../helpers/migration-context');

test('core candidate trusts only byte-identical inherited runtime resources', (t) => {
  const values = fixtureRoot();
  t.after(() => fs.rmSync(values.workspace, { recursive: true, force: true }));
  prepareRow(values.root, 'codex-code-review', {
    operations: ['local-write', 'read']
  });
  const relative = writeCandidate(values.root, {
    target: 'review',
    sourceNames: ['codex-code-review'],
    targetPackage: 'core',
    unit: 'review/default',
    body: 'Review changes with the [guide](references/guide.md). The [gate wrapper](scripts/gate.js) records evidence.'
  });
  const candidateScripts = path.join(values.root, relative, 'scripts');
  fs.cpSync(
    path.join(values.root, 'plugin/sd0x-dev-flow-codex/skills/review/scripts'),
    candidateScripts,
    { recursive: true }
  );

  assert.deepEqual(auditCandidateStatic({
    root: values.root,
    candidate: relative,
    target: 'review'
  }), {
    ok: true,
    observed_operations: ['read']
  });

  const candidateSkill = path.join(values.root, relative, 'SKILL.md');
  const originalSkill = fs.readFileSync(candidateSkill, 'utf8');
  for (const command of [
    'mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\'',
    'mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":[]}\''
  ]) {
    fs.writeFileSync(candidateSkill, `${originalSkill}\nRun \`${command}\`.\n`);
    assert.deepEqual(auditCandidateStatic({
      root: values.root,
      candidate: relative,
      target: 'review'
    }), {
      ok: true,
      observed_operations: ['local-write', 'read']
    });
  }
  for (const opener of ['```', '```bash']) {
    const block = [
      opener,
      'mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\'',
      '```'
    ].join('\n');
    fs.writeFileSync(candidateSkill, `${originalSkill}\n${block}\n`);
    assert.deepEqual(auditCandidateStatic({
      root: values.root,
      candidate: relative,
      target: 'review'
    }), {
      ok: true,
      observed_operations: ['local-write', 'read']
    }, opener);
  }
  for (const body of [
    `${originalSkill}\nRun \`node "<this-skill-directory>/scripts/gate.js"\`.\n`,
    `${originalSkill}\nRun \`mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/not-installed.js","cwd":"<repository-root>","args":["pass"]}\'\`.\n`,
    `${originalSkill}\nRun \`mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"other/gate.js","cwd":"<repository-root>","args":["pass"]}\'\`.\n`,
    `${originalSkill}\nRun \`mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":".","args":["pass"]}\'\`.\n`,
    `${originalSkill}\nRun \`mcp__sd0x_skill_runtime__run_skill_script \'${JSON.stringify({
      entrypoint: 'review/gate.js',
      cwd: '<repository-root>',
      args: Array(65).fill('pass')
    })}\'\`.\n`,
    ...['command', 'exec', 'builtin', 'nohup'].map((wrapper) =>
      `${originalSkill}\nRun \`${wrapper} mcp__sd0x_skill_runtime__run_skill_script ` +
      `\'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\'\`.\n`
    ),
    `${originalSkill}\nRun \`/absolute-node-executable "<this-skill-directory>/scripts/gate.js"\`.\n`
  ]) {
    fs.writeFileSync(candidateSkill, body);
    assert.throws(() => auditCandidateStatic({
      root: values.root,
      candidate: relative,
      target: 'review'
    }), /(?:undeclared operation: connector-write|unsupported shell executable in redirect command)/,
    body);
  }
  const safeOptionPreamble = [
    '```bash',
    'left=a',
    'right=b',
    'set -euo pipefail',
    '[[ "$left" > "$right" ]] || true',
    'printf \'%s\\n\' \'>\' "$right"',
    'printf \'%s\\n\' \\>node',
    'printf \'%s\\n\' ready 2>&1',
    'mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\'',
    '```'
  ].join('\n');
  fs.writeFileSync(candidateSkill, `${originalSkill}\n${safeOptionPreamble}\n`);
  assert.deepEqual(auditCandidateStatic({
    root: values.root,
    candidate: relative,
    target: 'review'
  }), {
    ok: true,
    observed_operations: ['local-write', 'read']
  });
  for (const command of [
    '"/absolute-node-executable" --require "<this-skill-directory>/scripts/gate.js" /tmp/untrusted.js',
    '"/absolute-node-executable" -r "<this-skill-directory>/scripts/gate.js" /tmp/untrusted.js',
    '"/absolute-node-executable" --loader "<this-skill-directory>/scripts/gate.js" /tmp/untrusted.mjs',
    '"/absolute-node-executable" --import "<this-skill-directory>/scripts/gate.js" /tmp/untrusted.mjs',
    '"/absolute-node-executable" --test "<this-skill-directory>/scripts/provider.js"',
    '/tmp/node "<this-skill-directory>/scripts/gate.js"',
    './node "<this-skill-directory>/scripts/gate.js"',
    'NODE_OPTIONS=--require=/tmp/untrusted.js mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\'',
    'NODE_PATH=/tmp/untrusted mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\'',
    'env NODE_OPTIONS=--require=/tmp/untrusted.js mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\'',
    'env NODE_PATH=/tmp/untrusted mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\''
  ]) {
    fs.writeFileSync(candidateSkill, `${originalSkill}\nRun \`${command}\`.\n`);
    assert.throws(() => auditCandidateStatic({
      root: values.root,
      candidate: relative,
      target: 'review'
    }), /(?:undeclared operation: connector-write|unsupported.*environment|unsupported shell executable in redirect command)/,
    command);
  }
  const evalCommand = '"/absolute-node-executable" --eval "<this-skill-directory>/scripts/provider.js"';
  fs.writeFileSync(candidateSkill, `${originalSkill}\nRun \`${evalCommand}\`.\n`);
  assert.throws(() => auditCandidateStatic({
    root: values.root,
    candidate: relative,
    target: 'review'
  }), /(?:fragmented Git\/GitHub executable text|undeclared operation: connector-write)/,
  evalCommand);
  for (const command of [
    'NODE_OPTIONS="$NODE_PRELOAD" mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\'',
    'env NODE_OPTIONS="${NODE_PRELOAD}" mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\'',
    'NODE_PATH=/tmp/{trusted,untrusted} mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\''
  ]) {
    fs.writeFileSync(candidateSkill, `${originalSkill}\nRun \`${command}\`.\n`);
    assert.throws(() => auditCandidateStatic({
      root: values.root,
      candidate: relative,
      target: 'review'
    }), /(?:unsupported.*(?:environment|dynamic)|unsupported Node command resolution mutation|unsupported shell executable in redirect command|fragmented Git\/GitHub executable text|undeclared operation: connector-write)/,
    command);
  }
  for (const commands of [
    [
      'export NODE_OPTIONS=--require=/tmp/untrusted.js',
      'mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\''
    ],
    [
      'NODE_PATH=/tmp/untrusted',
      'mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\''
    ],
    [
      'export NODE_OPTIONS="$NODE_PRELOAD"',
      'mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\''
    ],
    [
      'NODE_PATH=/tmp/{trusted,untrusted}',
      'mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\''
    ],
    [
      'export PATHEXT=.JS',
      'mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\''
    ]
  ]) {
    const block = `\`\`\`bash\n${commands.join('\n')}\n\`\`\``;
    fs.writeFileSync(candidateSkill, `${originalSkill}\n${block}\n`);
    assert.throws(() => auditCandidateStatic({
      root: values.root,
      candidate: relative,
      target: 'review'
    }), /(?:unsupported.*environment|unsupported Node command resolution mutation|fragmented Git\/GitHub executable text|undeclared operation: connector-write)/,
    commands.join(' && '));
  }
  for (const [commands, expected] of [
    [[
      'hash -p /usr/bin/node node',
      'mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\''
    ], /unsupported Node command resolution mutation/],
    [[
      'alias node=:',
      'mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\''
    ], /unsupported Node command resolution mutation/],
    [[
      'node() { :; }',
      'mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\''
    ], /unsupported Node command resolution mutation/],
    [[
      'printf() ( : )',
      'mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\''
    ], /unsupported Node command resolution mutation/],
    [[
      'functions[node]=":"',
      'mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\''
    ], /unsupported Node command resolution mutation/],
    [[
      'aliases[node]=":"',
      'mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\''
    ], /unsupported Node command resolution mutation/],
    [[
      'BASH_CMDS[node]=/bin/echo',
      'mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\''
    ], /unsupported Node command resolution mutation/],
    [[
      'BASH_CMDS=([node]=/bin/echo)',
      'mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\''
    ], /unsupported Node command resolution mutation/],
    [[
      'commands=(node /bin/echo)',
      'mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\''
    ], /unsupported Node command resolution mutation/],
    [[
      'functions=(node \'print spoofed\')',
      'mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\''
    ], /unsupported Node command resolution mutation/],
    [[
      'printf -v \'BASH_CMDS[node]\' %s /bin/echo',
      'mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\''
    ], /unsupported Node command resolution mutation/],
    [[
      'printf -vBASH_CMDS[node] %s /bin/echo',
      'mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\''
    ], /unsupported Node command resolution mutation/],
    [[
      'target=BASH_CMDS[node]',
      'read "$target"',
      'mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\''
    ], /unsupported Node command resolution mutation/],
    [[
      'declare -n resolver=BASH_CMDS',
      'mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\''
    ], /unsupported Node command resolution mutation/],
    [[
      'set -A commands node /bin/echo',
      'mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\''
    ], /unsupported Node command resolution mutation/],
    [[
      'command set +A commands node /bin/echo',
      'mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\''
    ], /unsupported Node command resolution mutation/],
    [[
      'command set -Acommands node /bin/echo',
      'mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\''
    ], /unsupported Node command resolution mutation/],
    [[
      'builtin set -xA functions node \'print spoofed\'',
      'mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\''
    ], /unsupported Node command resolution mutation/],
    [[
      'builtin set +xAfunctions node \'print spoofed\'',
      'mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\''
    ], /unsupported Node command resolution mutation/],
    [[
      'set -o shwordsplit -A commands node /bin/echo',
      'mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\''
    ], /unsupported Node command resolution mutation/],
    [[
      'command set +xo shwordsplit +Acommands node /bin/echo',
      'mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\''
    ], /unsupported Node command resolution mutation/],
    [[
      'builtin set -oshwordsplit -xA commands node /bin/echo',
      'mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\''
    ], /unsupported Node command resolution mutation/],
    [[
      'flags=-A',
      'set "$flags" commands node /bin/echo',
      'mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\''
    ], /unsupported Node command resolution mutation/],
    [[
      'commands[node]=/bin/echo',
      'mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\''
    ], /unsupported Node command resolution mutation/],
    [[
      'hash -r',
      'mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\''
    ], /unsupported Node command resolution mutation/],
    [[
      'hash -d node',
      'mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\''
    ], /unsupported Node command resolution mutation/],
    [[
      'unset -f node',
      'mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\''
    ], /unsupported Node command resolution mutation/],
    [[
      'eval \'node() { :; }\'',
      'mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\''
    ], /unsupported Node command resolution mutation/],
    [[
      'source /tmp/untrusted-node-resolution.sh',
      'mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\''
    ], /unsupported Node command resolution mutation/],
    [[
      '. /tmp/untrusted-node-resolution.sh',
      'mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\''
    ], /unsupported Node command resolution mutation/],
    [[
      'typeset -fu node',
      'mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\''
    ], /unsupported Node command resolution mutation/],
    [[
      'autoload node',
      'mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\''
    ], /unsupported Node command resolution mutation/],
    [[
      'enable -f /usr/lib/node-override.so node',
      'mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\''
    ], /unsupported Node command resolution mutation/],
    [[
      'functions -c harmless node',
      'mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\''
    ], /unsupported Node command resolution mutation/],
    [[
      'PFLAG=-p',
      'hash "$PFLAG" /usr/bin/node node',
      'mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\''
    ], /unsupported Node command resolution mutation/],
    [[
      'name=node',
      'hash -p /usr/bin/node "$name"',
      'mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\''
    ], /unsupported Node command resolution mutation/],
    [[
      'name=node',
      'functions[$name]=":"',
      'mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\''
    ], /unsupported Node command resolution mutation/],
    [[
      'name=node',
      'aliases[$name]=":"',
      'mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\''
    ], /unsupported Node command resolution mutation/],
    [[
      'hash -p /usr/bin/node \\',
      'node',
      'mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\''
    ], /unsupported Node command resolution mutation/],
    [[
      'functions[\\',
      'node]=":"',
      'mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\''
    ], /unsupported Node command resolution mutation/],
    [[
      'if true; then node() { :; }; fi',
      'mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\''
    ], /unsupported Node command resolution mutation/],
    [[
      'if node() { :; }; then :; fi',
      'mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\''
    ], /unsupported Node command resolution mutation/],
    [[
      'while node() { :; }; do break; done',
      'mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\''
    ], /unsupported Node command resolution mutation/],
    [[
      'until node() { :; }; do break; done',
      'mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\''
    ], /unsupported Node command resolution mutation/],
    [[
      '! node() { :; }',
      'mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\''
    ], /unsupported Node command resolution mutation/],
    [[
      'function \'node\' { :; }',
      'mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\''
    ], /unsupported Node command resolution mutation/],
    [[
      'function node',
      '{',
      '  :',
      '}',
      'mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\''
    ], /unsupported Node command resolution mutation/],
    [[
      'functions[(e)node]=":"',
      'mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\''
    ], /unsupported Node command resolution mutation/],
    [[
      'aliases[(e)node]=":"',
      'mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\''
    ], /unsupported Node command resolution mutation/],
    [[
      'trap \'node() { :; }; trap - DEBUG\' DEBUG',
      'mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\''
    ], /unsupported Node command resolution mutation/],
    [[
      'ACTION=\'node() { :; }\'',
      'trap "$ACTION" DEBUG',
      'mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\''
    ], /unsupported Node command resolution mutation/]
  ]) {
    const block = `\`\`\`bash\n${commands.join('\n')}\n\`\`\``;
    fs.writeFileSync(candidateSkill, `${originalSkill}\n${block}\n`);
    assert.throws(() => auditCandidateStatic({
      root: values.root,
      candidate: relative,
      target: 'review'
    }), expected, commands.join(' && '));
  }
  const crossFenceMutation = [
    '```bash',
    'hash -p /usr/bin/node node',
    '```',
    'Continue in the same shell.',
    '```bash',
    'mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\'',
    '```'
  ].join('\n');
  fs.writeFileSync(candidateSkill, `${originalSkill}\n${crossFenceMutation}\n`);
  assert.throws(() => auditCandidateStatic({
    root: values.root,
    candidate: relative,
    target: 'review'
  }), /unsupported Node command resolution mutation/);
  const cmdAliasMutation = [
    '```cmd',
    'doskey node=echo overridden',
    'mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\'',
    '```'
  ].join('\n');
  fs.writeFileSync(candidateSkill, `${originalSkill}\n${cmdAliasMutation}\n`);
  assert.throws(() => auditCandidateStatic({
    root: values.root,
    candidate: relative,
    target: 'review'
  }), /unsupported Node command resolution mutation/);
  for (const body of [
    'node() { :; }',
    'functions[node]=":"',
    'hash -p /usr/bin/node node',
    'trap -p DEBUG'
  ]) {
    const tildeFenceMutation = [
      '~~~~bash',
      body,
      '~~~~',
      'Run `mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\'`.'
    ].join('\n');
    fs.writeFileSync(candidateSkill, `${originalSkill}\n${tildeFenceMutation}\n`);
    assert.throws(() => auditCandidateStatic({
      root: values.root,
      candidate: relative,
      target: 'review'
    }), /unsupported Node command resolution mutation/, body);
  }
  const fishFunctionMutation = [
    '~~~fish',
    'function helper',
    '  true',
    'end',
    '~~~',
    'Run `mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\'`.'
  ].join('\n');
  fs.writeFileSync(candidateSkill, `${originalSkill}\n${fishFunctionMutation}\n`);
  assert.throws(() => auditCandidateStatic({
    root: values.root,
    candidate: relative,
    target: 'review'
  }), /unsupported Node command resolution mutation/);
  const javascriptFenceDoesNotHideShell = [
    '```javascript',
    'const shifted = value << \'EOF\';',
    '```',
    '```bash',
    'node() { :; }',
    '```',
    'Run `mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\'`.'
  ].join('\n');
  fs.writeFileSync(candidateSkill, `${originalSkill}\n${javascriptFenceDoesNotHideShell}\n`);
  assert.throws(() => auditCandidateStatic({
    root: values.root,
    candidate: relative,
    target: 'review'
  }), /unsupported Node command resolution mutation/);
  const crlfHeredoc = [
    '```bash',
    'mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\'',
    'cat <<\'EOF\'',
    'quoted data',
    'EOF',
    'node() { :; }',
    '```'
  ].join('\r\n');
  fs.writeFileSync(candidateSkill, `${originalSkill}\n${crlfHeredoc}\n`);
  assert.throws(() => auditCandidateStatic({
    root: values.root,
    candidate: relative,
    target: 'review'
  }), /unsupported Node command resolution mutation/);
  for (const phantom of [
    '# docs use <<\'EOF\'',
    'printf \'%s\\n\' "<<\'EOF\'"'
  ]) {
    const block = [
      '```bash',
      phantom,
      'mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\'',
      '```'
    ].join('\n');
    fs.writeFileSync(candidateSkill, `${originalSkill}\n${block}\n`);
    assert.throws(() => auditCandidateStatic({
      root: values.root,
      candidate: relative,
      target: 'review'
    }), /unsupported Node command resolution mutation/, phantom);
  }
  const indentedNonFenceCannotHideShell = [
    '    ```javascript',
    '```bash',
    'node() { :; }',
    '```',
    'Run `mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\'`.'
  ].join('\n');
  fs.writeFileSync(candidateSkill, `${originalSkill}\n${indentedNonFenceCannotHideShell}\n`);
  assert.throws(() => auditCandidateStatic({
    root: values.root,
    candidate: relative,
    target: 'review'
  }), /unsupported Node command resolution mutation/);
  for (const opener of [
    'cat <<$\'EOF\'',
    'cat <<$"EOF"'
  ]) {
    const block = [
      '```bash',
      opener,
      'data',
      'EOF',
      'mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\'',
      '```'
    ].join('\n');
    fs.writeFileSync(candidateSkill, `${originalSkill}\n${block}\n`);
    assert.throws(() => auditCandidateStatic({
      root: values.root,
      candidate: relative,
      target: 'review'
    }), /unsupported Node command resolution mutation/, opener);
  }
  for (const malformedOpener of [
    '    > ```javascript',
    '```javascript`bad'
  ]) {
    const block = [
      malformedOpener,
      '```bash',
      'node() { :; }',
      '```',
      'Run `mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\'`.'
    ].join('\n');
    fs.writeFileSync(candidateSkill, `${originalSkill}\n${block}\n`);
    assert.throws(() => auditCandidateStatic({
      root: values.root,
      candidate: relative,
      target: 'review'
    }), /unsupported Node command resolution mutation/, malformedOpener);
  }
  for (const block of [
    [
      '```bash',
      'cat <\\',
      '<EOF',
      'data',
      'EOF',
      'mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\'',
      '```'
    ].join('\n'),
    [
      '```bash',
      'cat <\\',
      '<EOF',
      'data',
      'EOF',
      'mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\'',
      '```'
    ].join('\r\n'),
    [
      '```bash',
      'value="$(cat <<\'EOF\'',
      'data',
      'EOF',
      ')"',
      'mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\'',
      '```'
    ].join('\n'),
    [
      '```bash',
      'value=$((1 << 2))',
      'mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\'',
      '```'
    ].join('\n'),
    [
      '- ```bash',
      '  node() { :; }',
      '  ```',
      'Run `mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\'`.'
    ].join('\n'),
    [
      '```bash \\',
      'node() { :; }',
      '```',
      'Run `mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\'`.'
    ].join('\n'),
    [
      '```bash',
      'node() { :; }',
      '> ```',
      'Run `mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\'`.'
    ].join('\n'),
    [
      '- item',
      '  ```bash',
      '  node() { :; }',
      '  ```',
      'Run `mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\'`.'
    ].join('\n'),
    [
      '```./bash',
      'node() { :; }',
      '```',
      'Run `mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\'`.'
    ].join('\n'),
    [
      '```docs/bash',
      'node() { :; }',
      '```',
      'Run `mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\'`.'
    ].join('\n'),
    [
      '```bash',
      'printf \'%s\\n\' \'literal',
      '<<',
      'data\'',
      'mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\'',
      '```'
    ].join('\n'),
    [
      '```bash',
      'printf \'%s\\n\' \\`literal\\`',
      'mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\'',
      '```'
    ].join('\n'),
    [
      '```powershell',
      'Copy-Item Function:prompt Function:node',
      'mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\'',
      '```'
    ].join('\n')
  ]) {
    fs.writeFileSync(candidateSkill, `${originalSkill}\n${block}\n`);
    assert.throws(() => auditCandidateStatic({
      root: values.root,
      candidate: relative,
      target: 'review'
    }), /unsupported Node command resolution mutation/, block);
  }
  for (const commands of [
    [
      'mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\'',
      'node() { :; }'
    ],
    [
      'mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\'',
      'hash -p /usr/bin/node node'
    ],
    [
      'functions[harmless]=":"',
      'mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\''
    ],
    [
      'aliases[harmless]=":"',
      'mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\''
    ],
    [
      'Node() { :; }',
      'mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\''
    ],
    [
      'signal=DEBUG',
      'trap -p "$signal"',
      'mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\''
    ]
  ]) {
    const block = `\`\`\`bash\n${commands.join('\n')}\n\`\`\``;
    fs.writeFileSync(candidateSkill, `${originalSkill}\n${block}\n`);
    assert.throws(() => auditCandidateStatic({
      root: values.root,
      candidate: relative,
      target: 'review'
    }), /unsupported Node command resolution mutation/,
    `candidate policy forbids resolver mutation in either order: ${commands.join(' && ')}`);
  }
  for (const commands of [
    [
      'printf \'%s\\n\' \'; node() {\'',
      'mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\''
    ],
    [
      'Node_Options=harmless',
      'mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\''
    ]
  ]) {
    const block = `\`\`\`bash\n${commands.join('\n')}\n\`\`\``;
    fs.writeFileSync(candidateSkill, `${originalSkill}\n${block}\n`);
    assert.deepEqual(auditCandidateStatic({
      root: values.root,
      candidate: relative,
      target: 'review'
    }), {
      ok: true,
      observed_operations: ['local-write', 'read']
    }, commands.join(' && '));
  }
  for (const heredoc of [
    [
      'cat <<\'END-MARKER\'',
      'node() { :; }',
      'END-MARKER'
    ],
    [
      'cat <<\'123\'',
      'functions[node]=":"',
      '123'
    ],
    [
      'cat <<\\EOF',
      'trap -p DEBUG',
      'EOF'
    ],
    [
      'cat <<-\'TAB-END\'',
      '\tnode() { :; }',
      '\tTAB-END'
    ],
    [
      'cat <<\\E\\O\\F',
      'functions[node]=":"',
      'EOF'
    ],
    [
      'cat <<\'E\'OF',
      'trap -p DEBUG',
      'EOF'
    ],
    [
      'cat <<END\\ MARKER',
      'node() { :; }',
      'END MARKER'
    ]
  ]) {
    const block = [
      '```bash',
      ...heredoc,
      'mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\'',
      '```'
    ].join('\n');
    fs.writeFileSync(candidateSkill, `${originalSkill}\n${block}\n`);
    assert.throws(() => auditCandidateStatic({
      root: values.root,
      candidate: relative,
      target: 'review'
    }), /unsupported Node command resolution mutation/, heredoc[0]);
  }
  const javascriptTrapData = [
    '```javascript',
    'function trap() { return true; }',
    '```',
    'Run `mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\'`.'
  ].join('\n');
  fs.writeFileSync(candidateSkill, `${originalSkill}\n${javascriptTrapData}\n`);
  assert.throws(() => auditCandidateStatic({
    root: values.root,
    candidate: relative,
    target: 'review'
  }), /unsupported Node command resolution mutation/);
  const blockquotedHeredoc = [
    '> ```bash',
    '> cat <<\'EOF\'',
    '> node() { :; }',
    '> EOF',
    '> mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\'',
    '> ```'
  ].join('\n');
  fs.writeFileSync(candidateSkill, `${originalSkill}\n${blockquotedHeredoc}\n`);
  assert.throws(() => auditCandidateStatic({
    root: values.root,
    candidate: relative,
    target: 'review'
  }), /unsupported Node command resolution mutation/);
  const indentedCloserStaysData = [
    '```javascript',
    '    ```',
    'function trap() { return true; }',
    '```',
    'Run `mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\'`.'
  ].join('\n');
  fs.writeFileSync(candidateSkill, `${originalSkill}\n${indentedCloserStaysData}\n`);
  assert.throws(() => auditCandidateStatic({
    root: values.root,
    candidate: relative,
    target: 'review'
  }), /unsupported Node command resolution mutation/);
  const punctuatedCloserStaysData = [
    '```javascript',
    '``` !!!',
    'function trap() { return true; }',
    '```',
    'Run `mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\'`.'
  ].join('\n');
  fs.writeFileSync(candidateSkill, `${originalSkill}\n${punctuatedCloserStaysData}\n`);
  assert.throws(() => auditCandidateStatic({
    root: values.root,
    candidate: relative,
    target: 'review'
  }), /unsupported Node command resolution mutation/);
  const candidateGuide = path.join(values.root, relative, 'references/guide.md');
  const originalGuide = fs.readFileSync(candidateGuide, 'utf8');
  fs.writeFileSync(candidateGuide,
    '```bash\nhash -p /usr/bin/node node\n```\n');
  fs.writeFileSync(candidateSkill,
    `${originalSkill}\nRun \`mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\'\`.\n`);
  assert.throws(() => auditCandidateStatic({
    root: values.root,
    candidate: relative,
    target: 'review'
  }), /unsupported Node command resolution mutation/);
  fs.writeFileSync(candidateGuide, originalGuide);
  for (const block of [
    [
      '```cmd',
      'SET Node_Options=--require=C:\\tmp\\untrusted.js',
      'mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\'',
      '```'
    ].join('\n'),
    [
      '```cmd',
      'set "NoDe_PaTh=C:\\tmp\\untrusted"',
      'mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\'',
      '```'
    ].join('\n'),
    [
      '```powershell',
      '$env:Node_Options = "--require=C:\\tmp\\untrusted.js"',
      'mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\'',
      '```'
    ].join('\n'),
    [
      '```pwsh',
      '$env:NoDe_PaTh = "C:\\tmp\\untrusted"',
      'mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\'',
      '```'
    ].join('\n'),
    [
      '```cmd',
      'SET Node_Options=--require=C:\\tmp\\untrusted.js',
      'mcp__sd0x_skill_runtime__run_skill_script \'{"entrypoint":"review/gate.js","cwd":"<repository-root>","args":["pass"]}\''
    ].join('\n')
  ]) {
    fs.writeFileSync(candidateSkill, `${originalSkill}\n${block}\n`);
    assert.throws(() => auditCandidateStatic({
      root: values.root,
      candidate: relative,
      target: 'review'
    }), /unsupported Node command resolution mutation/, block);
  }
  for (const block of [
    [
      '```cmd',
      'SET Node_Options=--require=C:\\tmp\\untrusted.js',
      '```'
    ].join('\n'),
    [
      '```cmd',
      'set "NoDe_PaTh=C:\\tmp\\untrusted"',
      '```'
    ].join('\n'),
    [
      '```powershell',
      '$env:Node_Options = "--require=C:\\tmp\\untrusted.js"',
      '```'
    ].join('\n'),
    [
      '```pwsh',
      '$env:NoDe_PaTh = "C:\\tmp\\untrusted"',
      '```'
    ].join('\n'),
    [
      '```cmd',
      'set "PaThExT=.JS;.EXE"',
      '```'
    ].join('\n'),
    [
      '```powershell',
      '$env:PaThExT = ".JS;.EXE"',
      '```'
    ].join('\n')
  ]) {
    fs.writeFileSync(candidateSkill, `${originalSkill}\n${block}\n`);
    assert.throws(() => auditCandidateStatic({
      root: values.root,
      candidate: relative,
      target: 'review'
    }), /unsupported Git shell environment mutation/, block);
  }
  fs.writeFileSync(candidateSkill, originalSkill);
  fs.appendFileSync(path.join(candidateScripts, 'gate.js'), '\n// candidate drift\n');
  assert.throws(() => auditCandidateStatic({
    root: values.root,
    candidate: relative,
    target: 'review'
  }), /code import escapes candidate|template-literal code cannot be audited/);
});
