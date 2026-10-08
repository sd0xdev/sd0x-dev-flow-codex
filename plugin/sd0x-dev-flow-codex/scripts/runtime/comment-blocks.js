'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { containedPath } = require('../../skills/create-request/scripts/request-tool');
const EXEMPT = /SPDX-License-Identifier|Copyright\s+(?:\(c\)|©|\d{4})|eslint-disable|shellcheck\s+disable/i;


// Only classify a lexically understood prefix. Template interpolation, regexp
// literals and shell heredocs need a parser; explicitly leave their suffix for
// manual confirmation instead of treating literal data as definite comments.
function commentPrefix(text, language) {
  const lines = text.split('\n'), comments = [];
  let quote = null, block = false;
  for (let row = 0; row < lines.length; row++) {
    const line = lines[row];
    comments[row] = block || (!quote && (language === 'sh' ? /^\s*#/ : /^\s*\/\//).test(line));
    for (let col = 0; col < line.length; col++) {
      const ch = line[col], next = line[col + 1];
      if (block) {
        if (ch === '*' && next === '/') { block = false; col++; }
        continue;
      }
      if (quote) {
        if (ch === '\\' && !(language === 'sh' && quote === "'")) { col++; continue; }
        if (ch === quote) quote = null;
        continue;
      }
      if (language === 'js' && ch === '/' && next === '/') break;
      if (language === 'sh' && ch === '#' && (col === 0 || /\s|[;|&()]/.test(line[col - 1]))) break;
      if (language === 'js' && ch === '/' && next === '*') {
        if (!line.slice(0, col).trim()) comments[row] = true;
        block = true; col++; continue;
      }
      const reason = ch === '`' ? 'template-or-command-substitution' :
        language === 'sh' && ch === '<' && next === '<' ? 'heredoc-or-here-string' :
        language === 'js' && ch === '/' ? 'regexp-or-division' : null;
      if (reason) return { lines: lines.slice(0, row), comments: comments.slice(0, row),
        manual_regions: [{ line: row + 1, end_line: lines.length, reason }] };
      if (ch === "'" || ch === '"') quote = ch;
      else if (ch === '\\') col++;
    }
    if (quote) return { lines: lines.slice(0, row), comments: comments.slice(0, row),
      manual_regions: [{ line: row + 1, end_line: lines.length, reason: 'multiline-quoted-data' }] };
  }
  return { lines, comments, manual_regions: quote || block
    ? [{ line: lines.length, end_line: lines.length, reason: 'unterminated-lexical-region' }] : [] };
}


function analyzeComments(text, language = 'js') {
  if (!['js', 'sh'].includes(language)) throw new Error('Unsupported comment language');
  const { lines, comments, manual_regions } = commentPrefix(text, language), findings = [];
  let block = null, bridged = false;
  const finish = () => {
    if (block) {
      const count = block.count - (block.exempt ? block.head_count : 0);
      if (count) findings.push({ line: block.exempt ? block.rest_line : block.line, count,
        severity: count >= 30 ? 'block' : count >= 25 ? 'warn' : null });
    }
    block = null; bridged = false;
  };
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const comment = comments[index];
    if (comment) {
      if (!block) block = { line: index + 1, count: 0, head_count: 0, rest_line: null, exempt: EXEMPT.test(line) };
      block.count++;
      if (!bridged) block.head_count++;
      else if (block.rest_line === null) block.rest_line = index + 1;
    } else if (block && /^\s*$/.test(line)) bridged = true;
    else finish();
  }
  finish();
  return { findings, manual_regions };
}

function commentBlocks(text, language = 'js') { return analyzeComments(text, language).findings; }

function scanComments(root, files) {
  if (!Array.isArray(files) || new Set(files).size !== files.length || files.length > 1000) throw new Error('Expected bounded unique file scope');
  if (!files.length) return { outcome: 'uncovered', files: 0, findings: [] };
  const findings = [], manual_regions = [];
  for (const file of files) {
    if (typeof file !== 'string' || !/\.(?:[cm]?js|sh)$/.test(file)) throw new Error('Unsupported comment file');
    const checked = containedPath(root, file);
    if (!checked.exists || !fs.statSync(checked.absolute).isFile()) throw new Error('Comment input is not a regular file');
    const language = path.extname(file) === '.sh' ? 'sh' : 'js';
    const result = analyzeComments(fs.readFileSync(checked.absolute, 'utf8'), language);
    manual_regions.push(...result.manual_regions.map(region => ({ file, ...region })));
    for (const finding of result.findings) {
      if (finding.severity) findings.push({ file, ...finding });
    }
  }
  return { outcome: findings.some(row => row.severity === 'block') ? 'findings' : manual_regions.length ? 'manual-confirmation-required' : 'checked', files: files.length, findings, manual_regions,
    gate_authority: false };
}
module.exports = { commentBlocks, scanComments, analyzeComments };
