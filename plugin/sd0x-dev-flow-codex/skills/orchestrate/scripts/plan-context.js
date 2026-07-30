'use strict';

const fs = require('node:fs');
const path = require('node:path');

function fail(message) {
  process.stderr.write('plan-context: ' + message + '\n');
  process.exitCode = 1;
}

function regularDirectory(candidate) {
  return Boolean(
    fs.lstatSync(candidate, { throwIfNoEntry: false }) &&
    fs.lstatSync(candidate, { throwIfNoEntry: false }).isDirectory() &&
    !fs.lstatSync(candidate, { throwIfNoEntry: false }).isSymbolicLink()
  );
}

function regularFile(candidate) {
  return Boolean(
    fs.lstatSync(candidate, { throwIfNoEntry: false }) &&
    fs.lstatSync(candidate, { throwIfNoEntry: false }).isFile() &&
    !fs.lstatSync(candidate, { throwIfNoEntry: false }).isSymbolicLink()
  );
}

function validSkillName(name) {
  if (name.length === 0) return false;
  for (const character of name) {
    const code = character.charCodeAt(0);
    const lowercase = code >= 97 && code <= 122;
    const digit = code >= 48 && code <= 57;
    if (!lowercase && !digit && character !== '-') return false;
  }
  return name[0] !== '-';
}

function main(argv) {
  if (argv.length !== 0) throw new Error('usage: plan-context.js');
  const repository = process.cwd();
  const skillRoot = path.resolve(__dirname, '..', '..');
  const skills = regularDirectory(skillRoot)
    ? fs.readdirSync(skillRoot).filter(function (name) {
      return validSkillName(name) &&
        regularFile(path.join(skillRoot, name, 'SKILL.md'));
    }).sort()
    : [];
  const signals = [
    'AGENTS.md',
    'package.json',
    'docs/features',
    'test',
    '.sd0x'
  ].map(function (relative) {
    const absolute = path.join(repository, relative);
    return {
      path: relative,
      present: Boolean(fs.lstatSync(absolute, { throwIfNoEntry: false }) &&
        !fs.lstatSync(absolute, { throwIfNoEntry: false }).isSymbolicLink()),
      kind: regularDirectory(absolute) ? 'directory' : regularFile(absolute) ? 'file' : 'missing'
    };
  });
  process.stdout.write(JSON.stringify({
    schema_version: 1,
    repository: repository,
    skill_candidates: skills,
    repo_signals: signals,
    budgets: { max_steps: 24, max_workers: 3, max_waves: 4 }
  }) + '\n');
}

try {
  main(process.argv.slice(2));
} catch (error) {
  fail(error.message);
}
