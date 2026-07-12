#!/usr/bin/env node
'use strict';

const {
  beginCollaborationReview,
  importCollaborationReview
} = require('../../../scripts/runtime/collaboration');

const [command] = process.argv.slice(2);
try {
  let result;
  if (command === 'begin') result = beginCollaborationReview(process.cwd());
  else if (command === 'import') result = importCollaborationReview(process.cwd());
  else throw new Error('Usage: round.js <begin|import>');
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`sd0x collaboration review: ${error.message}\n`);
  process.exitCode = 1;
}
