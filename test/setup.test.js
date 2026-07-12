'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  END,
  START,
  setup
} = require('../plugin/sd0x-dev-flow-codex/skills/setup/scripts/setup');
const {
  hasSetupDeferral,
  setupDeferralPath
} = require('../plugin/sd0x-dev-flow-codex/scripts/runtime/state');
const {
  reviewPlan
} = require('../plugin/sd0x-dev-flow-codex/skills/review/scripts/provider');
const {
  initRepository,
  isolateGitEnvironment
} = require('./helpers/git');

isolateGitEnvironment();

function createRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sd0x-setup-'));
  initRepository(root);
  return root;
}

test('setup preserves user guidance and is idempotent', (t) => {
  const root = createRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'AGENTS.md'), '# Project Rules\n\nKeep this.\n');

  const first = setup(root);
  const firstContent = fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8');
  const second = setup(root);
  const secondContent = fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8');

  assert.equal(firstContent, secondContent);
  assert.match(firstContent, /Keep this\./);
  assert.equal(firstContent.split(START).length - 1, 1);
  assert.equal(firstContent.split(END).length - 1, 1);
  assert.ok(first.results.some((item) => item.status === 'created'));
  assert.ok(second.results.every((item) => item.status === 'unchanged'));
  assert.equal(first.activation_deferred, true);
  assert.equal(second.activation_deferred, false);
  assert.equal(first.setup_claim.schema_version, 1);
  assert.equal(fs.realpathSync(first.setup_claim.root), fs.realpathSync(root));
  assert.match(first.setup_claim.token, /^[0-9a-f-]{36}$/);
  assert.equal(second.setup_claim, null);
  assert.equal(hasSetupDeferral(root), true);
  assert.ok(
    fs.realpathSync(setupDeferralPath(root)).startsWith(
      fs.realpathSync(path.join(root, '.git'))
    )
  );
  const implementationAgent = fs.readFileSync(
    path.join(root, '.codex', 'agents', 'sd0x-reviewer.toml'),
    'utf8'
  );
  const testAgent = fs.readFileSync(
    path.join(root, '.codex', 'agents', 'sd0x-test-reviewer.toml'),
    'utf8'
  );
  const codexPrimaryAgent = fs.readFileSync(
    path.join(root, '.codex', 'agents', 'sd0x-codex-primary-reviewer.toml'),
    'utf8'
  );
  const claudePrimaryAgent = fs.readFileSync(
    path.join(root, '.codex', 'agents', 'sd0x-claude-primary-reviewer.toml'),
    'utf8'
  );
  assert.match(codexPrimaryAgent, /model = "gpt-5\.6-sol"/);
  assert.match(codexPrimaryAgent, /model_reasoning_effort = "xhigh"/);
  assert.match(claudePrimaryAgent, /mcp__sd0x_claude_review__review_worktree/);
  assert.match(implementationAgent, /performance, resource growth/);
  assert.match(implementationAgent, /model = "gpt-5\.6-sol"/);
  assert.match(implementationAgent, /model_reasoning_effort = "xhigh"/);
  assert.match(implementationAgent, /intentional design/);
  assert.match(testAgent, /acceptance traceability/);
  assert.match(testAgent, /model = "gpt-5\.6-sol"/);
  assert.match(testAgent, /model_reasoning_effort = "xhigh"/);
  assert.match(testAgent, /mock reasonableness/);
  const projectConfig = JSON.parse(
    fs.readFileSync(path.join(root, '.codex', 'sd0x-dev-flow.json'), 'utf8')
  );
  assert.equal(projectConfig.enabled, true);
  assert.equal(projectConfig.review.provider, 'codex');
  assert.deepEqual(reviewPlan(root), {
    provider: 'codex',
    primary_agent: 'sd0x_codex_primary_reviewer',
    reviewers: 3,
    agents: [
      'sd0x_codex_primary_reviewer',
      'sd0x_reviewer',
      'sd0x_test_reviewer'
    ],
    codex: { model: 'gpt-5.6-sol', reasoning_effort: 'xhigh' },
    claude: { model: 'claude-opus-4-8', enabled: false }
  });
  assert.equal(
    'limits' in JSON.parse(
      fs.readFileSync(path.join(root, '.codex', 'sd0x-dev-flow.json'), 'utf8')
    ),
    false
  );
});

test('setup removes obsolete loop limits while preserving custom config', (t) => {
  const root = createRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const configPath = path.join(root, '.codex', 'sd0x-dev-flow.json');
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify({
    schema_version: 1,
    enabled: true,
    limits: { max_rounds: 1, max_continuations: 1 },
    custom_setting: 'preserved'
  }));

  setup(root);

  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  assert.equal(config.enabled, true);
  assert.equal(config.custom_setting, 'preserved');
  assert.equal('limits' in config, false);
});

test('setup refuses to replace an unowned agent file', (t) => {
  const root = createRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const agentPath = path.join(root, '.codex', 'agents', 'sd0x-reviewer.toml');
  fs.mkdirSync(path.dirname(agentPath), { recursive: true });
  fs.writeFileSync(agentPath, 'name = "custom"\n');
  assert.throws(() => setup(root), /Refusing to replace unowned/);
  assert.equal(fs.existsSync(path.join(root, 'AGENTS.md')), false);
  assert.equal(fs.existsSync(path.join(root, '.codex', 'sd0x-dev-flow.json')), false);
});

test('setup preflights invalid config before writing guidance', (t) => {
  const root = createRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const configPath = path.join(root, '.codex', 'sd0x-dev-flow.json');
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, '{not json');
  assert.throws(() => setup(root), /invalid/);
  assert.equal(fs.existsSync(path.join(root, 'AGENTS.md')), false);
});

test('setup rejects non-object config without modifying project files', (t) => {
  for (const value of [[], 'abc', 42, null]) {
    const root = createRepo();
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const agentsPath = path.join(root, 'AGENTS.md');
    const configPath = path.join(root, '.codex', 'sd0x-dev-flow.json');
    const agentsContent = '# Existing guidance\n';
    const configContent = JSON.stringify(value);
    fs.writeFileSync(agentsPath, agentsContent);
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, configContent);

    assert.throws(
      () => setup(root),
      /must contain a JSON object/
    );
    assert.equal(fs.readFileSync(agentsPath, 'utf8'), agentsContent);
    assert.equal(fs.readFileSync(configPath, 'utf8'), configContent);
  }
});

test('setup rejects a zero-byte config without modifying guidance', (t) => {
  const root = createRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const agentsPath = path.join(root, 'AGENTS.md');
  const configPath = path.join(root, '.codex', 'sd0x-dev-flow.json');
  const agentsContent = '# Existing guidance\n';
  fs.writeFileSync(agentsPath, agentsContent);
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, '');

  assert.throws(() => setup(root), /invalid/);
  assert.equal(fs.readFileSync(agentsPath, 'utf8'), agentsContent);
  assert.equal(fs.readFileSync(configPath, 'utf8'), '');
});

test('setup preserves an explicit Claude review provider and rejects unknown providers', (t) => {
  const root = createRepo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const configPath = path.join(root, '.codex', 'sd0x-dev-flow.json');
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify({
    schema_version: 1,
    enabled: true,
    review: { provider: 'claude' }
  }));
  setup(root);
  assert.equal(
    JSON.parse(fs.readFileSync(configPath, 'utf8')).review.provider,
    'claude'
  );
  assert.equal(reviewPlan(root).primary_agent, 'sd0x_claude_primary_reviewer');
  assert.equal(reviewPlan(root).claude.enabled, true);
  assert.ok(reviewPlan(root).agents.includes('claude_mcp_primary'));

  fs.writeFileSync(configPath, JSON.stringify({
    schema_version: 1,
    enabled: true,
    review: { provider: 'unknown' }
  }));
  assert.throws(() => setup(root), /review\.provider/);
});

test('public documentation matches the shipped no-ceiling skill inventory', () => {
  const repositoryRoot = path.resolve(__dirname, '..');
  const skillsRoot = path.join(
    repositoryRoot,
    'plugin',
    'sd0x-dev-flow-codex',
    'skills'
  );
  const skillCount = fs.readdirSync(skillsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && fs.existsSync(
      path.join(skillsRoot, entry.name, 'SKILL.md')
    )).length;
  const guide = fs.readFileSync(
    path.join(repositoryRoot, 'docs', 'PROJECT-MIGRATION-GUIDE.md'),
    'utf8'
  );
  const readme = fs.readFileSync(path.join(repositoryRoot, 'README.md'), 'utf8');
  const toolkitSpec = fs.readFileSync(path.join(
    repositoryRoot,
    'docs',
    'features',
    'skill-toolkit-migration',
    '2-tech-spec.md'
  ), 'utf8');

  assert.equal(skillCount, 9);
  assert.match(guide, new RegExp(`- ${skillCount} 個 skills：`));
  assert.match(guide, /Auto-loop 沒有固定 round 或 continuation 上限/);
  assert.match(guide, /reason: reviewer-unavailable/);
  assert.match(guide, /continue: true/);
  assert.match(guide, /failed gate[^\n]+stale ledger[^\n]+保留/);
  assert.doesNotMatch(guide, /Auto-loop 必須有上限|超限時 escalation|round／continuation semantics/);
  assert.match(readme, /Stop hook 提供 non-blocking advisory/);
  assert.match(readme, /模型[^\n]+判斷是否繼續 review 或 verification/);
  assert.doesNotMatch(readme, /只有同一 fingerprint 的 gates 全數通過才會完成/);
  const migration = fs.readFileSync(
    path.join(repositoryRoot, 'docs', 'MIGRATION.md'),
    'utf8'
  );
  assert.match(migration, /non-blocking Stop advisory/);
  assert.match(migration, /model decides whether to continue/i);
  assert.doesNotMatch(migration, /Automation must persist until/);
  assert.match(toolkitSpec, new RegExp(`目標 repository 只有 ${skillCount} 個核心 skills`));
  assert.match(toolkitSpec, new RegExp(`\\| Skills \\| 100 \\| ${skillCount} \\|`));
  assert.match(toolkitSpec, /Current Codex skills are[^\n]+`reset`/);
  assert.match(readme, /\.codex\/agents\/sd0x-codex-primary-reviewer\.toml/);
  assert.match(readme, /sd0x-claude-primary-reviewer\.toml/);
  assert.match(readme, /sd0x-reviewer\.toml/);
  assert.match(readme, /sd0x-test-reviewer\.toml/);
  assert.doesNotMatch(readme, /\.codex\/agents\/sd0x_reviewer\.toml|sd0x_test_reviewer\.toml/);
});

test('review theory preserves the sd0x independent review and convergence contract', () => {
  const theory = fs.readFileSync(path.resolve(
    __dirname,
    '..',
    'plugin',
    'sd0x-dev-flow-codex',
    'skills',
    'review',
    'references',
    'review-theory.md'
  ), 'utf8');
  for (const pattern of [
    /independent research/i,
    /never the\s+implementer's conclusions/i,
    /actual diff, full changed files/i,
    /orthogonal perspectives in parallel/i,
    /edit resets the review cycle/i,
    /fixing and verifying as separate actions/i,
    /root cause/i,
    /acceptance criteria/i,
    /normalize and deduplicate/i,
    /provider and[\s\S]*worktree fingerprint changes invalidate evidence/i,
    /no degraded pass/i,
    /fresh full scan/i
  ]) {
    assert.match(theory, pattern);
  }
});

test('review skill requires user-authorized reset for stale native reviewers', () => {
  const skill = fs.readFileSync(path.resolve(
    __dirname,
    '..',
    'plugin',
    'sd0x-dev-flow-codex',
    'skills',
    'review',
    'SKILL.md'
  ), 'utf8');
  assert.match(skill, /do not replace or retry that reviewer type on the same fingerprint/i);
  assert.match(skill, /Ask the user before running[^\n]+reset/i);
  assert.doesNotMatch(skill, /reset or process restart/i);
  assert.match(skill, /process restart alone does not clear/i);
  assert.match(skill, /genuine fingerprint change/i);

  const guide = fs.readFileSync(path.resolve(
    __dirname,
    '..',
    'docs',
    'PROJECT-MIGRATION-GUIDE.md'
  ), 'utf8');
  assert.match(guide, /reviewer_failure[^\n]+true/);
  assert.match(guide, /process restart[^\n]+不會清除/);
  assert.match(guide, /使用者授權[^\n]+reset/);
});

test('reset skill documents trusted-session and corrupt-state recovery semantics', () => {
  const skill = fs.readFileSync(path.resolve(
    __dirname,
    '..',
    'plugin',
    'sd0x-dev-flow-codex',
    'skills',
    'reset',
    'SKILL.md'
  ), 'utf8');
  assert.match(skill, /trusted sessions are preserved/i);
  assert.match(skill, /corrupt state is quarantined/i);
  assert.match(skill, /requires a new SessionStart/i);
  assert.match(skill, /Report the quarantine path and new-session[\s\S]+reset_recovery/i);
});

test('remind routes every review reason without unsafe retries', () => {
  const skill = fs.readFileSync(path.resolve(
    __dirname,
    '..',
    'plugin',
    'sd0x-dev-flow-codex',
    'skills',
    'remind',
    'SKILL.md'
  ), 'utf8');
  assert.match(skill, /reason[^\n]+reviewer-unavailable/i);
  assert.match(skill, /do not run[^\n]+review/i);
  assert.match(skill, /user-authorized reset|ask the user[^\n]+reset/i);
  assert.match(skill, /reason[^\n]+review-in-progress/i);
  assert.match(skill, /reason[^\n]+review-findings-remain/i);
  assert.match(skill, /reason[^\n]+review-required/i);
  assert.match(skill, /wait for[^\n]+terminal/i);
  assert.match(skill, /fix[^\n]+findings/i);
});
