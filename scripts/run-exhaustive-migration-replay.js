'use strict';

// Explicit files prevent a renamed test from silently disappearing behind a
// name filter. Current-state checks belong to npm check; these are transitions.
const { parseOptions, runTests } = require('./run-tests');

try {
  process.exitCode = runTests({ ...parseOptions(process.argv.slice(2)), suite: 'replay' });
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
