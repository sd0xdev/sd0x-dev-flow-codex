'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

function regularFile(relative) {
  let current = ROOT;
  for (const component of relative.split('/')) {
    current = path.join(current, component);
    const stat = fs.lstatSync(current, { throwIfNoEntry: false });
    if (!stat || stat.isSymbolicLink()) return null;
  }
  return fs.lstatSync(current).isFile() ? current : null;
}

function readActiveSkill(target, resourcePaths) {
  const candidate = path.posix.join(
    'migration/candidates', target, 'SKILL.md'
  );
  const delivered = path.posix.join(
    'plugin/sd0x-dev-flow-codex/skills', target, 'SKILL.md'
  );
  const selected = regularFile(candidate) || regularFile(delivered);
  if (!selected) throw new Error('active supplemental skill payload is missing');
  const payloadRoot = path.dirname(selected);
  return {
    skill: fs.readFileSync(selected, 'utf8'),
    resources: resourcePaths.map((relative) => ({
      relative,
      present: Boolean(regularFile(path.relative(ROOT,
        path.join(payloadRoot, ...relative.split('/'))).split(path.sep).join('/')))
    }))
  };
}

module.exports = { readActiveSkill };
