'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync, execFileSync } = require('node:child_process');
const runtime = path.resolve(__dirname, '../plugin/sd0x-dev-flow-codex/scripts/runtime');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'v5-review-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

test('manifest CLI and native runner redact missing and ambiguous selector diagnostics', t => {
  const secret = 'ghp_' + 'X'.repeat(36), root = fixture(t);
  fs.mkdirSync(path.join(root, 'a'), { recursive: true });
  fs.mkdirSync(path.join(root, 'b'), { recursive: true });
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'root', workspaces: ['a', 'b'] }));
  for (const part of ['a', 'b']) fs.writeFileSync(path.join(root, part, 'package.json'), JSON.stringify({ name: secret }));
  for (const selector of [secret, secret + '-missing']) {
    for (const viaRunner of [false, true]) {
      const args = ['--reverse', selector];
      const command = viaRunner ? [path.join(runtime, 'runner.js'), JSON.stringify({
        entrypoint: 'workflow/manifest-map.js', cwd: root, args
      })] : [path.join(runtime, 'manifest-map.js'), ...args];
      const child = spawnSync(process.execPath, command, { cwd: root, encoding: 'utf8' });
      const result = viaRunner ? JSON.parse(child.stdout) : { exit_code: child.status, ...child };
      assert.equal(result.exit_code, 2);
      assert.match(result.stderr, selector === secret ? /ambiguous selector/ : /selector not found/);
      assert.match(result.stderr, /<secret>/);
      assert(!JSON.stringify(result).includes(secret));
    }
  }
});

test('deploy preview never invokes fsmonitor while authorized merge retains actual hooks', t => {
  const deploy = require(path.join(runtime, 'deployment')), root = fixture(t);
  const env = { ...deploy.environment(), GIT_CONFIG_GLOBAL: os.devNull, GIT_CONFIG_NOSYSTEM: '1' };
  const git = (...args) => execFileSync('git', ['-C', root, ...args], { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init', '-b', 'main');
  git('config', 'user.name', 'Fixture'); git('config', 'user.email', 'fixture@example.test');
  git('config', 'commit.gpgSign', 'false');
  fs.mkdirSync(path.join(root, '.codex'));
  fs.writeFileSync(path.join(root, '.codex/sd0x-git.json'), JSON.stringify({ deploy: [
    { kind: 'merge', source: 'feature', target: 'main' }
  ] }));
  git('add', '.'); git('commit', '-m', 'initial');
  git('switch', '-c', 'feature'); fs.writeFileSync(path.join(root, 'data'), 'feature');
  git('add', '.'); git('commit', '-m', 'feature');
  const monitor = path.join(root, '.git/monitor'), marker = path.join(root, '.git/fsmonitor-ran');
  fs.writeFileSync(monitor, '#!/bin/sh\n: > "$(git rev-parse --git-path fsmonitor-ran)"\nprintf "token\\0"\n', { mode: 0o755 });
  git('config', 'core.fsmonitor', monitor);
  git('status', '--porcelain'); assert(fs.existsSync(marker), 'control invokes configured helper');
  fs.unlinkSync(marker);
  const hook = path.join(root, '.git/hooks/pre-merge-commit');
  fs.writeFileSync(hook, '#!/bin/sh\n: > "$(git rev-parse --git-path merge-hook-ran)"\n', { mode: 0o755 });
  const plan = deploy.planStep(root, 0);
  assert(!fs.existsSync(marker), 'preview does not execute repository helper');
  assert(!fs.existsSync(path.join(root, '.git/merge-hook-ran')));
  assert.equal(deploy.executeStep(root, plan, { plan_sha256: plan.plan_sha256 }).outcome, 'complete');
  assert(fs.existsSync(path.join(root, '.git/merge-hook-ran')), 'authorized merge retains user hook');
});

test('comment scanner leaves literal data for manual confirmation without definite findings', t => {
  const { scanComments, commentBlocks } = require(path.join(runtime, 'comment-blocks'));
  const root = fixture(t);
  const cases = {
    'template.js': 'const text = `\n' + '// data\n'.repeat(30) + '`;\n',
    'heredoc.sh': "cat <<'EOF'\n" + '# data\n'.repeat(30) + 'EOF\n',
    'quoted.sh': "text='\n" + '# data\n'.repeat(30) + "'\n"
  };
  for (const [file, content] of Object.entries(cases)) {
    fs.writeFileSync(path.join(root, file), content);
    const result = scanComments(root, [file]);
    assert.equal(result.outcome, 'manual-confirmation-required', file);
    assert.equal(result.findings.length, 0, file);
    assert.equal(result.manual_regions.length, 1, file);
    assert.equal(result.gate_authority, false);
  }
  for (const [language, line] of [['js', '// actual'], ['sh', '# actual']]) {
    assert.equal(commentBlocks((line + '\n').repeat(30), language)[0].severity, 'block');
    assert.equal(commentBlocks((line + '\n').repeat(25), language)[0].severity, 'warn');
  }
  fs.writeFileSync(path.join(root, 'prefix.js'), '// actual\n'.repeat(30) + cases['template.js']);
  const result = scanComments(root, ['prefix.js']);
  assert.equal(result.outcome, 'findings');
  assert.equal(result.findings[0].count, 30);
  assert.equal(result.manual_regions.length, 1);
  assert.equal(commentBlocks('const x = "/*";\n' + '// real\n'.repeat(30))[0].count, 30);
});


test('long credentials are redacted before diagnostic and unresolved-spec truncation', t => {
  const root = fixture(t);
  for (const length of [90, 240]) {
    const marker = 'SYNTHETIC_PRIVATE_PASSWORD_', password = marker + 'x'.repeat(length);
    const url = 'https://reader:' + password + '@example.invalid/archive.tgz';
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'fixture', dependencies: { remote: url } }));
    fs.writeFileSync(path.join(root, 'go.mod'), 'module example.test/main\nrequire (\n malformed ' + url + ' extra\n)\n');
    fs.writeFileSync(path.join(root, 'Cargo.toml'), '[package]\nname="fixture"\nversion="1.0.0"\n[dependencies]\nremote={path="' + url + '"}\n');
    for (const format of ['json', 'md']) for (const viaRunner of [false, true]) {
      const args = ['--format', format];
      const command = viaRunner ? [path.join(runtime, 'runner.js'), JSON.stringify({
        entrypoint: 'workflow/manifest-map.js', cwd: root, args
      })] : [path.join(runtime, 'manifest-map.js'), ...args];
      const child = spawnSync(process.execPath, command, { cwd: root, encoding: 'utf8' });
      const result = viaRunner ? JSON.parse(child.stdout) : { exit_code: child.status, ...child };
      assert.equal(result.exit_code, 0, result.stderr);
      assert(!JSON.stringify(result).includes(marker), 'must not expose a password prefix after truncation');
      if (format === 'json') assert.match(result.stdout, /<secret>/);
      assert.match(result.stdout, /fixture/);
    }
  }
});
