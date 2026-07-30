#!/usr/bin/env node
'use strict';

const { main } = require('../../../scripts/runtime/cli');

function run(argv = process.argv.slice(2), cwd = process.cwd()) {
  if (argv.length === 0) return main(['verify'], cwd);
  const modeIndex = argv.indexOf('--mode');
  if (modeIndex < 0 || modeIndex + 1 >= argv.length) {
    throw new Error('usage: verify.js [--mode <fast|precommit> --allow-fixes]');
  }
  return main([
    'verify-mode',
    argv[modeIndex + 1],
    ...argv.filter((value, index) => index !== modeIndex && index !== modeIndex + 1)
  ], cwd);
}

if (require.main === module) {
  try {
    process.exitCode = run();
  } catch (error) {
    process.stderr.write(`sd0x verify: ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  run
};
