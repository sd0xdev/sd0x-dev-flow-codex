#!/usr/bin/env node
'use strict';

// Static carrier accounting, deliberately not a tokenizer or host-context estimate.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { START, END } = require('./workflow-contract');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const size = text => ({ utf16_code_units: text.length, utf8_bytes: Buffer.byteLength(text),
  lines: text ? text.split('\n').length - Number(text.endsWith('\n')) : 0 });

function guidance(text) {
  const start = text.indexOf(START), end = text.indexOf(END);
  if (start === -1 && end === -1) return { managed: '', user: text, status: 'unmanaged' };
  if (start < 0 || end < start || text.indexOf(START, start + START.length) >= 0 ||
      text.indexOf(END, end + END.length) >= 0) throw new Error('Ambiguous managed guidance');
  return { managed: text.slice(start, end + END.length),
    user: text.slice(0, start) + text.slice(end + END.length), status: 'present' };
}

function readPayload(pluginRoot, relative) {
  if (typeof relative !== 'string' || relative.includes('\\') || relative.includes('\0') ||
      relative.startsWith('/') || relative.split('/').some(part => !part || part === '.' || part === '..')) throw new Error('Unsafe payload path');
  const root = fs.realpathSync(pluginRoot);
  let current = root;
  for (const part of relative.split('/')) {
    current = path.join(current, part);
    if (fs.lstatSync(current).isSymbolicLink()) throw new Error('Payload accounting refuses symlinks');
  }
  return fs.readFileSync(current);
}

function staticReport(projectRoot, pluginRoot, selected = []) {
  const agents = path.join(projectRoot, 'AGENTS.md');
  const text = fs.existsSync(agents) ? fs.readFileSync(agents, 'utf8') : '';
  const parts = guidance(text);
  const manifestBytes = fs.readFileSync(path.join(pluginRoot, '.codex-plugin/payload-manifest.json'));
  const manifest = JSON.parse(manifestBytes);
  const entries = manifest.files.filter(entry => /^skills\/[^/]+\/SKILL\.md$/.test(entry.path));
  const rows = entries.map(entry => {
    const bytes = readPayload(pluginRoot, entry.path);
    const body = bytes.toString('utf8');
    const description = /^description: (.+)$/m.exec(body);
    if (!description) throw new Error('Missing description: ' + entry.path);
    return { name: entry.path.split('/')[1], description: JSON.parse(description[1]),
      path: entry.path, sha256: hash(bytes), manifest_match: hash(bytes) === entry.sha256,
      size: size(body) };
  });
  if (new Set(selected).size !== selected.length || selected.some(name => !rows.some(row => row.name === name))) {
    throw new Error('Unknown or duplicate selected skill');
  }
  const references = manifest.files.filter(entry => selected.some(name =>
    entry.path.startsWith(`skills/${name}/references/`))).map(entry => {
    const bytes = readPayload(pluginRoot, entry.path);
    return { path: entry.path, sha256: hash(bytes), manifest_match: hash(bytes) === entry.sha256,
      size: size(bytes.toString('utf8')) };
  });
  return {
    schema_version: 1, kind: 'static-carriers', plugin_manifest_sha256: hash(manifestBytes),
    project_guidance: { status: parts.status, managed: size(parts.managed), user: size(parts.user), total: size(text) },
    discovery: { count: rows.length, full_disk_descriptions: size(rows.map(row => row.description).join('')),
      model_visible_catalog: null, entries: rows.map(({ description, ...row }) => row) },
    selected_skills: rows.filter(row => selected.includes(row.name)).map(({ description, ...row }) => row),
    available_references: references,
    observed_reads: null, dynamic_hook_emissions: null, token_accounting: null,
    exclusions: ['Host system/developer context', 'Other plugins', 'Ancestor and global guidance',
      'Session catalog rendering', 'Dynamic hook emissions', 'Actual model reads and token attribution'],
    interpretation: 'Available files are not observed reads; UTF-16 length and UTF-8 bytes are not tokens.'
  };
}

function checkBudget(report, budget) {
  const managed = report.project_guidance.managed;
  for (const key of ['utf16_code_units', 'lines']) {
    if (!Number.isSafeInteger(budget[key]) || budget[key] < 1) throw new Error('Invalid budget');
    if (managed[key] > budget[key]) throw new Error(`Managed ${key} exceeds budget; move procedures on demand`);
  }
  return true;
}

if (require.main === module) {
  try {
    const [project, plugin, ...selected] = process.argv.slice(2);
    if (!project || !plugin) throw new Error('usage: instruction-budget.js <project-root> <plugin-root> [skill ...]');
    console.log(JSON.stringify(staticReport(path.resolve(project), path.resolve(plugin), selected), null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { size, guidance, staticReport, checkBudget };
