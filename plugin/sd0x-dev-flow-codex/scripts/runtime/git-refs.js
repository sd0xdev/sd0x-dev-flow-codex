'use strict';
const { spawnSync } = require('node:child_process');
const { environment } = require('./deployment');
const { branchName } = require('./git-policy');
function read(root, args) {
  const result = spawnSync('git', ['--no-replace-objects', '-c', 'core.fsmonitor=false', ...args], {
    cwd: root, env: environment(), timeout: 30000, maxBuffer: 16 * 1024 * 1024
  });
  if (result.error || result.status !== 0) throw new Error('Reference observation failed');
  return new TextDecoder('utf-8', { fatal: true }).decode(result.stdout);
}
function resolve(root, value) {
  if (!branchName(value)) throw new Error('Invalid literal reference');
  const raw = read(root, ['for-each-ref', '--format=%(refname)%00%(objectname)']);
  if (raw && !raw.endsWith('\n')) throw new Error('Truncated reference observation');
  const refs = raw.split('\n').filter(Boolean).map(line => {
    const fields = line.split('\0');
    if (fields.length !== 2 || !branchName(fields[0]) || !/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/.test(fields[1])) throw new Error('Malformed reference observation');
    return { ref: fields[0], oid: fields[1] };
  });
  const matches = refs.filter(item => [value, 'refs/heads/' + value, 'refs/tags/' + value, 'refs/remotes/' + value].includes(item.ref));
  if (matches.length > 1) throw new Error('Ambiguous short reference');
  if (!matches.length && value !== 'HEAD' && !/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/.test(value)) throw new Error('Reference is absent');
  const target = matches.length ? matches[0].ref : value;
  const oid = read(root, ['rev-parse', '--verify', '--end-of-options', target + '^{commit}']);
  if (!/^[a-f0-9]{40}(?:[a-f0-9]{24})?\n$/.test(oid)) throw new Error('Invalid commit resolution');
  return { requested: value, ref: target, oid: oid.slice(0, -1), refreshed: false };
}
function remoteMapping(destination, remotes) {
  if (!branchName(destination) || !destination.startsWith('refs/remotes/') || !Array.isArray(remotes)) throw new Error('Invalid remote mapping request');
  const candidates = [];
  const match = (pattern, value) => {
    const parts = pattern.split('*');
    if (parts.length > 2) throw new Error('Unsupported fetch mapping');
    if (parts.length === 1) return pattern === value ? '' : null;
    return value.startsWith(parts[0]) && value.endsWith(parts[1]) && value.length >= parts[0].length + parts[1].length
      ? value.slice(parts[0].length, value.length - parts[1].length) : null;
  };
  for (const remote of remotes) {
    if (!remote || !branchName(remote.name) || !Array.isArray(remote.fetch)) throw new Error('Malformed remote mapping');
    const negative = remote.fetch.filter(spec => typeof spec === 'string' && spec.startsWith('^')).map(spec => spec.slice(1));
    for (const raw of remote.fetch) {
      if (typeof raw !== 'string' || /[\x00-\x20\x7f]/.test(raw)) throw new Error('Malformed fetch mapping');
      if (raw.startsWith('^')) continue;
      const parts = raw.replace(/^\+/, '').split(':');
      if (parts.length !== 2 || !parts.every(part => /^refs\//.test(part))) throw new Error('Non-invertible fetch mapping');
      const captured = match(parts[1], destination); if (captured === null) continue;
      if (parts[0].includes('*') !== parts[1].includes('*')) throw new Error('Non-invertible fetch mapping');
      const source = parts[0].replace('*', captured);
      if (!branchName(source)) throw new Error('Invalid mapped source');
      if (negative.some(pattern => match(pattern, source) !== null)) continue;
      candidates.push({ remote: remote.name, source, destination });
    }
  }
  const unique = [...new Map(candidates.map(item => [JSON.stringify(item), item])).values()];
  if (unique.length !== 1) throw new Error('Remote destination lacks one unambiguous owner after negative exclusions');
  return unique[0];
}
module.exports = { resolve, remoteMapping };
