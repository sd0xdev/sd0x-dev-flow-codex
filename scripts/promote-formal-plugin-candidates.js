#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  auditActiveCandidates
} = require('./skill-migration-audit');
const {
  applyPromotionMoves,
  buildPromotionPlan
} = require('./promote-skill-wave');

const ROOT = path.resolve(__dirname, '..');
const DISPOSITION_PATH = path.join(ROOT, 'migration', 'source-disposition.json');
const BYTEWISE = (left, right) => Buffer.from(left).compare(Buffer.from(right));

function formalPlan(disposition) {
  const targets = new Map();
  for (const row of disposition.skills) {
    if (row.delivery_state !== 'candidate' ||
        !/\/2026-07-28-wave[5-7]-.*-promotion\.md$/.test(
          row.promotion_request || '')) continue;
    if (!targets.has(row.target_skill)) {
      targets.set(row.target_skill, {
        target: row.target_skill,
        target_package: 'core',
        units: []
      });
    }
    const target = targets.get(row.target_skill);
    if (!target.units.some((unit) =>
      unit.promotion_unit_id === row.promotion_unit_id)) {
      target.units.push({ promotion_unit_id: row.promotion_unit_id });
    }
  }
  return {
    targets: [...targets.values()].sort((left, right) =>
      BYTEWISE(left.target, right.target))
  };
}

function main() {
  const disposition = JSON.parse(fs.readFileSync(DISPOSITION_PATH, 'utf8'));
  const plan = formalPlan(disposition);
  const audit = auditActiveCandidates({ root: ROOT });
  const auditedUnits = new Set(audit.units.map((unit) => unit.promotion_unit_id));
  const plannedUnits = plan.targets.flatMap((target) => target.units)
    .map((unit) => unit.promotion_unit_id);
  if (!plannedUnits.every((unit) => auditedUnits.has(unit))) {
    throw new Error('active candidate audit does not cover the formal promotion plan');
  }
  const moves = buildPromotionPlan(ROOT, plan, disposition);
  applyPromotionMoves(ROOT, moves);
  process.stdout.write(`${JSON.stringify({
    ok: true,
    targets: moves.length,
    moves: moves.map(({ candidate, destination, ...move }) => move)
  }, null, 2)}\n`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`promote-formal-plugin-candidates: ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  formalPlan,
  main
};
