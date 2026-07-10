#!/usr/bin/env node
'use strict';

const { main } = require('../../../scripts/runtime/cli');

try {
  process.exitCode = main(['snapshot'], process.cwd());
} catch (error) {
  process.stderr.write(`sd0x snapshot: ${error.message}\n`);
  process.exitCode = 1;
}

