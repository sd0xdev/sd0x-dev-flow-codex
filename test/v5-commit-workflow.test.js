'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { initRepository, git, commit, isolateGitEnvironment } = require('./helpers/git');
const workflow = require('../plugin/sd0x-dev-flow-codex/scripts/runtime/commit-workflow');
isolateGitEnvironment();
function initCommitRepository(root) {
  initRepository(root);
  // Commit observation intentionally ignores ambient GIT_CONFIG_* selectors.
  // Own the unused LFS driver locally so runner-installed filters cannot enter
  // these fixtures, without weakening the production configuration boundary.
  for (const operation of ['clean', 'smudge', 'process']) git(root, ['config', '--local', 'filter.lfs.' + operation, '']);
  git(root, ['config', '--local', 'filter.lfs.required', 'false']);
}
function repo(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'v5-commit-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  initCommitRepository(root); git(root,['config','user.name','Fixture Author']); git(root,['config','user.email','fixture@example.invalid']);
  git(root,['config','commit.gpgsign','false']);
  fs.writeFileSync(path.join(root,'file.txt'),'one');git(root,['add','.']);commit(root,'baseline');
  fs.writeFileSync(path.join(root,'file.txt'),'two');fs.mkdirSync(path.join(root,'sub'));fs.writeFileSync(path.join(root,'sub/nested.txt'),'nested');git(root,['add','.']);
  return root;
}
test('commit plan computes exact tree without staging and executes one bound commit with readback', t => {
  const root=repo(t); const prepared=workflow.plan(root,'Add staged fixture');
  assert.equal(prepared.tree,git(root,['write-tree']).toString().trim());
  const result=workflow.execute(root,prepared,{action:'commit',plan_sha256:workflow.planHash(prepared),protected_branch:true});
  assert.equal(result.outcome,'complete'); assert.equal(result.created_commits.length,1);
  assert.equal(result.created_commits[0].origin,'this-invocation');
});
test('commit subject drift and attribution reject before mutation, while user index remains untouched', t => {
  const root=repo(t), prepared=workflow.plan(root,'Add fixture');
  const head=git(root,['rev-parse','HEAD']).toString();
  assert.throws(()=>workflow.plan(root,'Generated-by Codex'),/attribution/);
  fs.writeFileSync(path.join(root,'file.txt'),'three');
  assert.throws(()=>workflow.execute(root,prepared,{action:'commit',plan_sha256:workflow.planHash(prepared),protected_branch:true}),/drifted/);
  assert.equal(git(root,['rev-parse','HEAD']).toString(),head);
});
test('all-ref readback detects attribution hidden on a side branch', t => {
  const root=repo(t),prepared=workflow.plan(root,'Add fixture');
  git(root,['write-tree']);
  const side=git(root,['commit-tree',prepared.tree,'-p',prepared.head,'-m','Generated-by Codex']).toString().trim();
  git(root,['update-ref','refs/heads/hidden-side',side]);
  assert.throws(()=>workflow.audit(root,prepared,'fixture-invocation'),/attribution/);
});
test('unknown clean side commits and ancestry overlays cannot certify completion', t => {
  const root=repo(t),prepared=workflow.plan(root,'Add fixture');
  git(root,['write-tree']);
  const side=git(root,['commit-tree',prepared.tree,'-p',prepared.head,'-m','Independent fixture']).toString().trim();
  git(root,['update-ref','refs/heads/concurrent',side]);
  const observed=workflow.audit(root,prepared,'fixture-invocation');
  assert.equal(observed.outcome,'partial-or-unknown');assert.equal(observed.created_commits[0].origin,'unknown');
  fs.writeFileSync(path.join(root,'.git/info/grafts'),prepared.head+'\n');
  assert.throws(()=>workflow.audit(root,prepared,'fixture'),/overlay/);
});
test('configuration parse failure is not unset and ambient index/config selectors are stripped', t => {
  const root=repo(t);
  const clean=workflow.environment({PATH:process.env.PATH,GIT_DIR:'/wrong',GIT_INDEX_FILE:'/wrong',GIT_CONFIG_PARAMETERS:'wrong',GIT_CONFIG_GLOBAL:'/wrong',GIT_AUTHOR_NAME:'Fixture',ALLOW_AI_COAUTHOR:'1'});
  assert.equal(clean.GIT_DIR,undefined);assert.equal(clean.GIT_CONFIG_GLOBAL,undefined);assert.equal(clean.GIT_AUTHOR_NAME,'Fixture');assert.equal(clean.ALLOW_AI_COAUTHOR,undefined);
  fs.appendFileSync(path.join(root,'.git/config'),'\n[broken\n');
  assert.throws(()=>workflow.config(root),/Git operation failed/);
});

test('literal reference resolution refuses short-name ambiguity and option-shaped input', t => {
  const root=repo(t); const refs=require('../plugin/sd0x-dev-flow-codex/scripts/runtime/git-refs');
  git(root,['branch','shared']);git(root,['tag','shared']);
  assert.throws(()=>refs.resolve(root,'shared'),/Ambiguous/);
  assert.throws(()=>refs.resolve(root,'--all'),/Invalid literal/);
  assert.equal(refs.resolve(root,'refs/heads/shared').oid,git(root,['rev-parse','HEAD']).toString().trim());
});

test('valueless configuration is valid and secret messages are refused before preview', t => {
  const root=repo(t);fs.appendFileSync(path.join(root,'.git/config'),'\n[example]\nflag\n');
  assert.doesNotThrow(()=>workflow.config(root));
  assert.throws(()=>workflow.plan(root,'Fixture ghp_'+'x'.repeat(36)),/secret material/);
});
test('unborn repository supports exactly one first commit with no parents', t => {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'v5-first-commit-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  initCommitRepository(root);git(root,['config','user.name','Fixture']);git(root,['config','user.email','fixture@example.invalid']);git(root,['config','commit.gpgsign','false']);
  fs.writeFileSync(path.join(root,'first.txt'),'first');git(root,['add','.']);
  const prepared=workflow.plan(root,'Initial fixture');assert.equal(prepared.head,null);
  const result=workflow.execute(root,prepared,{action:'commit',plan_sha256:workflow.planHash(prepared),protected_branch:true});
  assert.equal(result.outcome,'complete');assert.deepEqual(result.created_commits[0].parents,[]);
});
test('a signalled commit process still audits the already updated ref without retry', t => {
  const root=repo(t);
  fs.writeFileSync(path.join(root,'.git/sd0x-test-hooks/post-commit'),'#!/bin/sh\nkill -TERM "$PPID"\n',{mode:0o755});
  const prepared=workflow.plan(root,'Signal fixture');
  const result=workflow.execute(root,prepared,{action:'commit',plan_sha256:workflow.planHash(prepared),protected_branch:true});
  assert.equal(result.outcome,'partial-or-unknown');assert.equal(result.created_commits.length,1);
  assert.equal(result.retries_authorized,false);assert.match(result.marker,/^sd0x-commit-/);
});

test('deleting every tracked file is a real staged change, while unchanged empty tree is refused', t => {
  const root = repo(t);
  git(root, ['rm', '-rf', '--', '.']);
  const prepared = workflow.plan(root, 'Remove tracked fixtures');
  const result = workflow.execute(root, prepared, { action: 'commit', plan_sha256: workflow.planHash(prepared), protected_branch: true });
  assert.equal(result.outcome, 'complete');
  assert.equal(git(root, ['ls-tree', '-r', 'HEAD']).toString(), '');
  assert.throws(() => workflow.plan(root, 'No change'), /no staged changes/);
});

test('ignored daemon sockets and changing cache files do not enter the commit subject', { skip: process.platform === 'win32' }, async t => {
  const root = repo(t);
  fs.writeFileSync(path.join(root, '.gitignore'), '/c/\n');
  git(root, ['add', '--', '.gitignore']);
  fs.mkdirSync(path.join(root, 'c'));
  const server = require('node:net').createServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(path.join(root, 'c/s'), resolve); });
  try {
    fs.writeFileSync(path.join(root, 'c/log'), 'before');
    const prepared = workflow.plan(root, 'Commit with active local daemon');
    assert(!prepared.worktree_paths.some(file => file.startsWith('c/')));
    fs.writeFileSync(path.join(root, 'c/log'), 'after');
    const result = workflow.execute(root, prepared, { action: 'commit', plan_sha256: workflow.planHash(prepared), protected_branch: true });
    assert.equal(result.outcome, 'complete');
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('tracked ignored files and new eligible untracked files still invalidate a commit plan', t => {
  const root = repo(t);
  fs.writeFileSync(path.join(root, '.gitignore'), 'file.txt\n');
  git(root, ['add', '--', '.gitignore']);
  const prepared = workflow.plan(root, 'Bind tracked ignored content');
  assert(prepared.worktree_paths.includes('file.txt'));
  const head = git(root, ['rev-parse', 'HEAD']).toString();
  fs.writeFileSync(path.join(root, 'file.txt'), 'changed');
  assert.throws(() => workflow.execute(root, prepared, { action: 'commit', plan_sha256: workflow.planHash(prepared), protected_branch: true }), /drifted/);
  fs.writeFileSync(path.join(root, 'file.txt'), 'two');
  fs.writeFileSync(path.join(root, 'new.txt'), 'new');
  assert.throws(() => workflow.execute(root, prepared, { action: 'commit', plan_sha256: workflow.planHash(prepared), protected_branch: true }), /drifted/);
  assert.equal(git(root, ['rev-parse', 'HEAD']).toString(), head);
});

test('readback retains staged-deleted ignored paths and detects their mutation by hooks', t => {
  const root = repo(t);
  fs.writeFileSync(path.join(root, '.gitignore'), 'file.txt\n');
  git(root, ['add', '--', '.gitignore']);
  git(root, ['rm', '--cached', '--', 'file.txt']);
  fs.writeFileSync(path.join(root, '.git/sd0x-test-hooks/post-commit'), '#!/bin/sh\nprintf changed > file.txt\n', { mode: 0o755 });
  const prepared = workflow.plan(root, 'Remove ignored tracked file');
  assert(prepared.worktree_paths.includes('file.txt'));
  const result = workflow.execute(root, prepared, { action: 'commit', plan_sha256: workflow.planHash(prepared), protected_branch: true });
  assert.equal(result.outcome, 'partial-or-unknown');
  assert.equal(result.created_commits.length, 1);
});

test('tracked descendants cannot be observed through a replaced symlink ancestor', { skip: process.platform === 'win32' }, t => {
  const root = repo(t);
  fs.renameSync(path.join(root, 'sub'), path.join(root, 'outside'));
  fs.symlinkSync('outside', path.join(root, 'sub'));
  assert.throws(() => workflow.plan(root, 'Reject ancestor replacement'), /ancestor/);
});

test('moving metadata-shaped bytes between files invalidates worktree and hook plans', t => {
  for (const scope of ['worktree', 'hooks']) {
    const root = repo(t);
    const directory = scope === 'worktree' ? root : path.join(root, '.git/sd0x-test-hooks');
    const a = path.join(directory, 'a'), b = path.join(directory, 'b');
    fs.writeFileSync(b, 'y');
    const boundary = JSON.stringify(['b', fs.statSync(b).mode]);
    fs.writeFileSync(a, 'x' + boundary);
    const prepared = workflow.plan(root, 'Reject changed ' + scope + ' bytes');
    fs.writeFileSync(a, 'x');
    fs.writeFileSync(b, boundary + 'y');
    assert.throws(() => workflow.execute(root, prepared, {
      action: 'commit', plan_sha256: workflow.planHash(prepared), protected_branch: true
    }), /drifted/, scope);
    assert.equal(git(root, ['rev-parse', 'HEAD']).toString().trim(), prepared.head);
  }
});

test('post-commit content boundary movement cannot certify unchanged working bytes', { skip: process.platform === 'win32' }, t => {
  const root = repo(t);
  fs.writeFileSync(path.join(root, 'b'), 'y');
  const boundary = JSON.stringify(['b', fs.statSync(path.join(root, 'b')).mode]);
  fs.writeFileSync(path.join(root, 'a'), 'x' + boundary);
  fs.writeFileSync(path.join(root, '.git/sd0x-test-hooks/post-commit'),
    '#!/bin/sh\nprintf x > a\nprintf \'%s\' \'' + boundary + 'y\' > b\n', { mode: 0o755 });
  const prepared = workflow.plan(root, 'Observe hook content mutation');
  const result = workflow.execute(root, prepared, {
    action: 'commit', plan_sha256: workflow.planHash(prepared), protected_branch: true
  });
  assert.equal(result.outcome, 'partial-or-unknown');
  assert.equal(result.created_commits.length, 1);
  assert.equal(result.retries_authorized, false);
});
