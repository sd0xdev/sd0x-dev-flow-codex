'use strict';

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const test = require('node:test');
const { redact } = require('../plugin/sd0x-dev-flow-codex/skills/ask/scripts/redact.js');

test('ask redacts JSON, env suffixes and short credentials by value position', () => {
  for (const [input, expected] of [
    ['{"password":"pass"}', '{"password":"[REDACTED]"}'],
    ['API_TOKEN=TOKEN', 'API_TOKEN=[REDACTED]'],
    ['service-api-key=key', 'service-api-key=[REDACTED]'],
    ['pwd=x', 'pwd=[REDACTED]'],
    ['{"token":"abc","password":"xyz"}', '{"token":"[REDACTED]","password":"[REDACTED]"}'],
    ['`secret`=`abc`', '`secret`=`[REDACTED]`']
  ]) assert.equal(redact(input), expected);
});

test('ask consumes complete quoted values and never truncates at punctuation', () => {
  for (const value of ['p@ss;word', 'a,b,c', 'foo}bar']) {
    assert.equal(redact(`password=${value}`), 'password=[REDACTED]');
  }
  assert.equal(redact('password="two words; a,b}c" public=yes'),
    'password="[REDACTED]" public=yes');
  assert.equal(redact('password="escaped\\"secret" public=yes'),
    'password="[REDACTED]" public=yes');
  assert.equal(redact('password="unterminated secret\nwith more secret'),
    'password="[REDACTED]');
  assert.equal(redact('password="token=inner"\ntoken=next'),
    'password="[REDACTED]"\ntoken=[REDACTED]');
});

test('ask preserves medium-confidence masking and ordinary repository evidence', () => {
  assert.equal(redact('credential=credential'), 'credential=cr******al');
  assert.equal(redact('{"credential":"pass"}'), '{"credential":"****"}');
  assert.equal(redact('auth_value=mediumconfidence'), 'auth_value=me************ce');
  const ordinary = 'secretive tokens passwords abcdef0123456789abcdef0123456789abcdef01';
  assert.equal(redact(ordinary), ordinary);
  assert.equal(redact('api_key=sk-abcdefghijklmnop'), 'api_key=[REDACTED]');
  assert.equal(redact('credential=sk-abcdefghijklmnop'), 'credential=[REDACTED]');
});

test('ask handles large kebab-case input within a bounded subprocess timeout', () => {
  const helper = path.resolve(__dirname,
    '../plugin/sd0x-dev-flow-codex/skills/ask/scripts/redact.js');
  // A subprocess timeout bounds a pathological regexp without hanging the suite.
  execFileSync(process.execPath, ['-e', `
    const assert = require('node:assert/strict');
    const { redact } = require(process.argv[1]);
    const plain = 'ordinary-kebab-value-'.repeat(30000);
    assert.equal(redact(plain), plain);
    assert.equal(redact(plain + 'API_TOKEN=TOKEN'), plain + 'API_TOKEN=[REDACTED]');
  `, helper], { timeout: 5000, stdio: 'pipe' });
});
