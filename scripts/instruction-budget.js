#!/usr/bin/env node
'use strict';
const path = require('node:path');
const runtime = require('../plugin/sd0x-dev-flow-codex/scripts/runtime/instruction-budget');
if (require.main === module) {
  try {
    const [project, plugin, ...selected] = process.argv.slice(2);
    if (!project || !plugin) throw new Error('usage: instruction-budget.js <project-root> <plugin-root> [skill ...]');
    console.log(JSON.stringify(runtime.staticReport(path.resolve(project), path.resolve(plugin), selected), null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = runtime;
