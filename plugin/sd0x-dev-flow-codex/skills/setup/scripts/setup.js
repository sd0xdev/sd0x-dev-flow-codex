#!/usr/bin/env node
'use strict';

const runtime = require('../../../scripts/runtime/setup');

if (require.main === module) process.exitCode = runtime.run();

module.exports = runtime;
