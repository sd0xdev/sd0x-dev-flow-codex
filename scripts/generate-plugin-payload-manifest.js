#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {
  atomicWriteContainedFile,
  readContainedFile
} = require('./contained-file');

const ROOT = path.resolve(__dirname, '..');
const PLUGIN_ROOT = path.join(ROOT, 'plugin', 'sd0x-dev-flow-codex');
const MANIFEST = path.join(PLUGIN_ROOT, '.codex-plugin', 'payload-manifest.json');
const MANIFEST_RELATIVE = '.codex-plugin/payload-manifest.json';
const BYTEWISE = (left, right) => Buffer.from(left).compare(Buffer.from(right));

function payloadFiles() {
  const files = [];
  const visit = (absolute, relative = '') => {
    const entries = fs.readdirSync(absolute, { withFileTypes: true })
      .sort((left, right) => BYTEWISE(left.name, right.name));
    for (const entry of entries) {
      const childRelative = relative ? `${relative}/${entry.name}` : entry.name;
      if (childRelative === MANIFEST_RELATIVE) continue;
      const childAbsolute = path.join(absolute, entry.name);
      if (entry.isDirectory()) {
        visit(childAbsolute, childRelative);
      } else if (entry.isFile() && !entry.isSymbolicLink()) {
        files.push({ absolute: childAbsolute, relative: childRelative });
      } else {
        throw new Error(`plugin source payload must contain only real files and directories: ${childRelative}`);
      }
    }
  };
  visit(PLUGIN_ROOT);
  return files.sort((left, right) => BYTEWISE(left.relative, right.relative));
}

function expectedManifest() {
  return {
    schema_version: 1,
    files: payloadFiles().map((file) => ({
      path: file.relative,
      sha256: crypto.createHash('sha256')
        .update(readContainedFile(ROOT, file.absolute).bytes)
        .digest('hex')
    }))
  };
}

function serializedManifest() {
  return `${JSON.stringify(expectedManifest(), null, 2)}\n`;
}

function main(argv = process.argv.slice(2)) {
  if (argv.length > 1 || (argv.length === 1 && argv[0] !== '--check')) {
    throw new Error('usage: generate-plugin-payload-manifest.js [--check]');
  }
  const expected = serializedManifest();
  if (argv[0] === '--check') {
    const actual = readContainedFile(ROOT, MANIFEST, 'utf8').bytes;
    if (actual !== expected) {
      throw new Error('plugin payload manifest is stale; run npm run payload:manifest');
    }
    process.stdout.write('Plugin payload manifest is current.\n');
    return;
  }
  atomicWriteContainedFile(ROOT, MANIFEST, expected);
  process.stdout.write(`Updated ${path.relative(ROOT, MANIFEST)}.\n`);
}

if (require.main === module) main();

module.exports = { expectedManifest, payloadFiles, serializedManifest };
