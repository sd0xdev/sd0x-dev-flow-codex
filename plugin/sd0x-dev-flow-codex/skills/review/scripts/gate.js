#!/usr/bin/env node
'use strict';

const { main } = require('../../../scripts/runtime/cli');

const [status, ...args] = process.argv.slice(2);
if (!['pass', 'fail'].includes(status)) {
  process.stderr.write('Usage: gate.js <pass|fail> --evidence JSON\n');
  process.exitCode = 2;
} else {
  try {
    process.exitCode = main(['gate', 'review', status, ...args], process.cwd());
  } catch (error) {
    process.stderr.write(`sd0x review gate: ${error.message}\n`);
    process.exitCode = 1;
  }
}

