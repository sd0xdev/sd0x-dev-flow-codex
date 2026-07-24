'use strict';

const { MAX_OUTPUT_BYTES } = require('./probe-policy.js');

const SECRET_LABELS = '(?:api\\w*key|\\b(?:x[ ._-]+)?api[ ._-]+key\\b|access\\w*token|auth\\w*token|token|password|secret|session\\w*|jwt|cookie|set-cookie|aws\\w*(?:key|secret))';
const COMPLETE_PRIVATE_KEY = new RegExp(
  '-----BEGIN ((?:\\w| )*PRIVATE KEY(?:\\w| )*)-----[\\s\\S]*?-----END \\1-----',
  'gi'
);
const INCOMPLETE_PRIVATE_KEY = new RegExp(
  '-----BEGIN (?:\\w| )*PRIVATE KEY(?:\\w| )*-----[\\s\\S]*$',
  'gi'
);
const BEARER = new RegExp('\\b(Bearer)\\s+\\S+', 'gi');
const LABEL_ASSIGNMENT = new RegExp(
  '(?:\\\\?"|\\\\?\')?(' + SECRET_LABELS + ')(?:\\\\?"|\\\\?\')?\\s*[:=]\\s*',
  'gi'
);
const BASIC_CREDENTIAL = new RegExp('\\b(Basic)\\s+\\S*', 'gi');
const CREDENTIALED_URL = new RegExp(
  '\\b(\\w(?:\\w|\\+|\\.|-)*://)\\S+?:\\S+?@',
  'g'
);
const CREDENTIAL_FAMILY = new RegExp(
  '\\b(?:gh(?:p|o|u|s|r)_(?:\\w|-){20,}|github_pat_(?:\\w|-){20,}|(?:AKIA|ASIA)\\w{16}|sk-proj-(?:\\w|-){20,}|sk-ant-(?:\\w|-){20,}|sk-(?:\\w|-){20,}|xox(?:b|p|a|r|s)-(?:\\w|-){20,}|npm_\\w{20,}|glpat-(?:\\w|-){20,}|AIza(?:\\w|-){30,}|(?:sk|rk)_live_\\w{20,}|eyJ(?:\\w|-){8,}\\.(?:\\w|-){8,}\\.(?:\\w|-){8,})\\b',
  'g'
);
const TRUNCATED_CREDENTIAL_TAIL = Object.freeze({
  pattern: new RegExp('(?:gh(?:p|o|u|s|r)_|github_pat_|AKIA|ASIA|sk-proj-|sk-ant-|sk-|xox(?:b|p|a|r|s)-|npm_|glpat-|AIza|(?:sk|rk)_live_|eyJ)\\S*$'),
  marker: '[REDACTED_TRUNCATED_CREDENTIAL]'
});
const TRUNCATED_TAIL_CHARACTERS = 512;

function quotedEnd(value, start, token) {
  if (token.startsWith('\\')) {
    let cursor = start;
    while (cursor < value.length) {
      const quote = value.indexOf(token.at(-1), cursor);
      if (quote < 0) return -1;
      let slashes = 0;
      for (let index = quote - 1; index >= start && value.charAt(index) === '\\'; index -= 1) {
        slashes += 1;
      }
      if (slashes === 1) return quote - 1;
      cursor = quote + 1;
    }
    return -1;
  }
  let cursor = start;
  while (cursor < value.length) {
    const found = value.indexOf(token, cursor);
    if (found < 0) return -1;
    let slashes = 0;
    for (let index = found - 1; index >= start && value.charAt(index) === '\\'; index -= 1) {
      slashes += 1;
    }
    if (slashes % 2 === 0) return found;
    cursor = found + 1;
  }
  return -1;
}

function redactLabeledSecrets(value) {
  let cursor = 0;
  let output = '';
  LABEL_ASSIGNMENT.lastIndex = 0;
  for (const match of value.matchAll(LABEL_ASSIGNMENT)) {
    if (match.index < cursor) continue;
    output += value.slice(cursor, match.index) + match[0];
    const start = match.index + match[0].length;
    const escapedQuote = value.startsWith('\\"', start)
      ? '\\"'
      : value.startsWith("\\'", start) ? "\\'" : null;
    const quote = escapedQuote || (value.charAt(start) === '"' || value.charAt(start) === "'"
      ? value.charAt(start)
      : null);
    if (quote) {
      const end = quotedEnd(value, start + quote.length, quote);
      output += quote + '[REDACTED]';
      if (end < 0) return output;
      output += quote;
      cursor = end + quote.length;
    } else {
      const carriage = value.indexOf('\r', start);
      const newline = value.indexOf('\n', start);
      const ends = [carriage, newline].filter((index) => index >= 0);
      cursor = ends.length > 0 ? Math.min(...ends) : value.length;
      output += '[REDACTED]';
    }
  }
  return output + value.slice(cursor);
}

function isSchemeCharacter(character) {
  const code = character.charCodeAt(0);
  return code >= 65 && code <= 90 || code >= 97 && code <= 122 ||
    code >= 48 && code <= 57 || character === '+' || character === '.' || character === '-';
}

function containsWhitespace(value) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code === 32 || code >= 9 && code <= 13) return true;
  }
  return false;
}

function redactTruncatedUrl(value) {
  let tokenStart = value.length;
  while (tokenStart > 0 && !containsWhitespace(value.charAt(tokenStart - 1))) tokenStart -= 1;
  const delimiter = value.indexOf('://', tokenStart);
  if (delimiter <= 0) return value;
  let start = delimiter - 1;
  while (start > 0 && isSchemeCharacter(value.charAt(start - 1))) start -= 1;
  const scheme = value.slice(start, delimiter + 3);
  const authority = value.slice(delimiter + 3);
  const first = scheme.charCodeAt(0);
  const validStart = first >= 65 && first <= 90 || first >= 97 && first <= 122;
  if (!validStart || authority.length === 0 || containsWhitespace(authority)) return value;
  return value.slice(0, start) + scheme + '[REDACTED_TRUNCATED_URL]';
}

function redactOutput(value) {
  try {
    let output = redactLabeledSecrets(String(value)
      .replace(COMPLETE_PRIVATE_KEY, '[REDACTED_PRIVATE_KEY]')
      .replace(INCOMPLETE_PRIVATE_KEY, '[REDACTED_PRIVATE_KEY]'))
      .replace(BEARER, '$1 [REDACTED]')
      .replace(BASIC_CREDENTIAL, '$1 [REDACTED]')
      .replace(CREDENTIALED_URL, '$1[REDACTED]@');
    return output.replace(CREDENTIAL_FAMILY, '[REDACTED_CREDENTIAL]');
  } catch {
    return '[REDACTION_FAILED]';
  }
}

function utf8Prefix(buffer, maximum) {
  if (buffer.length <= maximum) return buffer;
  let end = maximum;
  while (end > 0 && (buffer.at(end) & 0xc0) === 0x80) end -= 1;
  return buffer.subarray(0, end);
}

function boundedOutput(value, maximum = MAX_OUTPUT_BYTES) {
  const limit = Number.isInteger(maximum) && maximum > 0
    ? Math.min(maximum, MAX_OUTPUT_BYTES)
    : MAX_OUTPUT_BYTES;
  const raw = Buffer.from(value);
  let prepared = raw.toString('utf8');
  if (raw.length > limit) {
    prepared = redactTruncatedUrl(prepared);
    const tailStart = Math.max(0, prepared.length - TRUNCATED_TAIL_CHARACTERS);
    const head = prepared.slice(0, tailStart);
    let tail = prepared.slice(tailStart);
    tail = tail.replace(
      TRUNCATED_CREDENTIAL_TAIL.pattern,
      TRUNCATED_CREDENTIAL_TAIL.marker
    );
    prepared = head + tail;
  }
  const sanitized = Buffer.from(redactOutput(prepared));
  const prefix = utf8Prefix(sanitized, limit);
  const output = prefix.toString('utf8');
  return {
    output,
    truncated: raw.length > limit || sanitized.length > prefix.length,
    bytes: Buffer.byteLength(output),
    limit
  };
}

module.exports = { boundedOutput, redactOutput };
