'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

function isolateGitEnvironment() {
  process.env.GIT_CONFIG_GLOBAL = os.devNull;
  process.env.GIT_CONFIG_NOSYSTEM = '1';
  delete process.env.GIT_CONFIG_COUNT;
  for (const key of Object.keys(process.env)) {
    if (/^GIT_CONFIG_(?:KEY|VALUE)_\d+$/.test(key)) delete process.env[key];
  }
}

function git(root, args, options = {}) {
  return execFileSync('git', args, {
    cwd: root,
    encoding: options.encoding,
    stdio: options.stdio,
    env: process.env
  });
}

function initRepository(root) {
  isolateGitEnvironment();
  git(root, ['init', '-b', 'main'], { stdio: 'ignore' });
  git(root, ['config', 'user.email', 'test@example.com']);
  git(root, ['config', 'user.name', 'Test']);
  git(root, ['config', 'commit.gpgSign', 'false']);
  git(root, ['config', 'tag.gpgSign', 'false']);
  git(root, ['config', 'advice.addEmbeddedRepo', 'false']);

  const hooksPath = path.join(root, '.git', 'sd0x-test-hooks');
  const excludesPath = path.join(root, '.git', 'sd0x-test-excludes');
  fs.mkdirSync(hooksPath, { recursive: true });
  fs.writeFileSync(excludesPath, '');
  git(root, ['config', 'core.hooksPath', hooksPath]);
  git(root, ['config', 'core.excludesFile', excludesPath]);
  return root;
}

function commit(root, message) {
  git(root, ['-c', 'commit.gpgSign=false', 'commit', '-m', message], {
    stdio: 'ignore'
  });
}

module.exports = {
  commit,
  git,
  initRepository,
  isolateGitEnvironment
};
