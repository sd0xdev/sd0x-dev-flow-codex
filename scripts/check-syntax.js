#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const CHECK_ROOTS = [
  path.join(ROOT, 'scripts'),
  path.join(ROOT, 'plugin', 'sd0x-dev-flow-codex')
];

function javascriptFiles(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...javascriptFiles(absolute));
    else if (entry.isFile() && entry.name.endsWith('.js')) files.push(absolute);
  }
  return files;
}

function main() {
  const files = CHECK_ROOTS.flatMap(javascriptFiles).sort();
  for (const file of files) {
    const result = spawnSync(process.execPath, ['--check', file], {
      cwd: ROOT,
      stdio: 'inherit',
      windowsHide: true
    });
    if (result.status !== 0) return result.status || 1;
  }
  process.stdout.write(`Syntax checked ${files.length} shipped JavaScript files.\n`);
  return 0;
}

if (require.main === module) process.exitCode = main();

module.exports = { javascriptFiles, main };
