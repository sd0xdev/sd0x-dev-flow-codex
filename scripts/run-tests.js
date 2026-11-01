'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_CONCURRENCY = Math.min(4, os.availableParallelism());

function testFiles(root, directory) {
  const files = fs.readdirSync(path.join(root, directory), { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.test.js'))
    .map(entry => `${directory}/${entry.name}`).sort();
  if (!files.length) throw new Error(`No test files found in ${directory}`);
  return files;
}

function discoverTests(root = ROOT, suite = 'all') {
  if (suite === 'replay') return testFiles(root, 'test/migration/replay');
  if (!['all', 'migration'].includes(suite)) {
    throw new Error(`Unknown test suite: ${suite}`);
  }
  const migration = testFiles(root, 'test/migration');
  if (suite === 'migration') return migration;
  const ordinary = testFiles(root, 'test')
    .filter(file => file !== 'test/skill-migration.test.js');
  return [...migration, ...ordinary];
}

function parseOptions(args, env = process.env) {
  const options = {
    suite: 'all',
    concurrency: env.SD0X_TEST_CONCURRENCY ?? DEFAULT_CONCURRENCY,
    list: false
  };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--suite' && args[i + 1]) options.suite = args[++i];
    else if (args[i] === '--concurrency' && args[i + 1]) options.concurrency = args[++i];
    else if (args[i] === '--list') options.list = true;
    else throw new Error(`Unknown or incomplete test option: ${args[i]}`);
  }
  if (!/^[1-9]\d*$/.test(String(options.concurrency)) || Number(options.concurrency) > 32) {
    throw new Error('Test concurrency must be an integer from 1 to 32');
  }
  options.concurrency = Number(options.concurrency);
  return options;
}

function runTests({ root = ROOT, suite = 'all', concurrency = DEFAULT_CONCURRENCY,
  list = false, env = process.env, stdio = 'inherit' } = {}) {
  const options = parseOptions(['--suite', suite, '--concurrency', String(concurrency)], {});
  const files = discoverTests(root, options.suite);
  if (list) {
    process.stdout.write(`${files.join('\n')}\n`);
    return 0;
  }
  // A new runner must not inherit node:test's internal child marker; doing so
  // can suppress discovery when this command is exercised by integration tests.
  const childEnv = { ...env };
  delete childEnv.NODE_TEST_CONTEXT;
  const result = spawnSync(process.execPath, [
    '--test', `--test-concurrency=${options.concurrency}`, ...files
  ], { cwd: root, env: childEnv, stdio, windowsHide: true });
  if (result.error) throw result.error;
  if (result.signal) {
    process.stderr.write(`test suite terminated by ${result.signal}\n`);
    return 1;
  }
  return result.status ?? 1;
}

function main(args = process.argv.slice(2)) {
  return runTests(parseOptions(args));
}

if (require.main === module) {
  try { process.exitCode = main(); }
  catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; }
}

module.exports = { DEFAULT_CONCURRENCY, discoverTests, parseOptions, runTests, main };
