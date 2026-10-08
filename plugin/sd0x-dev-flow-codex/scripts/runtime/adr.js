'use strict';

// Read-only planning; the architecture skill owns document writes.
const fs = require('node:fs');
const path = require('node:path');
const { containedPath, resolveFeature } = require('../../skills/create-request/scripts/request-tool');

function planAdr(root, { feature, title, status = 'Proposed', supersedes = null }) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(title) || !['Proposed', 'Accepted'].includes(status)) {
    throw new Error('ADR requires a kebab-case title and Proposed or Accepted status');
  }
  const resolved = resolveFeature(root, { feature });
  if (!resolved.key) throw new Error('Resolve a feature before planning an ADR');
  const directory = resolved.docs_path;
  let max = 0;
  const found = new Map();
  for (const relative of [directory, directory + '/archived']) {
    const absolute = containedPath(root, relative).absolute;
    let entries;
    try { entries = fs.readdirSync(absolute, { withFileTypes: true }); }
    catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    for (const entry of entries) {
      const match = /^adr-(\d+)-.+\.md$/i.exec(entry.name);
      if (!match) continue;
      if (!entry.isFile() || entry.isSymbolicLink()) throw new Error('ADR corpus contains a non-regular record');
      const number = Number(match[1]);
      if (!Number.isSafeInteger(number) || number < 1 || number === Number.MAX_SAFE_INTEGER || found.has(number)) {
        throw new Error('ADR corpus has duplicate or invalid numbering');
      }
      found.set(number, relative + '/' + entry.name);
      max = Math.max(max, number);
    }
  }
  const number = String(max + 1).padStart(3, '0');
  const destination = `${directory}/adr-${number}-${title}.md`;
  containedPath(root, destination);
  let old = null;
  if (supersedes !== null) {
    if (!Number.isSafeInteger(supersedes) || !found.has(supersedes)) throw new Error('Superseded ADR does not exist');
    old = found.get(supersedes);
  }
  return { feature: resolved.key, destination, number, status, supersedes: old,
    links: old ? { from_new: path.posix.relative(directory, old),
      from_old: path.posix.relative(path.posix.dirname(old), destination) } : null };
}

if (require.main === module) {
  try {
    const [root, input] = process.argv.slice(2);
    if (!root || !input) throw new Error('usage: adr.js <repository-root> <JSON-input>');
    console.log(JSON.stringify(planAdr(path.resolve(root), JSON.parse(input)), null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { planAdr };
