#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { auditCandidate } = require('./skill-migration-audit');
const { atomicUpdateContainedFile } = require('./contained-file');

const ROOT = path.resolve(__dirname, '..');
const PLAN_PATH = path.join(ROOT, 'scripts', 'skill-wave-plans.json');
const DISPOSITION_PATH = path.join(ROOT, 'migration', 'source-disposition.json');

function fail(message) {
  throw new Error(message);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function replaceExactly(text, pattern, replacement, label) {
  const matches = text.match(pattern) || [];
  if (matches.length !== 1) fail(`${label}: expected exactly one matching record`);
  return text.replace(pattern, replacement);
}

function completeAcceptanceCriteria(markdown, requestPath) {
  const heading = '## Acceptance Criteria\n';
  const start = markdown.indexOf(heading);
  if (start < 0) fail(`${requestPath}: Acceptance Criteria section is missing`);
  const contentStart = start + heading.length;
  const nextHeading = markdown.indexOf('\n## ', contentStart);
  const end = nextHeading < 0 ? markdown.length : nextHeading + 1;
  const section = markdown.slice(contentStart, end);
  const criteria = [...section.matchAll(/^- \[ \] (.+)$/gm)]
    .map((match) => match[1]);
  const candidateStageContract = [
    /^Candidate preserves the complete [a-z0-9][a-z0-9 -]* workflow and its meaningful failure boundaries\.$/,
    /^Contract binds every assigned source name to this single canonical promotion unit\.$/,
    /^Compatibility aliases remain mapping-only and add no discovered skill entrypoints\.$/,
    /^Trusted routing tests distinguish positive prompts from adjacent skill boundaries\.$/,
    /^Candidate preflight binds exact payload and behavioral-test identity\.$/,
    /^Final (?:core|pack) destination and move-window comparison are fixed for the accepted candidate bytes\.$/,
    /^R3 closure inputs identify this exact request, promotion unit, evidence kind, and final-fingerprint fields\.$/
  ];
  if (criteria.length !== candidateStageContract.length ||
      candidateStageContract.some((pattern, index) =>
        !pattern.test(criteria[index] || '')) ||
      /^- \[x\] /m.test(section)) {
    fail(`${requestPath}: Acceptance Criteria must exactly match the Candidate Complete stage contract`);
  }
  const completed = section.replace(/^- \[ \] /gm, '- [x] ');
  if (!/^- \[x\] /m.test(completed) || /^- \[ \] /m.test(completed)) {
    fail(`${requestPath}: Acceptance Criteria cannot be completed deterministically`);
  }
  return markdown.slice(0, contentStart) + completed + markdown.slice(end);
}

function recordRequest(requestPath, result, options = {}) {
  const root = options.root || ROOT;
  const absolute = path.join(root, ...requestPath.split('/'));
  return atomicUpdateContainedFile(root, absolute, (current) => {
    let markdown = replaceExactly(
      current,
      /^> \*\*Status\*\*: In Progress$/gm,
      '> **Status**: Candidate Complete',
      requestPath
    );
    markdown = completeAcceptanceCriteria(markdown, requestPath);
    markdown = replaceExactly(
      markdown,
      /^\| Development \| In Progress \|.*\|$/gm,
      `| Development | Complete | Candidate payload \`${result.payload_tree_sha256}\` and its closed behavior contract are complete. |`,
      requestPath
    );
    markdown = replaceExactly(
      markdown,
      /^\| Testing \| Pending \|.*\|$/gm,
      `| Testing | Complete | Preflight \`${result.audit_fingerprint}\` binds the candidate payload, routing tests, and disposition rows. |`,
      requestPath
    );
    return replaceExactly(
      markdown,
      /^\| Acceptance \| Pending \|.*\|$/gm,
      '| Acceptance | Candidate Complete | Candidate evidence is complete; final audit and durable R3 closure remain pending. |',
      requestPath
    );
  }, options);
}

function reopenRequest(requestPath, options = {}) {
  const root = options.root || ROOT;
  const absolute = path.join(root, ...requestPath.split('/'));
  return atomicUpdateContainedFile(root, absolute, (current) => {
    let markdown = replaceExactly(
      current,
      /^> \*\*Status\*\*: Candidate Complete$/gm,
      '> **Status**: In Progress',
      requestPath
    );
    const heading = '## Acceptance Criteria\n';
    const start = markdown.indexOf(heading);
    const end = markdown.indexOf('\n## ', start + heading.length);
    if (start < 0 || end < 0) fail(`${requestPath}: Acceptance Criteria section is missing`);
    const section = markdown.slice(start, end).replace(/^- \[x\] /gm, '- [ ] ');
    markdown = markdown.slice(0, start) + section + markdown.slice(end);
    markdown = replaceExactly(
      markdown,
      /^\| Development \| Complete \|.*\|$/gm,
      '| Development | In Progress | Candidate bytes changed after review and require a fresh preflight. |',
      requestPath
    );
    markdown = replaceExactly(
      markdown,
      /^\| Testing \| Complete \|.*\|$/gm,
      '| Testing | Pending | Fresh candidate preflight evidence is not recorded yet. |',
      requestPath
    );
    return replaceExactly(
      markdown,
      /^\| Acceptance \| Candidate Complete \|.*\|$/gm,
      '| Acceptance | Pending | Fresh candidate evidence is not recorded yet. |',
      requestPath
    );
  }, options);
}

function main(argv = process.argv.slice(2)) {
  const [wave, ...rest] = argv;
  let selectedTarget = null;
  let reopen = false;
  for (let index = 0; index < rest.length; index += 1) {
    if (rest[index] === '--target') selectedTarget = rest[++index];
    else if (rest[index] === '--reopen') reopen = true;
    else fail(`unknown argument: ${rest[index]}`);
  }
  if (!/^[1-7]$/.test(wave || '') ||
      (selectedTarget !== null && !/^[a-z0-9][a-z0-9-]*$/.test(selectedTarget))) {
    fail('usage: record-skill-wave-preflight.js <wave> [--target TARGET] [--reopen]');
  }
  const plan = readJson(PLAN_PATH).waves?.[wave];
  if (!plan) fail(`wave ${wave} plan is unavailable`);
  const disposition = readJson(DISPOSITION_PATH);
  const targets = plan.targets.filter((target) =>
    selectedTarget === null || target.target === selectedTarget
  );
  if (targets.length === 0) fail(`wave ${wave} target is unavailable: ${selectedTarget}`);
  if (reopen) {
    const requests = new Set();
    for (const target of targets) {
      for (const unit of target.units) {
        for (const row of disposition.skills.filter((entry) =>
          entry.promotion_unit_id === unit.promotion_unit_id
        )) {
          if (row.promotion_request) requests.add(row.promotion_request);
        }
      }
    }
    for (const request of requests) reopenRequest(request);
  }
  const results = [];
  for (const target of targets) {
    for (const unit of target.units) {
      const result = auditCandidate({
        root: ROOT,
        candidate: `migration/candidates/${target.target}`,
        target: target.target,
        mode: unit.target_mode || 'default'
      });
      if (result.phase !== 'preflight' ||
          result.promotion_unit_id !== unit.promotion_unit_id) {
        fail(`${unit.promotion_unit_id}: unexpected preflight result`);
      }
      const rows = disposition.skills.filter((row) =>
        row.promotion_unit_id === unit.promotion_unit_id
      );
      const requests = [...new Set(rows.map((row) => row.promotion_request))];
      if (rows.length === 0 || requests.length !== 1 || !requests[0]) {
        fail(`${unit.promotion_unit_id}: candidate request owner is ambiguous`);
      }
      results.push({ request: requests[0], result });
    }
  }
  for (const entry of results) recordRequest(entry.request, entry.result);
  process.stdout.write(`${JSON.stringify({
    ok: true,
    wave: Number(wave),
    units: results.map((entry) => ({
      promotion_unit_id: entry.result.promotion_unit_id,
      payload_tree_sha256: entry.result.payload_tree_sha256,
      audit_fingerprint: entry.result.audit_fingerprint
    }))
  }, null, 2)}\n`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`record-skill-wave-preflight: ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  completeAcceptanceCriteria,
  main,
  recordRequest,
  reopenRequest
};
