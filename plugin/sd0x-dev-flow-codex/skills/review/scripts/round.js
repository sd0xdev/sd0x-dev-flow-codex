#!/usr/bin/env node
'use strict';

const {
  beginCollaborationReview,
  loadCollaborationProfile,
  importCollaborationReview
} = require('../../../scripts/runtime/collaboration');

const [command, ...flags] = process.argv.slice(2);
try {
  let result;
  if (flags.length && !(command === 'begin' && flags.length === 1 && flags[0] === '--profile-dispatch') &&
      !(command === 'profile-load' && flags.length === 1 && /^[0-9a-f-]{36}$/i.test(flags[0]))) {
    throw new Error('Unsupported review round arguments');
  }
  if (command === 'begin') result = beginCollaborationReview(process.cwd(), { profileDispatch: flags.includes('--profile-dispatch') });
  else if (command === 'profile-load' && flags.length === 1) result = loadCollaborationProfile(process.cwd(), flags[0]);
  else if (command === 'import') result = importCollaborationReview(process.cwd());
  else throw new Error('Usage: round.js <begin [--profile-dispatch]|import>');
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`sd0x collaboration review: ${error.message}\n`);
  process.exitCode = 1;
}
