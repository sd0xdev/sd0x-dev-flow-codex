'use strict';

// Compatibility entrypoint for historical evidence and the Windows CI filter.
// npm test/check dispatch the individual files instead, avoiding double execution.
const path = require('node:path');
const { discoverTests } = require('../scripts/run-tests');
const root = path.resolve(__dirname, '..');
for (const file of discoverTests(root, 'migration')) require(path.join(root, file));
if (process.env.SD0X_EXHAUSTIVE_MIGRATION_REPLAY === '1') {
  for (const file of discoverTests(root, 'replay')) require(path.join(root, file));
}
