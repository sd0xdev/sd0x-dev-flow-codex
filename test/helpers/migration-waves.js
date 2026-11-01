'use strict';

const { assert } = require('./migration-context');

function wave3Context() {
  const dispositionPath = 'migration/source-disposition.json';
  const units = [
    {
      id: 'bug-fix/default',
      target: 'bug-fix',
      sources: ['bug-fix'],
      kind: 'promotion',
      final: 'promoted',
      closure: 'b915eefc5a238784f78e8c27c70dc8eda6c366f507846e8d4a323fbe293d7851'
    },
    {
      id: 'debug/default',
      target: 'debug',
      sources: ['debug'],
      kind: 'pack-ready',
      final: 'pack-ready',
      closure: '9078a93668d61857a5e4f7fa1492a369745715a810647cf6e857a381603b64b5'
    },
    {
      id: 'feature-dev/default',
      target: 'feature-dev',
      sources: ['codex-implement', 'feature-dev'],
      kind: 'promotion',
      final: 'promoted',
      closure: 'fd213aeea78b9812439251d381cd8428e2dc468f4d375a48466e89241dca3e95'
    },
    {
      id: 'post-dev-test/default',
      target: 'post-dev-test',
      sources: ['post-dev-test'],
      kind: 'pack-ready',
      final: 'pack-ready',
      closure: '37748257075b0567d69bf0e4a087c303a14ed38401ad075c36adbf42dc8be057'
    },
    {
      id: 'refactor/default',
      target: 'refactor',
      sources: ['refactor'],
      kind: 'pack-ready',
      final: 'pack-ready',
      closure: '879c7801646bdc4a891d00d1c029c433d58dfbef6c862d52d4c2166ea8898b4d'
    },
    {
      id: 'simplify/default',
      target: 'simplify',
      sources: ['simplify'],
      kind: 'pack-ready',
      final: 'pack-ready',
      closure: '5707c404abb9ad40dbd078660ee9e0174f1695c2f0ca56de469dc0cd1094ac93'
    },
    {
      id: 'test-deep/default',
      target: 'test-deep',
      sources: ['test-deep'],
      kind: 'pack-ready',
      final: 'pack-ready',
      closure: '2a8147e4f47fe6ee5b84f2c471c052532e60d0b010b09d391b73fc281aef07de'
    },
    {
      id: 'test-gen/default',
      target: 'test-gen',
      sources: ['codex-test-gen'],
      kind: 'pack-ready',
      final: 'pack-ready',
      closure: '5c0adf5400ce4e4511f7d5e9ca314f5a2513a30414c5318c5318b9b80af8603e'
    },
  ];
  const assertRepositoryWave3State = (disposition, completions, current = false) => {
    for (const unit of units) {
      const final = current ? 'promoted' : unit.final;
      const kind = current ? 'promotion' : unit.kind;
      const rows = disposition.skills.filter((row) =>
        row.promotion_unit_id === unit.id
      );
      assert.deepEqual(rows.map((row) => row.source_name).sort(), unit.sources,
        `${unit.id}: source rows must remain exact`);
      for (const row of rows) {
        assert.equal(row.target_skill, unit.target,
          `${unit.id}:${row.source_name} target must remain exact`);
        assert.equal(row.delivery_state,
          completions.has(unit.id) ? final : 'candidate',
          `${unit.id}:${row.source_name} must be ${
            completions.has(unit.id) ? final : 'candidate'
          }`);
      }
      if (completions.has(unit.id)) {
        assert.equal(completions.get(unit.id)?.kind, kind,
          `${unit.id}: completion kind must match the final overlay`);
      }
    }
    assert.equal(disposition.skills.find((row) =>
      row.source_name === 'codex-implement').alias_policy, 'mapping-only');
    assert.equal(disposition.skills.find((row) =>
      row.source_name === 'codex-test-gen').alias_policy, 'mapping-only');
  };
  return { dispositionPath, units, assertRepositoryWave3State };
}

function wave4Context() {
  const dispositionPath = 'migration/source-disposition.json';
  const units = [
    ['review/branch', 'review', ['codex-review-branch'], 'promotion', 'promoted',
      '66e40e838275c7a631dda30ff7a6c0484c8daeb97caf9e54684dc116219e2108'],
    ['review/deep', 'review', ['codex-cli-review'], 'promotion', 'promoted',
      'b2b9d74e80f1d9d5e654edbdbdecb1b79f4d83cd2bd3da3595447697f1a64ec7'],
    ['review/default', 'review', ['codex-code-review'], 'promotion', 'promoted',
      '54ff2854d6d9d104611b0d97389e25536a76a92364f953bc1829fd9efe4a9954'],
    ['review/fast', 'review', ['codex-review-fast'], 'promotion', 'promoted',
      'ed2d7058352c93ce55652560ff18caef1734892baad67ebe0d28fc07da1e0cfa'],
    ['review/full', 'review', ['codex-review'], 'promotion', 'promoted',
      '012f73a94a10dfc1bb8e8c3207636d844aeb97f694b50146f036a7381d392ae9'],
    ['best-practices/default', 'best-practices', ['best-practices'],
      'pack-ready', 'pack-ready',
      '4a5ec6ff615598c7f09e6c89eec97763c9771bb1f38c12457c5de672150ef8cd'],
    ['check-coverage/default', 'check-coverage', ['check-coverage'],
      'pack-ready', 'pack-ready',
      '9e382d918a8be739db942a3d023af1cbedd2893be9cca56451eccfa1cd6859f9'],
    ['dep-audit/default', 'dep-audit', ['dep-audit'], 'pack-ready', 'pack-ready',
      '66d145f84573508765c7400edc5657717a2476b0ffe075ffabceed1881d8fdae'],
    ['doc-review/default', 'doc-review', ['codex-review-doc', 'doc-review'],
      'pack-ready', 'pack-ready',
      'e35dec5c3e0318aca0a856c06a616e9d6a11e64d7afabcb82e0b67b95094a582'],
    ['pre-pr-audit/default', 'pre-pr-audit', ['pre-pr-audit'],
      'pack-ready', 'pack-ready',
      '943363397d4992196089ca633bfbcd6e3652957cde982854d2a3e118abf902a5'],
    ['project-audit/default', 'project-audit', ['project-audit'],
      'pack-ready', 'pack-ready',
      '34a36979ead8b223a5355a6e399769d8eb5938a481aed92d074368e5032a28da'],
    ['risk-assess/default', 'risk-assess', ['risk-assess'],
      'pack-ready', 'pack-ready',
      '6bfe9fc7bf3877139788aa76e12aced413a5d7b74d70dc18a2fdb6d1e5df941a'],
    ['security-review/default', 'security-review',
      ['codex-security', 'security-review'], 'pack-ready', 'pack-ready',
      '3fedc2106c90eb638b0b8d540445f96c7ba8553d8e4eca4445e48dde8519c980'],
    ['test-health/default', 'test-health', ['test-health'],
      'pack-ready', 'pack-ready',
      '2d3e657fb4e08eb4b2ab1d3abf3b1fe6938a044fe7a4654d4817e29fd9c2cda9'],
    ['test-review/default', 'test-review',
      ['codex-test-review', 'test-review'], 'pack-ready', 'pack-ready',
      'e81086ac619967dabec65a8ed7edc11ea8b80726b918b36bdfd865202b270611',
      'promotion', 'promoted']
  ].map(([id, target, sources, kind, final, closure]) => ({
    id,
    target,
    sources,
    kind,
    final,
    closure,
    currentKind: 'promotion',
    currentFinal: 'promoted'
  }));
  const assertWave4State = (disposition, completions, current = false) => {
    for (const unit of units) {
      const final = current ? unit.currentFinal : unit.final;
      const kind = current ? unit.currentKind : unit.kind;
      const rows = disposition.skills.filter((row) =>
        row.promotion_unit_id === unit.id
      );
      assert.deepEqual(rows.map((row) => row.source_name).sort(),
        [...unit.sources].sort(), `${unit.id}: source rows must remain exact`);
      for (const row of rows) {
        assert.equal(row.target_skill, unit.target,
          `${unit.id}:${row.source_name} target must remain exact`);
        assert.equal(row.delivery_state,
          completions.has(unit.id) ? final : 'candidate',
          `${unit.id}:${row.source_name} must follow its current request lineage`);
      }
      if (completions.has(unit.id)) {
        assert.equal(completions.get(unit.id)?.kind, kind,
          `${unit.id}: completion kind must match the final overlay`);
      }
    }
  };
  return { dispositionPath, units, assertWave4State };
}

module.exports = { wave3Context, wave4Context };
