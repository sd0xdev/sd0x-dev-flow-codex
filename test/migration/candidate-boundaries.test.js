'use strict';

const {
  assert,
  fs,
  path,
  execFileSync,
  test,
  auditCandidate,
  commit,
  git,
  fixtureRoot,
  prepareRow,
  writeCandidate
} = require('../helpers/migration-context');

test('candidate audit rejects orphan, escaping, malformed, undeclared, and index-mutating payloads', (t) => {
  const values = fixtureRoot();
  t.after(() => fs.rmSync(values.workspace, { recursive: true, force: true }));
  prepareRow(values.root, 'architecture');
  const relative = writeCandidate(values.root, {
    target: 'architecture',
    sourceNames: ['architecture'],
    targetPackage: 'planning-pack',
    unit: 'architecture/default'
  });
  const directory = path.join(values.root, relative);

  const originalSkill = fs.readFileSync(path.join(directory, 'SKILL.md'), 'utf8');
  fs.writeFileSync(path.join(directory, 'SKILL.md'), originalSkill.replace(
    'description:',
    'allowed-tools: Read\ndescription:'
  ));
  assert.throws(() => auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }),
    /unsupported frontmatter field/);
  fs.writeFileSync(path.join(directory, 'SKILL.md'), originalSkill);

  fs.writeFileSync(path.join(directory, 'extra.md'), '# Root orphan\n');
  assert.throws(() => auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }),
    /orphan resource: extra.md/);
  fs.rmSync(path.join(directory, 'extra.md'));

  fs.appendFileSync(path.join(directory, 'SKILL.md'), '\n[Missing](references/missing.md)\n');
  assert.throws(() => auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }),
    /local reference is missing/);
  fs.writeFileSync(path.join(directory, 'SKILL.md'), originalSkill);

  fs.writeFileSync(path.join(directory, 'references', 'orphan.md'), '# Orphan\n');
  assert.throws(() => auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }),
    /orphan resource/);
  fs.rmSync(path.join(directory, 'references', 'orphan.md'));

  fs.appendFileSync(path.join(directory, 'SKILL.md'), '\n[Escape](../../outside.md)\n');
  assert.throws(() => auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }),
    /escapes candidate/);
  const skill = fs.readFileSync(path.join(directory, 'SKILL.md'), 'utf8')
    .replace('\n[Escape](../../outside.md)\n', '\n');
  fs.writeFileSync(path.join(directory, 'SKILL.md'), skill);

  fs.appendFileSync(path.join(directory, 'SKILL.md'), '\n| A | B |\n|---|---|\n| one |\n');
  assert.throws(() => auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }),
    /table column count mismatch/);
  fs.writeFileSync(path.join(directory, 'SKILL.md'),
    `${skill}\nRead \`scripts/helper.cjs\`.\n`);
  fs.mkdirSync(path.join(directory, 'scripts'));
  fs.writeFileSync(path.join(directory, 'scripts', 'helper.cjs'),
    "require('../../outside');\n");
  assert.throws(() => auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }),
    /code import escapes candidate/);
  fs.writeFileSync(path.join(directory, 'SKILL.md'),
    `${skill}\nRead \`scripts/helper.mjs\`.\n`);
  fs.rmSync(path.join(directory, 'scripts', 'helper.cjs'));
  fs.writeFileSync(path.join(directory, 'scripts', 'helper.mjs'),
    "import './missing.mjs';\n");
  assert.throws(() => auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }),
    /code import is missing/);
  for (const [filename, code] of [
    ['dynamic.js', "const target = './local.js'; require(target);\n"],
    ['dynamic.cjs', "const target = './local.cjs'; require(target);\n"],
    ['dynamic.mjs', "const target = './local.mjs'; import(target);\n"],
    ['commented.cjs', "require /* comment */ ('./missing.cjs');\n"],
    ['comment-quote-computed.cjs', "// \"\nmodule['require']('../../outside.cjs');\n"],
    ['block-comment-quote-computed.cjs', "/* \" */ module['require']('../../outside.cjs');\n"],
    ['comment-gap-computed.cjs', "module[/* gap */ 'require']('../../outside.cjs');\n"],
    ['commented.mjs', "import /* comment */ ('./missing.mjs');\n"],
    ['comment-gap-computed-import.cjs', "const loader = { import() {} }; loader[/* gap */ 'import']('./missing.mjs');\n"],
    ['comment-quote-computed-import.cjs', "// \"\nconst loader = { import() {} }; loader['import']('./missing.mjs');\n"],
    ['from-comment.mjs', "import value from /* comment */ './missing.mjs';\n"],
    ['export-comment.mjs', "export { value } from /* comment */ './missing.mjs';\n"],
    ['computed.cjs', "module['require']('../../outside.cjs');\n"],
    ['keyword-member-require.cjs', "const object = { in: module }; object.in['require']('../../outside.cjs');\n"],
    ['contextual-of-member.cjs', "const of = module; const key = 'require'; of[key]('../../outside.cjs');\n"],
    ['contextual-await-member.cjs', "const await = module; const key = 'require'; await[key]('../../outside.cjs');\n"],
    ['contextual-yield-member.cjs', "const yield = module; const key = 'require'; yield[key]('../../outside.cjs');\n"],
    ['continued-object-member.cjs', "const value = {}\n['require']('../../outside.cjs');\n"],
    ['continued-call-member.cjs', "function factory() { return module; } factory()['require']('../../outside.cjs');\n"],
    ['nested-computed-require.cjs', "module[['require'][0]]('../../outside.cjs');\n"],
    ['parenthesized-nested-computed-require.cjs', "module[(['require'])[0]]('../../outside.cjs');\n"],
    ['escaped-property.cjs', "module['requ\\x69re']('../../outside.cjs');\n"],
    ['octal-property.cjs', "module['requ\\151re']('../../outside.cjs');\n"],
    ['identity-property.cjs', "module['requ\\ire']('../../outside.cjs');\n"],
    ['continued-property.cjs', "module['requ" + "\\\\" + "\n" + "ire']('../../outside.cjs');\n"],
    ['parenthesized-property.cjs', "module[('requ\\ire')]('../../outside.cjs');\n"],
    ['parenthesized-octal-property.cjs', "module[( 'requ\\151re' )]('../../outside.cjs');\n"],
    ['commented-parenthesized-property.cjs', "module[/* ] */('requ\\ire')]('../../outside.cjs');\n"],
    ['quoted-bracket-property.cjs', "module[']requ\\ire']('../../outside.cjs');\n"],
    ['external.js', "require('left-pad');\n"],
    ['internal-load.cjs', "require('node:module')._load('../../outside.cjs', module);\n"],
    ['computed-load.cjs', "require('node:module')['_load']('../../outside.cjs', module);\n"],
    ['constructor-load.cjs', "module.constructor._load('../../outside.cjs', module);\n"],
    ['dlopen.cjs', "process.dlopen(module, '../../outside.node');\n"],
    ['computed-dlopen.cjs', "process['dlopen'](module, '../../outside.node');\n"],
    ['optional-dlopen.cjs', "process?.dlopen(module, '../../outside.node');\n"],
    ['aliased-process.cjs', "const proc = process;\nconst key = 'dlo' + 'pen';\nproc[key](module, '../../outside.node');\n"],
    ['destructured-process.cjs', "const { dlopen } = process;\ndlopen(module, '../../outside.node');\n"],
    ['required-process.cjs', "const proc = require('node:process');\nconst key = 'dlo' + 'pen';\nproc[key](module, '../../outside.node');\n"],
    ['optional-binding.mjs', "process?.binding('fs');\n"],
    ['reflect-process.cjs', "Reflect.get(process, 'dlo' + 'pen')(module, '../../outside.node');\n"],
    ['descriptor-process.cjs', "Object.getOwnPropertyDescriptor(process, 'dlo' + 'pen').value(module, '../../outside.node');\n"],
    ['computed-global.cjs', "globalThis['pro' + 'cess']['dlo' + 'pen'](module, '../../outside.node');\n"],
    ['constructor-function.cjs', "const proc = ({}).constructor.constructor('return pro' + 'cess')();\nproc['dlo' + 'pen'](module, '../../outside.node');\n"],
    ['indirect-eval.cjs', "(0, eval)('globalThis.x = 1');\n"],
    ['function-call.cjs', "Function.call(null, 'return 1')();\n"],
    ['inspector-computed-destructure.cjs', "const { ['op' + 'en']: launch } = require('node:inspector'); launch(0);\n"],
    ['inspector-static-computed-destructure.cjs', "const { ['open']: launch } = require('node:inspector'); launch(0);\n"],
    ['inspector-multiline-computed-destructure.cjs', "const {\n  ['open']: launch\n} = require('node:inspector'); launch(0);\n"],
    ['sqlite-computed-destructure.cjs', "const { ['Database' + 'Sync']: DB } = require('node:sqlite'); new DB(':memory:');\n"],
    ['sqlite-static-computed-destructure.cjs', "const { ['DatabaseSync']: DB } = require('node:sqlite'); new DB(':memory:');\n"],
    ['sqlite-multiline-computed-destructure.cjs', "const {\n  ['DatabaseSync']: DB\n} = require('node:sqlite'); new DB(':memory:');\n"],
    ['inspector-runtime.cjs', "const { Session } = require('node:inspector'); const session = new Session(); session.connect(); session.post('Runtime.' + 'evaluate', { expression: '1 + 1' });\n"],
    ['async-constructor.mjs', "(async () => {}).constructor('return 1')();\n"],
    ['comment-gap-constructor.cjs', "const key = 'con' + 'structor';\nconst proc = ({}) /* gap */ [key] /* gap */ [key]('return pro' + 'cess')();\nproc['dlo' + 'pen'](module, '../../outside.node');\n"],
    ['escaped-identifiers.cjs', "const proc = ({}).con\\u0073tructor.con\\u0073tructor('return pro' + 'cess')(); proc.dlo\\u0070en(module, '../../outside.node');\n"],
    ['regex-process.cjs', "const slash = /[//]/; process.kill(process.pid);\n"],
    ['regex-constructor.cjs', "const hidden = /[//]/; ({}).constructor.constructor('return 1')();\n"],
    ['process-kill.cjs', "process.kill(process.pid);\n"],
    ['process-abort.cjs', "process.abort();\n"],
    ['process-chdir.cjs', "process.chdir('/tmp');\n"],
    ['process-setuid.cjs', "process.setuid(0);\n"],
    ['process-umask.cjs', "process.umask(0);\n"],
    ['malformed.js', "const value = ;\n"],
    ['malformed.cjs', "const value = ;\n"],
    ['malformed.mjs', "const value = ;\n"],
    ['esm-in-js.js', "export const value = 1;\n"],
    ['esm-in-cjs.cjs', "export const value = 1;\n"],
    ['post-node18.js', "using resource = null;\n"],
    ['commented-post-node18.js', "using /* gap */ resource = null;\n"],
    ['post-node18-for.js', "for (using resource of []) {}\n"],
    ['post-node18-for-await.mjs', "for (await using resource of []) {}\n"],
    ['commented-import-attributes.mjs', "import data from './data.json' /* gap */ with { type: 'json' };\n"],
    ['multiline-import-attributes.mjs', "import data from './data.mjs'\nwith {};\n"],
    ['semicolon-import-attributes.mjs', "import data from './data;.mjs' with {};\n"],
    ['source-phase-import.mjs', "import source moduleSource from './data.mjs';\n"],
    ['defer-phase-import.mjs', "import defer * as data from './data.mjs';\n"],
    ['dynamic-source-phase-import.mjs', "const data = import.source('./data.mjs');\n"]
  ]) {
    fs.rmSync(path.join(directory, 'scripts'), { recursive: true, force: true });
    fs.mkdirSync(path.join(directory, 'scripts'));
    fs.writeFileSync(path.join(directory, 'SKILL.md'),
      `${skill}\nRead \`scripts/${filename}\`.\n`);
    fs.writeFileSync(path.join(directory, 'scripts', filename), code);
    assert.throws(() => auditCandidate({
      root: values.root,
      candidate: relative,
      target: 'architecture'
    }), /Node 18 ES2022 baseline|syntax check failed|dynamic code or module loading|dynamic computed member access|dynamic module specifier|commented or computed import|comments between from and module specifier|aliased, computed, or commented require|external module dependency|unsupported process member|process\.kill is limited|process namespace|global namespace|slash expressions|escaped JavaScript identifiers|escaped JavaScript property keys/, filename);
  }
  for (const [filename, code] of [
    ['inspector-parenthesized-nested-computed-destructure.cjs', "const { [(['open'])[0]]: launch } = require('node:inspector'); launch(0);\n"],
    ['sqlite-parenthesized-nested-computed-destructure.cjs', "const { [(['DatabaseSync'])[0]]: DB } = require('node:sqlite'); new DB(':memory:');\n"]
  ]) {
    fs.rmSync(path.join(directory, 'scripts'), { recursive: true, force: true });
    fs.mkdirSync(path.join(directory, 'scripts'));
    fs.writeFileSync(path.join(directory, 'SKILL.md'),
      `${skill}\nRead \`scripts/${filename}\`.\n`);
    fs.writeFileSync(path.join(directory, 'scripts', filename), code);
    assert.throws(() => auditCandidate({
      root: values.root,
      candidate: relative,
      target: 'architecture'
    }), /dynamic computed member access/, filename);
  }
  fs.rmSync(path.join(directory, 'scripts'), { recursive: true, force: true });
  fs.mkdirSync(path.join(directory, 'scripts'));
  fs.writeFileSync(path.join(directory, 'SKILL.md'),
    `${skill}\nRead \`scripts/main.cjs\`.\n`);
  fs.writeFileSync(path.join(directory, 'scripts', 'main.cjs'),
    "require('../references/payload');\n");
  fs.writeFileSync(path.join(directory, 'references', 'payload'), 'module.exports = 1;\n');
  assert.throws(() => auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }),
    /local imports must use an explicit audited/);
  fs.rmSync(path.join(directory, 'references', 'payload'));
  fs.writeFileSync(path.join(directory, 'scripts', 'main.cjs'),
    "require('../references/addon.node');\n");
  fs.writeFileSync(path.join(directory, 'references', 'addon.node'), Buffer.alloc(0));
  assert.throws(() => auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }),
    /local imports must use an explicit audited/);
  fs.rmSync(path.join(directory, 'references', 'addon.node'));
  fs.writeFileSync(path.join(directory, 'scripts', 'main.cjs'), "require('./helper');\n");
  fs.writeFileSync(path.join(directory, 'scripts', 'helper.cjs'), 'module.exports = 1;\n');
  assert.throws(() => auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }),
    /local imports must use an explicit audited/);
  fs.rmSync(path.join(directory, 'scripts', 'main.cjs'));
  fs.rmSync(path.join(directory, 'scripts', 'helper.cjs'));
  fs.writeFileSync(path.join(directory, 'SKILL.md'),
    `${skill}\nRead \`scripts/main.mjs\`.\n`);
  fs.writeFileSync(path.join(directory, 'scripts', 'main.mjs'), "import './helper';\n");
  fs.writeFileSync(path.join(directory, 'scripts', 'helper.mjs'), 'export const value = 1;\n');
  assert.throws(() => auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }),
    /local imports must use an explicit audited/);
  fs.rmSync(path.join(directory, 'scripts', 'main.mjs'));
  fs.rmSync(path.join(directory, 'scripts', 'helper.mjs'));
  fs.writeFileSync(path.join(directory, 'SKILL.md'),
    `${skill}\nRead \`scripts/main.mjs\`.\n`);
  fs.writeFileSync(path.join(directory, 'scripts', 'main.mjs'), "require('./helper.cjs');\n");
  fs.writeFileSync(path.join(directory, 'scripts', 'helper.cjs'), 'module.exports = 1;\n');
  assert.throws(() => auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }),
    /ES modules cannot use CommonJS globals/);
  fs.rmSync(path.join(directory, 'scripts', 'main.mjs'));
  fs.rmSync(path.join(directory, 'scripts', 'helper.cjs'));
  fs.writeFileSync(path.join(directory, 'SKILL.md'),
    `${skill}\nRead \`scripts/main.cjs\`.\n`);
  fs.writeFileSync(path.join(directory, 'scripts', 'main.cjs'), "require('./helper.mjs');\n");
  fs.writeFileSync(path.join(directory, 'scripts', 'helper.mjs'), 'export const value = 1;\n');
  assert.throws(() => auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }),
    /CommonJS require cannot load an ES module/);
  fs.rmSync(path.join(directory, 'scripts', 'main.cjs'));
  fs.rmSync(path.join(directory, 'scripts', 'helper.mjs'));
  fs.writeFileSync(path.join(directory, 'SKILL.md'),
    `${skill}\nRead \`scripts/main.cjs\`.\n`);
  fs.writeFileSync(path.join(directory, 'scripts', 'main.cjs'),
    "require('../references/pkg');\n");
  fs.mkdirSync(path.join(directory, 'references', 'pkg'));
  fs.writeFileSync(path.join(directory, 'references', 'pkg', 'package.json'),
    '{"main":"addon.node"}\n');
  fs.writeFileSync(path.join(directory, 'references', 'pkg', 'index.cjs'),
    'module.exports = 1;\n');
  fs.writeFileSync(path.join(directory, 'references', 'pkg', 'addon.node'), Buffer.alloc(0));
  assert.throws(() => auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }),
    /candidate package metadata is unsupported/);
  fs.writeFileSync(path.join(directory, 'references', 'pkg', 'package.json'),
    '{"type":"module","main":"index.js"}\n');
  fs.writeFileSync(path.join(directory, 'references', 'pkg', 'index.js'),
    'export const value = 1;\n');
  assert.throws(() => auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }),
    /candidate package metadata is unsupported/);
  fs.rmSync(path.join(directory, 'references', 'pkg'), { recursive: true });
  fs.rmSync(path.join(directory, 'scripts'), { recursive: true, force: true });
  fs.mkdirSync(path.join(directory, 'scripts'));
  fs.writeFileSync(path.join(directory, 'SKILL.md'),
    `${skill}\nRead \`scripts/harmless.js\`.\n`);
  fs.writeFileSync(path.join(directory, 'scripts', 'harmless.js'),
    "const binding = 'harmless';\nconst condition = true;\nconst values = [binding, 'first\\nsecond', [['first\\nsecond']]];\nconst combined = [...['first\\nsecond']];\nconst logical = condition && ['first\\nsecond'];\nconst make = () => ['first\\nsecond'];\nmodule.exports = [values[0], combined, logical, make(), process.cwd(), process.env.HOME];\n");
  assert.equal(auditCandidate({
    root: values.root,
    candidate: relative,
    target: 'architecture'
  }).ok, true);
  fs.rmSync(path.join(directory, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(directory, 'scripts'));
  fs.writeFileSync(path.join(directory, 'SKILL.md'),
    `${skill}\nRead \`scripts/harmless.mjs\`.\n`);
  fs.writeFileSync(path.join(directory, 'scripts', 'harmless.mjs'), [
    "import data from './data.mjs'",
    "import source from './source.mjs'",
    "import defer from './defer.mjs'",
    "const text = 'with {';",
    "const phaseText = 'import source moduleSource from';",
    '// with {',
    'export default [data, source, defer, text, phaseText];',
    ''
  ].join('\n'));
  fs.writeFileSync(path.join(directory, 'scripts', 'data.mjs'), 'export default 1;\n');
  fs.writeFileSync(path.join(directory, 'scripts', 'source.mjs'), 'export default 2;\n');
  fs.writeFileSync(path.join(directory, 'scripts', 'defer.mjs'), 'export default 3;\n');
  assert.equal(auditCandidate({
    root: values.root,
    candidate: relative,
    target: 'architecture'
  }).ok, true);
  fs.rmSync(path.join(directory, 'scripts'), { recursive: true });
  fs.writeFileSync(path.join(directory, 'SKILL.md'), skill + '\nRead `scripts/write.js`.\n');
  fs.mkdirSync(path.join(directory, 'scripts'));
  fs.writeFileSync(path.join(directory, 'scripts', 'write.js'), "require('./missing');\n");
  assert.throws(() => auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }),
    /local imports must use an explicit audited/);
  fs.writeFileSync(path.join(directory, 'scripts', 'write.js'),
    "require('node:fs').writeFileSync('x', 'y');\n");
  assert.throws(() => auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }),
    /undeclared operation: local-write/);
  fs.writeFileSync(path.join(directory, 'scripts', 'write.js'), [
    "const { execFileSync } = require('node:child_process');",
    "execFileSync('git', ['add', '.']);",
    ''
  ].join('\n'));
  assert.throws(() => auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }),
    /unsupported index mutation/);
  for (const flag of ['-a', '--all']) {
    fs.writeFileSync(path.join(directory, 'scripts', 'write.js'), [
      "const { execFileSync } = require('node:child_process');",
      `execFileSync('git', ['commit', '${flag}', '-m', 'fixture']);`,
      ''
    ].join('\n'));
    assert.throws(() => auditCandidate({
      root: values.root,
      candidate: relative,
      target: 'architecture'
    }), /unsupported index mutation/);
  }

  fs.rmSync(path.join(directory, 'scripts'), { recursive: true });
  fs.writeFileSync(path.join(directory, 'SKILL.md'), skill);
  const outside = path.join(values.workspace, 'outside.md');
  fs.writeFileSync(outside, 'outside\n');
  fs.symlinkSync(outside, path.join(directory, 'references', 'linked.md'));
  assert.throws(() => auditCandidate({ root: values.root, candidate: relative, target: 'architecture' }),
    /candidate tree contains symlink/);
  assert.throws(() => auditCandidate({
    root: values.root,
    candidate: 'migration/staging/architecture',
    target: 'architecture'
  }), /cannot be audited as a candidate/);
});
