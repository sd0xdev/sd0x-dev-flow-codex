'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { spawnSync } = require('node:child_process');
const { discoverTests, parseOptions, runTests } = require('../scripts/run-tests');
const { validateRootTestCommand } = require('../scripts/skill-migration-audit');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-test-dispatch-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const directory of ['test', 'test/migration', 'test/migration/replay']) {
    fs.mkdirSync(path.join(root, directory), { recursive: true });
  }
  return root;
}

function write(root, file, body = "require('node:test')('case', () => {});\n") {
  fs.writeFileSync(path.join(root, file), body);
}

test('test dispatch includes each ordinary file once and keeps historical replay explicit', (t) => {
  const root = fixture(t);
  for (const file of ['test/unit.test.js', 'test/skill-migration.test.js',
    'test/migration/a.test.js', 'test/migration/b.test.js',
    'test/migration/replay/history.test.js']) write(root, file);
  assert.deepEqual(discoverTests(root), [
    'test/migration/a.test.js', 'test/migration/b.test.js', 'test/unit.test.js'
  ]);
  assert.deepEqual(discoverTests(root, 'migration'), [
    'test/migration/a.test.js', 'test/migration/b.test.js'
  ]);
  assert.deepEqual(discoverTests(root, 'replay'), ['test/migration/replay/history.test.js']);
  assert.throws(() => discoverTests(root, 'missing'), /Unknown test suite/);
  fs.unlinkSync(path.join(root, 'test/migration/replay/history.test.js'));
  assert.throws(() => discoverTests(root, 'replay'), /No test files/);
});

test('test dispatch rejects invalid concurrency and incomplete or unknown options', () => {
  for (const value of ['0', '-1', '1.5', '33', 'Infinity', 'NaN', '']) {
    assert.throws(() => parseOptions([], { SD0X_TEST_CONCURRENCY: value }), /concurrency/);
  }
  assert.equal(parseOptions(['--concurrency', '2'], { SD0X_TEST_CONCURRENCY: '3' }).concurrency, 2);
  for (const args of [['--suite'], ['--concurrency'], ['--unknown']]) {
    assert.throws(() => parseOptions(args, {}), /Unknown or incomplete/);
  }
});

test('candidate audit accepts the trusted all-suite dispatcher and refuses omitted root tests or replaced code', t => {
  const root = fixture(t);
  fs.mkdirSync(path.join(root, 'scripts'));
  const runner = path.join(root, 'scripts/run-tests.js');
  fs.copyFileSync(path.resolve(__dirname, '../scripts/run-tests.js'), runner);
  write(root, 'test/candidate-routing.test.js');
  write(root, 'test/migration/ordinary.test.js');
  const check = command => validateRootTestCommand(root, { scripts: { check: command } });
  assert(check('node scripts/check-syntax.js && node scripts/run-tests.js').has('test/candidate-routing.test.js'));
  assert.equal(check('node --test test/*.test.js'), null);
  for (const command of ['node scripts/run-tests.js --suite migration',
    'node scripts/run-tests.js --suite replay', 'node scripts/run-tests.js --list',
    'echo node scripts/run-tests.js', 'node scripts/run-tests.js || true']) {
    assert.throws(() => check(command), /must execute root/);
  }
  fs.writeFileSync(runner, "process.exit(0);\n");
  assert.throws(() => check('node scripts/run-tests.js'), /differs from the trusted/);
});

test('test dispatch executes passing and failing shards and propagates failure', (t) => {
  const root = fixture(t);
  write(root, 'test/skill-migration.test.js', "throw Error('compatibility entrypoint executed twice');");
  write(root, 'test/unit.test.js');
  write(root, 'test/migration/a.test.js');
  assert.equal(runTests({ root, concurrency: 2, stdio: 'pipe' }), 0);
  write(root, 'test/migration/b.test.js', "require('node:test')('fails', () => { throw Error('sentinel'); });");
  assert.equal(runTests({ root, concurrency: 2, stdio: 'pipe' }), 1);
});

function barrierSource(name, other, timeout = 10000) {
  return `
    const fs = require('node:fs');
    const assert = require('node:assert/strict');
    const { setTimeout: delay } = require('node:timers/promises');
    require('node:test')('isolated ${name}', { timeout: ${timeout} }, async (t) => {
      assert.equal(process.env.SD0X_DISPATCH_SENTINEL, undefined);
      process.env.SD0X_DISPATCH_SENTINEL = '${name}';
      fs.writeFileSync('${name}.pid', String(process.pid));
      while (!fs.existsSync('${other}.pid')) {
        await delay(10, undefined, { signal: t.signal });
      }
      assert.notEqual(fs.readFileSync('${other}.pid', 'utf8'), String(process.pid));
      assert.equal(process.env.SD0X_DISPATCH_SENTINEL, '${name}');
    });
  `;
}

test('migration shards execute in separate overlapping processes with isolated globals', (t) => {
  const root = fixture(t);
  // A barrier proves overlap without relying on a performance threshold.
  for (const [name, other] of [['a', 'b'], ['b', 'a']]) {
    write(root, `test/migration/${name}.test.js`, barrierSource(name, other));
  }
  const env = { ...process.env };
  delete env.SD0X_DISPATCH_SENTINEL;
  assert.equal(runTests({ root, suite: 'migration', concurrency: 2, env, stdio: 'pipe' }), 0);
  assert.notEqual(fs.readFileSync(path.join(root, 'a.pid'), 'utf8'),
    fs.readFileSync(path.join(root, 'b.pid'), 'utf8'));
  assert.equal(env.SD0X_DISPATCH_SENTINEL, undefined);
});

test('migration process barrier exits with failure when its peer never starts', (t) => {
  const root = fixture(t);
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  delete env.SD0X_DISPATCH_SENTINEL;
  // Run node:test in this child directly so the watchdog also contains a
  // regressed callback, without leaving a test-runner grandchild behind.
  const result = spawnSync(process.execPath, ['-e', barrierSource('alone', 'missing', 100)], {
    cwd: root, env, encoding: 'utf8', timeout: 5000
  });
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.signal, null);
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stdout + result.stderr, /timed out/);
  assert.equal(fs.existsSync(path.join(root, 'alone.pid')), true);
  assert.equal(fs.existsSync(path.join(root, 'missing.pid')), false);
});
