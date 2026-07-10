#!/usr/bin/env node
'use strict';

const { main } = require('../../../scripts/runtime/cli');

try {
  process.exitCode = main(['verify'], process.cwd());
} catch (error) {
  process.stderr.write(`sd0x verify: ${error.message}\n`);
  process.exitCode = 1;
}

