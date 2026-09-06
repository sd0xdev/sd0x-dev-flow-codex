'use strict';

const path = require('node:path');

const SECRET_PATH = new RegExp('(?:^|/)(?:\\.env(?:\\..*)?|credentials?\\.[^/]+|[^/]*secret[^/]*|[^/]*(?:private[-_.]?key|token[-_.]?store)[^/]*)$', 'i');
const HIGH_DIRECT = new RegExp('\\b(?:sk-[A-Za-z0-9_-]{12,}|gh[opsu]_[A-Za-z0-9]{12,}|AKIA[A-Z0-9]{12,})\\b', 'gi');
// Match the assignment suffix directly, including JSON keys and API_TOKEN.
// Scanning an arbitrary kebab-case prefix at every word boundary is quadratic.
const NAMED = new RegExp("(?:token|password|passwd|pwd|secret|api[_-]?key|credential|bearer|auth[_-]?value)(?:\\x27|\\x22|\\x60)?\\s*[:=]\\s*", "gi");
const MEDIUM_LABEL = new RegExp("^(?:credential|bearer|auth[_-]?value)(?:\\x27|\\x22|\\x60)?\\s*[:=]", "i");

function isSecretPath(relative) {
  const normalized = String(relative).split('\\').join('/');
  return path.posix.isAbsolute(normalized) || normalized.split('/').includes('..') ||
    SECRET_PATH.test(normalized);
}

function mask(value) {
  if (value.length <= 4) return '*'.repeat(value.length);
  return value.slice(0, 2) + '*'.repeat(Math.max(4, value.length - 4)) + value.slice(-2);
}

function redactAssignments(text) {
  let output = '';
  let cursor = 0;
  NAMED.lastIndex = 0;
  for (const match of text.matchAll(NAMED)) {
    if (match.index < cursor) continue;
    const start = match.index + match[0].length;
    const quote = new RegExp("(?:\\x27|\\x22|\\x60)").test(text.charAt(start)) && text.charAt(start);
    const valueStart = start + (quote ? 1 : 0);
    let end = valueStart;
    while (end < text.length) {
      if (quote) {
        if (text.charAt(end) === quote) break;
        if (text.charAt(end) === '\\' && end + 1 < text.length) end += 1;
      } else if (new RegExp("(?:\\s|\\x27|\\x22|\\x60)").test(text.charAt(end))) break;
      end += 1;
    }
    const value = text.slice(valueStart, end);
    const replacement = value !== '[REDACTED]' && MEDIUM_LABEL.test(match[0])
      ? mask(value) : '[REDACTED]';
    output += text.slice(cursor, valueStart) + replacement;
    cursor = end;
  }
  return output + text.slice(cursor);
}

function redact(text) {
  // Mask direct credentials first so a medium-confidence assignment cannot
  // retain part of a recognized high-confidence token.
  return redactAssignments(String(text).replace(HIGH_DIRECT, '[REDACTED]'));
}

module.exports = { isSecretPath, mask, redact };
