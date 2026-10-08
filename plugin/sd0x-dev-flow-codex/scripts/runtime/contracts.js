'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const TOPICS = Object.freeze(['review-dispatch', 'review-scope', 'review-stall', 'testing',
  'documentation', 'git-authorization', 'git-policy', 'deployment']);

function locator(pluginRoot = path.resolve(__dirname, '../..')) {
  const root = fs.realpathSync(pluginRoot);
  const manifest = JSON.parse(fs.readFileSync(path.join(root, '.codex-plugin/plugin.json'), 'utf8'));
  if (manifest.name !== 'sd0x-dev-flow-codex' || typeof manifest.version !== 'string') throw new Error('Wrong plugin identity');
  return { root, name: manifest.name, version: manifest.version,
    reader: path.join(root, 'scripts/runtime/contracts.js'), topics: TOPICS };
}

function readContract(topic, { pluginRoot, expectedVersion } = {}) {
  if (!TOPICS.includes(topic)) throw new Error('Unknown contract topic');
  const installed = locator(pluginRoot);
  if (!expectedVersion || expectedVersion !== installed.version) throw new Error('Contract version does not match the active plugin');
  const relative = `scripts/contracts/${topic}.md`;
  const file = path.join(installed.root, relative);
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || !(stat.mode & 0o444)) throw new Error('Contract is unreadable');
  if (!fs.realpathSync(file).startsWith(installed.root + path.sep)) throw new Error('Contract escapes active plugin');
  const manifest = JSON.parse(fs.readFileSync(path.join(installed.root, '.codex-plugin/payload-manifest.json'), 'utf8'));
  const matching = manifest.files.filter(entry => entry.path === relative);
  const bytes = fs.readFileSync(file);
  if (matching.length !== 1 || matching[0].sha256 !== sha(bytes)) throw new Error('Contract does not match active payload manifest');
  return { topic, plugin: installed.name, version: installed.version, path: file,
    sha256: sha(bytes), bytes: bytes.length, content: bytes.toString('utf8') };
}

// This verifies bytes and delivers their content; it does not prove the model
// read or understood them. A failed read never invokes the dependent operation.
function withContract(topic, options, operation) {
  const contract = readContract(topic, options);
  return operation(contract);
}

if (require.main === module) {
  try {
    const [topic, version] = process.argv.slice(2);
    console.log(JSON.stringify(topic === '--locate' ? locator() : readContract(topic, { expectedVersion: version }), null, 2));
  } catch (error) { console.error('Contract unavailable: ' + error.message); process.exitCode = 1; }
}
module.exports = { TOPICS, locator, readContract, withContract };
