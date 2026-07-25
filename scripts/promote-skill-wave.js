#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { auditActiveCandidates } = require('./skill-migration-audit');
const { createRecoveryDirectory } = require('./recovery-directory');

const ROOT = path.resolve(__dirname, '..');
const PLAN_PATH = path.join(ROOT, 'scripts', 'skill-wave-plans.json');
const DISPOSITION_PATH = path.join(ROOT, 'migration', 'source-disposition.json');
const BYTEWISE = (left, right) => Buffer.from(left).compare(Buffer.from(right));

function fail(message) {
  throw new Error(message);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function regularTree(directory) {
  const files = [];
  const visit = (current, prefix) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      const absolute = path.join(current, entry.name);
      if (entry.isSymbolicLink()) fail(`payload contains symlink: ${relative}`);
      if (entry.isDirectory()) visit(absolute, relative);
      else if (entry.isFile()) files.push(relative);
      else fail(`payload contains non-regular entry: ${relative}`);
    }
  };
  visit(directory, '');
  files.sort(BYTEWISE);
  return files;
}

function treeDigest(directory) {
  const hash = crypto.createHash('sha256');
  for (const file of regularTree(directory)) {
    hash.update(file);
    hash.update('\0');
    hash.update(fs.readFileSync(path.join(directory, ...file.split('/'))));
    hash.update('\0');
  }
  return hash.digest('hex');
}

function requestIsCandidateComplete(root, requestPath) {
  return /^> \*\*Status\*\*: Candidate Complete$/m.test(
    fs.readFileSync(path.join(root, ...requestPath.split('/')), 'utf8')
  );
}

function requestPayload(root, requestPath) {
  const markdown = fs.readFileSync(
    path.join(root, ...requestPath.split('/')), 'utf8'
  );
  const matches = [...markdown.matchAll(/\bpayload `([0-9a-f]{64})`/g)];
  if (matches.length !== 1) fail(`${requestPath}: exact candidate payload is missing`);
  return matches[0][1];
}

function promotePack(target, candidate, destination) {
  if (fs.existsSync(destination)) fail(`${target}: pack destination already exists`);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.renameSync(candidate, destination);
}

function buildPromotionPlan(root, plan, disposition) {
  const moves = [];
  for (const target of plan.targets) {
    const rows = disposition.skills.filter((row) =>
      row.target_skill === target.target &&
      target.units.some((unit) => unit.promotion_unit_id === row.promotion_unit_id)
    );
    const requests = [...new Set(rows.map((row) => row.promotion_request))];
    if (rows.length === 0 ||
        rows.some((row) => row.delivery_state !== 'candidate') ||
        requests.some((request) =>
          !request || !requestIsCandidateComplete(root, request))) {
      fail(`${target.target}: all units must have Candidate Complete evidence`);
    }
    const payloads = [...new Set(requests.map((request) =>
      requestPayload(root, request)
    ))];
    if (payloads.length !== 1) fail(`${target.target}: requests disagree on payload`);
    const candidate = path.join(root, 'migration', 'candidates', target.target);
    const destination = target.target_package === 'core'
      ? path.join(root, 'plugin', 'sd0x-dev-flow-codex', 'skills', target.target)
      : path.join(root, 'migration', 'packs', target.target_package, target.target);
    const candidatePopulated = fs.existsSync(candidate) &&
      regularTree(candidate).length > 0;
    if (!candidatePopulated) {
      if (!fs.existsSync(destination) || treeDigest(destination) !== payloads[0]) {
        fail(`${target.target}: moved payload differs from Candidate Complete evidence`);
      }
      moves.push({
        target: target.target,
        target_package: target.target_package,
        payload_tree_sha256: payloads[0],
        action: 'already-moved',
        candidate,
        destination
      });
      continue;
    }
    if (treeDigest(candidate) !== payloads[0]) {
      fail(`${target.target}: candidate drifted after Candidate Complete preflight`);
    }
    if (target.target_package === 'core') {
      if (!fs.existsSync(destination)) fail(`${target.target}: core destination is missing`);
      const candidateFiles = regularTree(candidate);
      const missing = regularTree(destination).filter((file) =>
        !candidateFiles.includes(file)
      );
      if (missing.length > 0) {
        fail(`${target.target}: candidate omits existing core resources: ${missing.join(', ')}`);
      }
    } else if (fs.existsSync(destination)) {
      fail(`${target.target}: pack destination already exists before promotion`);
    }
    moves.push({
      target: target.target,
      target_package: target.target_package,
      payload_tree_sha256: payloads[0],
      action: 'move',
      candidate,
      destination
    });
  }
  return moves;
}

function applyPromotionMoves(root, moves, options = {}) {
  const pending = moves.filter((move) => move.action === 'move');
  const rollback = [];
  const removeCoreCandidate = options.removeCoreCandidate ||
    ((candidate) => fs.rmSync(candidate, { recursive: true }));
  const restoreTree = options.restoreTree ||
    ((source, destination) => fs.cpSync(source, destination, { recursive: true }));
  const recovery = createRecoveryDirectory(root, 'wave-promotion-', {
    deviceOf: options.recoveryDeviceOf,
    beforeCreate: options.beforeRecoveryCreate,
    beforeRemove: options.beforeRecoveryRemove
  });
  const temporary = recovery.directory;
  let retainRecovery = false;
  try {
    if (typeof options.onTemporary === 'function') options.onTemporary(temporary);
    return recovery.run(() => {
      for (const move of pending) {
        if (move.target_package === 'core') {
          const backup = `${move.target}-live`;
          const candidateBackup = `${move.target}-candidate`;
          fs.cpSync(move.destination, backup, { recursive: true });
          fs.cpSync(move.candidate, candidateBackup, { recursive: true });
          rollback.push({ ...move, backup, candidateBackup });
          fs.cpSync(move.candidate, move.destination, { recursive: true, force: true });
        } else {
          promotePack(move.target, move.candidate, move.destination);
          rollback.push(move);
        }
        if (treeDigest(move.destination) !== move.payload_tree_sha256) {
          fail(`${move.target}: promoted payload differs from accepted candidate`);
        }
      }
      for (const move of pending.filter((entry) => entry.target_package === 'core')) {
        removeCoreCandidate(move.candidate);
      }
      return moves;
    });
  } catch (error) {
    return recovery.run(() => {
      const rollbackErrors = [];
      for (const move of rollback.reverse()) {
        if (move.target_package === 'core') {
          try {
            fs.rmSync(move.destination, { recursive: true, force: true });
            restoreTree(move.backup, move.destination, 'live', move);
          } catch (rollbackError) {
            rollbackErrors.push({
              target: move.target,
              tree: 'live',
              message: rollbackError.message
            });
          }
          try {
            fs.rmSync(move.candidate, { recursive: true, force: true });
            restoreTree(move.candidateBackup, move.candidate, 'candidate', move);
          } catch (rollbackError) {
            rollbackErrors.push({
              target: move.target,
              tree: 'candidate',
              message: rollbackError.message
            });
          }
        } else if (fs.existsSync(move.destination) && !fs.existsSync(move.candidate)) {
          try {
            fs.renameSync(move.destination, move.candidate);
          } catch (rollbackError) {
            rollbackErrors.push({
              target: move.target,
              tree: 'pack-candidate',
              message: rollbackError.message
            });
          }
        }
      }
      if (rollbackErrors.length > 0) {
        retainRecovery = true;
        const recoveryDetails = {
          schema_version: 1,
          operation: 'promote-skill-wave',
          original_error: error.message,
          rollback_errors: rollbackErrors,
          moves: rollback.map((move) => ({
            target: move.target,
            target_package: move.target_package,
            candidate: move.candidate,
            destination: move.destination,
            payload_tree_sha256: move.payload_tree_sha256,
            backup: move.backup
              ? path.join(temporary, move.backup)
              : null,
            candidate_backup: move.candidateBackup
              ? path.join(temporary, move.candidateBackup)
              : null
          }))
        };
        try {
          fs.writeFileSync('recovery.json',
            `${JSON.stringify(recoveryDetails, null, 2)}\n`, { flag: 'wx' });
        } catch {
          // The explicit recovery directory and backup paths remain in the error.
        }
        throw new Error(
          `promotion failed and rollback was incomplete; recovery retained at ` +
          `${temporary}; original error: ${error.message}; rollback errors: ` +
          `${rollbackErrors.map((entry) =>
            `${entry.target}:${entry.tree}:${entry.message}`
          ).join('; ')}`
        );
      }
      throw error;
    });
  } finally {
    if (!retainRecovery) recovery.remove();
  }
}

function main(argv = process.argv.slice(2)) {
  const [wave] = argv;
  if (!/^[1-7]$/.test(wave || '') || argv.length !== 1) {
    fail('usage: promote-skill-wave.js <wave>');
  }
  const plan = readJson(PLAN_PATH).waves?.[wave];
  if (!plan) fail(`wave ${wave} plan is unavailable`);
  const disposition = readJson(DISPOSITION_PATH);
  const moves = buildPromotionPlan(ROOT, plan, disposition);
  auditActiveCandidates({ root: ROOT });
  applyPromotionMoves(ROOT, moves);
  process.stdout.write(`${JSON.stringify({
    ok: true,
    wave: Number(wave),
    moves: moves.map(({ candidate, destination, ...move }) => move)
  }, null, 2)}\n`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`promote-skill-wave: ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  applyPromotionMoves,
  buildPromotionPlan,
  main,
  regularTree,
  treeDigest
};
