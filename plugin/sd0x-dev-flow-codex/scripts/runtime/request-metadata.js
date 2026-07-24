'use strict';

function renderedMarkdownLines(markdown) {
  const records = [];
  let fence = null;
  let htmlComment = false;
  let htmlCommentBlock = false;
  let htmlBlockEnd = null;
  let paragraphOpen = false;
  const rawHtmlBlocks = new Set([
    'address', 'article', 'aside', 'base', 'basefont', 'blockquote', 'body',
    'caption', 'center', 'col', 'colgroup', 'dd', 'details', 'dialog', 'dir',
    'div', 'dl', 'dt', 'fieldset', 'figcaption', 'figure', 'footer', 'form',
    'frame', 'frameset', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'head', 'header',
    'hr', 'html', 'iframe', 'legend', 'li', 'link', 'main', 'menu', 'menuitem',
    'nav', 'noframes', 'ol', 'optgroup', 'option', 'p', 'param', 'search',
    'section', 'summary', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead',
    'title', 'tr', 'track', 'ul'
  ]);
  const endsHtmlBlock = (state, line) => state.kind === 'blank'
    ? /^[ \t]*$/.test(line)
    : state.kind === 'tag'
      ? new RegExp(`</${state.tag}>`, 'i').test(line)
      : line.includes(state.token);
  for (const raw of String(markdown).replace(/\r\n?/g, '\n').split('\n')) {
    if (fence) {
      const quotePrefix = fence.quoteDepth > 0
        ? `(?:> ?){${fence.quoteDepth}}`
        : '';
      const closing = new RegExp(
        `^ {0,3}${quotePrefix}${fence.character}{${fence.length},}[ \\t]*$`
      );
      if (closing.test(raw)) fence = null;
      records.push({ rendered: false, text: '' });
      continue;
    }
    if (htmlBlockEnd) {
      if (endsHtmlBlock(htmlBlockEnd, raw)) htmlBlockEnd = null;
      paragraphOpen = false;
      records.push({ rendered: false, text: '' });
      continue;
    }
    if (htmlCommentBlock) {
      if (raw.includes('-->')) htmlCommentBlock = false;
      paragraphOpen = false;
      records.push({ rendered: false, text: '' });
      continue;
    }
    if (htmlComment) {
      if (raw.includes('-->')) htmlComment = false;
      paragraphOpen = false;
      records.push({ rendered: false, text: '' });
      continue;
    }
    if (/^ {0,3}<!--/.test(raw)) {
      if (!raw.includes('-->')) htmlCommentBlock = true;
      paragraphOpen = false;
      records.push({ rendered: false, text: '' });
      continue;
    }
    let cursor = 0;
    let visible = '';
    while (cursor < raw.length) {
      const open = raw.indexOf('<!--', cursor);
      if (open < 0) {
        visible += raw.slice(cursor);
        break;
      }
      visible += raw.slice(cursor, open);
      const close = raw.indexOf('-->', open + 4);
      if (close < 0) {
        htmlComment = true;
        cursor = raw.length;
      } else {
        cursor = close + 3;
      }
    }
    const opening = /^ {0,3}((?:> ?)*)(`{3,}|~{3,})/.exec(visible);
    if (opening) {
      fence = {
        character: opening[2][0],
        length: opening[2].length,
        quoteDepth: (opening[1].match(/>/g) || []).length
      };
      paragraphOpen = false;
      records.push({ rendered: false, text: '' });
    } else if (/^(?: {4}|\t)/.test(visible)) {
      paragraphOpen = false;
      records.push({ rendered: false, text: '' });
    } else {
      const typeOne = /^ {0,3}<(script|pre|style|textarea)(?:\s|>|$)/i.exec(visible);
      const typeSix = /^ {0,3}<\/?([A-Za-z][A-Za-z0-9-]*)(?:\s|\/?>|$)/.exec(visible);
      const genericOpen = /^ {0,3}<[A-Za-z][A-Za-z0-9-]*(?:\s+[A-Za-z_:][A-Za-z0-9_.:-]*(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*\s*\/?>\s*$/.test(visible);
      const genericClose = /^ {0,3}<\/[A-Za-z][A-Za-z0-9-]*\s*>\s*$/.test(visible);
      let openedHtmlBlock = null;
      if (typeOne) {
        openedHtmlBlock = { kind: 'tag', tag: typeOne[1].toLowerCase() };
      } else if (/^ {0,3}<\?/.test(visible)) {
        openedHtmlBlock = { kind: 'token', token: '?>' };
      } else if (/^ {0,3}<!\[CDATA\[/.test(visible)) {
        openedHtmlBlock = { kind: 'token', token: ']]>' };
      } else if (/^ {0,3}<![A-Z]/.test(visible)) {
        openedHtmlBlock = { kind: 'token', token: '>' };
      } else if ((typeSix && rawHtmlBlocks.has(typeSix[1].toLowerCase())) ||
                 (!paragraphOpen && (genericOpen || genericClose))) {
        openedHtmlBlock = { kind: 'blank' };
      }
      if (openedHtmlBlock) {
        if (openedHtmlBlock.kind === 'blank' ||
            !endsHtmlBlock(openedHtmlBlock, visible)) {
          htmlBlockEnd = openedHtmlBlock;
        }
        paragraphOpen = false;
        records.push({ rendered: false, text: '' });
      } else {
        records.push({ rendered: true, text: visible });
        const blockStart = /^ {0,3}(?:#{1,6}(?:[ \t]+|$)|>|(?:[-+*]|\d+[.)])[ \t]+|(?:[-*_][ \t]*){3,}$)/.test(
          visible
        );
        paragraphOpen = visible.trim().length > 0 && !blockStart;
      }
    }
  }
  return records;
}

function canonicalMetadataField(content, field) {
  const rawLines = String(content).replace(/\r\n?/g, '\n').split('\n');
  const lines = renderedMarkdownLines(content);
  let metadataEnd = lines.length;
  const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const quoted = new RegExp(`^>\\s*\\*\\*${escaped}\\*\\*:\\s*(.+?)\\s*$`, 'i');
  const table = new RegExp(
    `^\\|\\s*${escaped}\\s*\\|\\s*\\*{0,2}([^|*]+?)\\*{0,2}\\s*\\|\\s*$`,
    'i'
  );
  const rawMatches = [];
  for (let index = 0; index < rawLines.length; index += 1) {
    const match = quoted.exec(rawLines[index]) || table.exec(rawLines[index]);
    if (match) {
      rawMatches.push({
        index,
        value: match[1].trim().replace(/^`|`$/g, '')
      });
    }
  }
  const matches = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (!lines[index].rendered) continue;
    const line = lines[index].text;
    if (metadataEnd === lines.length && /^##\s+/.test(line)) {
      metadataEnd = index;
    }
    const match = quoted.exec(line) || table.exec(line);
    if (match) matches.push({ index, value: match[1].trim().replace(/^`|`$/g, '') });
  }
  if (rawMatches.length === 0) return null;
  if (rawMatches.length !== 1 || matches.length !== 1 ||
      rawMatches[0].index !== matches[0].index ||
      rawMatches[0].value !== matches[0].value ||
      matches[0].index >= metadataEnd ||
      matches[0].index >= 20) {
    throw new Error(`Request must contain exactly one canonical ${field} metadata field`);
  }
  return matches[0].value;
}

function canonicalRequestStatus(content) {
  return canonicalMetadataField(content, 'Status');
}

module.exports = {
  canonicalMetadataField,
  canonicalRequestStatus,
  renderedMarkdownLines
};
