'use strict';

const path = require('node:path');

const SECRET_PATH = new RegExp('(?:^|/)(?:\\.env(?:\\..*)?|credentials?\\.[^/]+|[^/]*secret[^/]*|[^/]*(?:private[-_.]?key|token[-_.]?store)[^/]*)$', 'i');
const HIGH_DIRECT = new RegExp('\\b(?:sk-[A-Za-z0-9_-]{12,}|gh[opsu]_[A-Za-z0-9]{12,}|AKIA[A-Z0-9]{12,})\\b', 'gi');
const HIGH_NAMED = new RegExp('\\b(?:token|password|secret|api[_-]?key)\\s*[:=]\\s*[\'\"]?([^\\s\'\"]{8,})', 'gi');
const MEDIUM_NAMED = new RegExp('\\b(?:credential|bearer|auth[_-]?value)\\s*[:=]\\s*[\'\"]?([^\\s\'\"]{8,})', 'gi');

function isSecretPath(relative) {
  const normalized = String(relative).split('\\').join('/');
  return path.posix.isAbsolute(normalized) || normalized.split('/').includes('..') ||
    SECRET_PATH.test(normalized);
}

function mask(value) {
  if (value.length <= 4) return '*'.repeat(value.length);
  return value.slice(0, 2) + '*'.repeat(Math.max(4, value.length - 4)) + value.slice(-2);
}

function redact(text) {
  return String(text)
    .replace(HIGH_DIRECT, '[REDACTED]')
    .replace(HIGH_NAMED, (match, captured) => match.replace(captured, '[REDACTED]'))
    .replace(MEDIUM_NAMED, (match, captured) => match.replace(captured, mask(captured)));
}

module.exports = { isSecretPath, mask, redact };
