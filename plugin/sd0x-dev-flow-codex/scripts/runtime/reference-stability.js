'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { containedPath } = require('../../skills/create-request/scripts/request-tool');
const { resolveDocRole } = require('./doc-metadata');

function plan(root, options = {}) {
  const files = options.files;
  if (options.auto || !Array.isArray(files) || !files.length || files.length > 5 || new Set(files).size !== files.length) {
    throw new Error('reference-stability requires 1–5 explicit unique files; auto is incompatible');
  }
  root = fs.realpathSync(root);
  return files.map(file => {
    const checked = containedPath(root, file);
    const stat = fs.lstatSync(checked.absolute);
    if (!stat.isFile()) throw new Error('reference-stability requires explicitly enumerated regular files');
    const text = fs.readFileSync(checked.absolute, 'utf8');
    const role = resolveDocRole(checked.relative, text);
    if (['Work record', 'History record'].includes(role) || /(?:^|\/)(?:fixtures?|snapshots?|evidence)(?:\/|\.)/i.test(file)) {
      return { file, status: 'exempt-record', eligible_pointers: [], count: 0 };
    }
    const extension = path.extname(file);
    if (!['.md', '.js', '.cjs', '.mjs', '.sh'].includes(extension)) throw new Error('Unsupported reference-stability surface');
    const pointers = [];
    let fence = null, htmlComment = false;
    // Regex locations in code are candidates only: a comment-looking line can
    // still be inside a template string or heredoc. Manual lexical confirmation
    // is required before counting it as eligible or changing it.
    text.split(/\r?\n/).forEach((line, index) => {
      if (extension === '.md') {
        const marker = /^ {0,3}(`{3,}|~{3,})/.exec(line);
        if (marker) {
          if (!fence) fence = marker[1];
          else if (marker[1][0] === fence[0] && marker[1].length >= fence.length &&
            /^ {0,3}(?:`+|~+)\s*$/.test(line)) fence = null;
          return;
        }
        const inComment = htmlComment || line.includes('<!--');
        if (line.includes('<!--')) htmlComment = true;
        if (line.includes('-->')) htmlComment = false;
        if (fence || inComment || /^ {4}|^\t|^\s*>/.test(line)) return;
      } else if (!(/^\s*\/\//.test(line) && extension !== '.sh') &&
                 !(extension === '.sh' && /^\s*#(?!\!)/.test(line))) return;
      if (/eslint|prettier|istanbul|@ts-|shellcheck|sourceMappingURL|sd0x-.*:v\d/i.test(line)) return;
      for (const match of line.matchAll(/(?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+\.[A-Za-z0-9]+:\d+(?:-\d+)?/g)) {
        pointers.push({ line: index + 1, pointer: match[0] });
      }
    });
    return { file, status: extension === '.md' ? 'measured' : 'manual-confirmation-required',
      eligible_pointers: extension === '.md' ? pointers : [],
      candidate_pointers: extension === '.md' ? [] : pointers,
      count: extension === '.md' ? pointers.length : null,
      manual_regions: extension === '.md' ? [] : ['block comments and embedded language boundaries'],
      write_performed: false, gate_authority: false };
  });
}
module.exports = { plan };
