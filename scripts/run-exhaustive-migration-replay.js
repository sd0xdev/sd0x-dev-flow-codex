'use strict';

const { spawnSync } = require('node:child_process');

const pattern = [
  'Wave [34] delivery overlay',
  'durably Completed research-pack',
  'wrong phase hashes',
  'durable owner revisions'
].join('|');

const result = spawnSync(process.execPath, [
  '--test',
  `--test-name-pattern=${pattern}`,
  'test/skill-migration.test.js'
], {
  cwd: process.cwd(),
  env: { ...process.env, SD0X_EXHAUSTIVE_MIGRATION_REPLAY: '1' },
  stdio: 'inherit',
  windowsHide: true
});

if (result.error) throw result.error;
if (result.signal) {
  process.stderr.write(`migration replay terminated by ${result.signal}\n`);
  process.exitCode = 1;
} else {
  process.exitCode = result.status ?? 1;
}
