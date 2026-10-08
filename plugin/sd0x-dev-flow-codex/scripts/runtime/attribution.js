'use strict';
const crypto = require('node:crypto');
const AGENT = '(?:Claude|Anthropic|\\bAI\\b|GPT|OpenAI|Copilot|Codex|Gemini)';
const FORBIDDEN = new RegExp(`(?:Co-Authored-By:.*${AGENT}|Generated[ -](?:by|with).*${AGENT}|🤖.*${AGENT})`, 'i');
function assertClean(text) {
  if (typeof text !== 'string') throw new Error('Expected literal attribution payload');
  if (text.split(/\r?\n/).some(line => FORBIDDEN.test(line))) throw new Error('Forbidden automated attribution');
  return true;
}
function sanitizePr({ title, body }) {
  assertClean(title);
  if (typeof body !== 'string') throw new Error('Expected literal PR body');
  const removed = [], kept = [];
  for (const line of body.split(/\r?\n/)) {
    if (FORBIDDEN.test(line)) removed.push(crypto.createHash('sha256').update(line).digest('hex'));
    else kept.push(line);
  }
  const clean = kept.join('\n');
  return { title, body: clean, body_bytes: Buffer.byteLength(clean),
    body_sha256: crypto.createHash('sha256').update(clean).digest('hex'),
    removed_count: removed.length, removed_line_sha256: removed };
}
module.exports = { assertClean, sanitizePr };
