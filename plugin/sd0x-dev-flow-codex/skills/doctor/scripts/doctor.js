#!/usr/bin/env node
'use strict';

const { main } = require('../../../scripts/runtime/cli');

try {
  process.exitCode = main(['doctor'], process.cwd());
} catch (error) {
  process.stderr.write(`sd0x doctor: ${error.message}\n`);
  process.exitCode = 1;
}

