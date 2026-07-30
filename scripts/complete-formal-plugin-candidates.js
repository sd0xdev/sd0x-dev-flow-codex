#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const {
  writeText
} = require('./prepare-skill-wave');

const ROOT = path.resolve(__dirname, '..');
const DISPOSITION_PATH = path.join(ROOT, 'migration', 'source-disposition.json');
const BYTEWISE = (left, right) => Buffer.from(left).compare(Buffer.from(right));

function fail(message) {
  throw new Error(message);
}

function replaceProgress(markdown, phase, status, note) {
  const pattern = new RegExp(`^\\| ${phase} \\| [^|]+ \\|.*\\|$`, 'm');
  if (!pattern.test(markdown)) fail(`${phase}: progress row is missing`);
  return markdown.replace(pattern, `| ${phase} | ${status} | ${note} |`);
}

function candidateRecords(disposition) {
  const records = new Map();
  for (const row of disposition.skills) {
    if (row.delivery_state !== 'candidate' ||
        !/\/2026-07-28-wave[5-7]-.*-promotion\.md$/.test(
          row.promotion_request || '')) continue;
    if (!records.has(row.promotion_unit_id)) {
      records.set(row.promotion_unit_id, {
        mode: row.target_mode || 'default',
        request: row.promotion_request,
        target: row.target_skill
      });
    }
  }
  return [...records.entries()].sort(([left], [right]) => BYTEWISE(left, right));
}

function auditRecord(unit, record) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [
      path.join(ROOT, 'scripts', 'skill-migration-audit.js'),
      'audit-candidate',
      `migration/candidates/${record.target}`,
      '--target', record.target,
      '--mode', record.mode
    ], {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`${unit}: ${(stderr || stdout).trim()}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (error) {
        reject(new Error(`${unit}: invalid candidate audit result: ${error.message}`));
      }
    });
  });
}

async function auditRecords(records, concurrency = 6) {
  const results = new Map();
  let next = 0;
  async function worker() {
    while (next < records.length) {
      const index = next;
      next += 1;
      const [unit, record] = records[index];
      results.set(unit, await auditRecord(unit, record));
      process.stdout.write(`audit ${unit}\n`);
    }
  }
  await Promise.all(Array.from(
    { length: Math.min(concurrency, records.length) },
    () => worker()
  ));
  return results;
}

async function main(argv = process.argv.slice(2)) {
  if (argv.some((value) => value !== '--refresh')) {
    fail('usage: complete-formal-plugin-candidates.js [--refresh]');
  }
  const refresh = argv.includes('--refresh');
  const disposition = JSON.parse(fs.readFileSync(DISPOSITION_PATH, 'utf8'));
  const records = candidateRecords(disposition);
  if (refresh) {
    for (const [unit, record] of records) {
      const requestPath = path.join(ROOT, ...record.request.split('/'));
      let next = fs.readFileSync(requestPath, 'utf8')
        .replace(/^> \*\*Status\*\*: Candidate Complete$/m,
          '> **Status**: In Progress');
      next = replaceProgress(next, 'Development', 'In Progress',
        'Refreshing the formal-plugin candidate after repository identity changed.');
      next = replaceProgress(next, 'Testing', 'Pending', '');
      next = replaceProgress(next, 'Acceptance', 'Pending', '');
      writeText(requestPath, next);
      process.stdout.write(`refresh ${unit}\n`);
    }
  }
  const pending = records.filter(([, record]) => {
    const requestPath = path.join(ROOT, ...record.request.split('/'));
    return !/^> \*\*Status\*\*: Candidate Complete$/m.test(
      fs.readFileSync(requestPath, 'utf8')
    );
  });
  const evidence = await auditRecords(pending);
  for (const [unit, record] of records) {
    const requestPath = path.join(ROOT, ...record.request.split('/'));
    const current = fs.readFileSync(requestPath, 'utf8');
    if (/^> \*\*Status\*\*: Candidate Complete$/m.test(current)) {
      process.stdout.write(`skip ${unit}: already Candidate Complete\n`);
      continue;
    }
    const result = evidence.get(unit);
    if (!result) fail(`${unit}: candidate audit result is missing`);
    let next = current
      .replace(/^> \*\*Status\*\*: In Progress$/m,
        '> **Status**: Candidate Complete')
      .replace(/^- \[ \]/gm, '- [x]');
    next = replaceProgress(next, 'Development', 'Complete',
      `Formal-plugin candidate payload \`${result.payload_tree_sha256}\` preserves the accepted predecessor behavior and package boundary.`);
    next = replaceProgress(next, 'Testing', 'Complete',
      `Routing, semantic, and static checks passed. Preflight \`${result.audit_fingerprint}\`.`);
    next = replaceProgress(next, 'Acceptance', 'Candidate Complete',
      'Candidate evidence is complete; final plugin move, fingerprint gates, closure, and promotion evidence remain pending.');
    writeText(requestPath, next);
    process.stdout.write(`complete ${unit} ${result.payload_tree_sha256} ${result.audit_fingerprint}\n`);
  }
  process.stdout.write(`${JSON.stringify({ ok: true, units: records.length })}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`complete-formal-plugin-candidates: ${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  auditRecords,
  candidateRecords,
  main,
  replaceProgress
};
