'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { casePrompt, compare, grade, parseEvents, prepare, run, summarize, validateSuite } =
  require('../scripts/skill-behavior-eval');

const routing = { id: 'route', kind: 'routing', prompt: 'Explain the selected function.',
  allowed_skills: ['explain'] };
const task = { id: 'task', kind: 'task', prompt: 'Read src/options.js and report timeout.',
  allowed_skills: ['explain', null], expected_answer: '3000', evidence_paths: ['src/options.js'] };
const observed = () => ({ exit_code: 0, terminal: true, workspace_unchanged: true,
  answer: { selected_skill: 'explain', mode: null, answer: '3000', evidence_paths: ['src/options.js'] },
  tool_items: [{ type: 'command_execution', command: 'cat src/options.js', exit_code: 0 }] });

test('evaluation prompts exclude grading answers and permit no-skill decisions', () => {
  const prompt = casePrompt({ ...task, expected_answer: 'HIDDEN_EXPECTATION' },
    [{ name: 'explain', description: 'Explain selected code.', path: 'skills/explain/SKILL.md' }]);
  assert.equal(prompt.includes('HIDDEN_EXPECTATION'), false);
  assert.equal(prompt.includes('allowed_skills'), false);
  assert.equal(grade({ ...routing, allowed_skills: [null] }, { ...observed(),
    answer: { selected_skill: null, answer: 'Direct answer', evidence_paths: [] }, tool_items: []
  }).routing_pass, true);
});

test('routing and task success stay separate; mutation, failures, and missing observation cannot pass', () => {
  assert.equal(grade(task, observed()).task_pass, true);
  const wrongRoute = observed();
  wrongRoute.answer.selected_skill = 'feature-dev';
  assert.equal(grade(task, wrongRoute).routing_pass, false);
  assert.equal(grade(task, wrongRoute).task_pass, true);
  for (const change of [{ exit_code: 1 }, { terminal: false }, { workspace_unchanged: false },
    { answer: null }, { tool_items: [] }]) {
    assert.equal(grade(task, { ...observed(), ...change }).task_pass, false);
  }
  assert.equal(grade(routing, observed()).valid_run, false);
  assert.equal(grade(task, { ...observed(), answer: { ...observed().answer, answer: 'wrong' } }).task_pass, false);
});

test('raw CLI parser requires a terminal event and preserves unavailable usage', () => {
  const message = { type: 'item.completed', item: { type: 'agent_message', text: '{"answer":"3000"}' } };
  const encode = events => events.map(event => JSON.stringify(event)).join('\n');
  assert.equal(parseEvents(encode([message])).terminal, false);
  assert.equal(parseEvents(encode([message, { type: 'turn.completed' }])).usage, null);
  assert.equal(parseEvents(encode([message, { type: 'turn.completed' }, { type: 'turn.failed' }])).terminal, false);
  assert.equal(parseEvents(encode([{ type: 'turn.completed' }, { type: 'turn.completed' }])).terminal, false);
  const usage = { input_tokens: 120, output_tokens: 8, cached_input_tokens: 30 };
  assert.deepEqual(parseEvents(encode([message, { type: 'turn.completed', usage }])).usage, usage);
});

test('metrics include failed cases in denominators and never substitute zero for missing tokens', () => {
  const cases = [
    { kind: 'routing', grade: { valid_run: true, routing_pass: true }, usage: { input_tokens: 100, output_tokens: 5 }, duration_ms: 20, prompt_characters: 60 },
    { kind: 'routing', grade: { valid_run: false, routing_pass: false }, usage: null, duration_ms: 40, prompt_characters: 80 },
    { kind: 'task', grade: { valid_run: true, task_pass: true }, usage: { input_tokens: 300, output_tokens: 10 }, duration_ms: 90, prompt_characters: 70 }
  ];
  const result = summarize(cases);
  assert.equal(result.routing_success_rate, 0.5);
  assert.equal(result.routing_error_rate, 0.5);
  assert.equal(result.task_success_rate, 1);
  assert.equal(result.input_tokens, null);
  assert.equal(result.output_tokens, null);
  assert.equal(result.usage_observed_cases, 2);
  assert.equal(result.mean_case_duration_ms, 50);
});

test('comparison rejects different tasks, harnesses, or execution conditions', () => {
  const report = { manifest: { suite_sha256: 'a', fixture_sha256: 'b', harness_sha256: 'c', response_schema_sha256: 'd' },
    execution: { requested_model: 'model', codex_version: 'version', concurrency: 1, timeout_ms: 1000,
      ignore_user_config: true, sandbox: 'read-only', codex_home_sha256: null }, results: [{ id: 'task' }],
    metrics: { routing_success_rate: 1, input_tokens: null } };
  assert.equal(compare(report, structuredClone(report)).metrics.input_tokens.delta, null);
  for (const key of ['suite_sha256', 'fixture_sha256', 'harness_sha256', 'response_schema_sha256']) {
    const changed = structuredClone(report); changed.manifest[key] = 'different';
    assert.throws(() => compare(report, changed), /not comparable/);
  }
  const changed = structuredClone(report); changed.execution.requested_model = 'other';
  assert.throws(() => compare(report, changed), /conditions differ/);
  const missing = structuredClone(report); missing.results = [];
  assert.throws(() => compare(report, missing), /coverage differs/);
});

test('suite rejects traversal, duplicate cases, and unusable task rubrics', () => {
  assert.throws(() => validateSuite({ schema_version: 1, cases: [routing, routing] }), /duplicate/);
  assert.throws(() => validateSuite({ schema_version: 1, cases: [{ ...routing, id: '../outside' }] }), /Invalid/);
  assert.throws(() => validateSuite({ schema_version: 1, cases: [{ ...task, evidence_paths: ['../outside'] }] }), /Invalid/);
  assert.throws(() => validateSuite({ schema_version: 1, cases: [{ ...task, evidence_paths: [] }] }), /Invalid/);
});

test('prepared snapshots reject input drift before any model invocation', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-eval-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const plugin = path.join(root, 'plugin');
  fs.mkdirSync(path.join(plugin, 'skills/explain'), { recursive: true });
  fs.mkdirSync(path.join(plugin, '.codex-plugin'));
  fs.writeFileSync(path.join(plugin, 'skills/explain/SKILL.md'), '---\nname: explain\ndescription: "Explain code."\n---\n');
  fs.writeFileSync(path.join(plugin, '.codex-plugin/payload-manifest.json'), '{}');
  fs.mkdirSync(path.join(root, 'workspace'));
  fs.writeFileSync(path.join(root, 'workspace/example.js'), 'module.exports = 1;');
  const suite = path.join(root, 'cases.json');
  fs.writeFileSync(suite, JSON.stringify({ schema_version: 1, cases: [routing] }));
  const out = path.join(root, 'experiment');
  prepare(out, plugin, suite);
  fs.appendFileSync(path.join(out, 'skills/explain/SKILL.md'), 'Changed.');
  await assert.rejects(run(out, { model: 'test-model', codex: 'must-never-run', concurrency: 1, timeoutMs: 1000 }), /drifted/);
});
