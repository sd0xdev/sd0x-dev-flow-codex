#!/usr/bin/env node
'use strict';

const policy = require('./git-policy');
const deploy = require('./deployment');
const stack = require('./stack');
const contracts = require('./contracts');
const { planAdr } = require('./adr');

function dispatch(input, root = process.cwd()) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Expected one workflow request');
  switch (input.action) {
    case 'git-hooks-install': return require('./git-hooks').install(root, input.options);
    case 'git-hooks-doctor': return require('./git-hooks').doctor(root);
    case 'git-hooks-remove-push': return require('./git-hooks').removePushGate(root);
    case 'resolve-ref': return require('./git-refs').resolve(root, input.ref);
    case 'remote-mapping': return require('./git-refs').remoteMapping(input.destination, input.remotes);
    case 'commit-inspect': return require('./commit-workflow').inspect(root);
    case 'commit-plan': return require('./commit-workflow').plan(root, input.message);
    case 'commit-execute': return require('./commit-workflow').execute(root, input.plan, input.grant);
    case 'commit-audit': return require('./commit-workflow').audit(root, input.plan, input.marker);
    case 'reference-stability': return require('./reference-stability').plan(root, input.options);
    case 'intent-create': return require('./feature-docs').createIntent(root, input.options);
    case 'intent-read': {
      const context = require('../../skills/create-request/scripts/request-tool').resolveFeature(root, input.options);
      return require('./feature-docs').readIntent(root, context);
    }
    case 'comment-scan': return require('./comment-blocks').scanComments(root, input.files);
    case 'review-diagnose': return require('./review-diagnostics').diagnose(input.rounds);
    case 'sanitize-pr': return require('./attribution').sanitizePr(input.options);
    case 'attribution-check': return require('./attribution').assertClean(input.text);
    case 'policy': return policy.readPolicy(root);
    case 'policy-scaffold': return policy.scaffoldPolicy(root);
    case 'contract': return contracts.readContract(input.topic, { expectedVersion: input.version });
    case 'locator': return contracts.locator();
    case 'adr-plan': return planAdr(root, input.options);
    case 'stack-plan': return stack.planStack({ ...input.options, policy: policy.readPolicy(root).policy });
    case 'stack-observe': return stack.stackObservation(input.layers, input.responses);
    case 'stack-outcome': return stack.publicationOutcome(input.options);
    case 'stack-api-plan': return stack.stackApiPlan(input.repository, input.numbers, input.existing ?? null);
    case 'deploy-plan': return deploy.planStep(root, input.index, input.bindings);
    case 'deploy-step': return deploy.executeStep(root, input.plan, input.grant);
    case 'offer': {
      const { refreshState, summarize } = require('./state');
      const { execFileSync } = require('node:child_process');
      let branch = null;
      try { branch = execFileSync('git', ['-C', root, 'symbolic-ref', '--quiet', '--short', 'HEAD'],
        { encoding: 'utf8', env: deploy.environment(), stdio: ['ignore', 'pipe', 'pipe'] }).trim(); } catch { /* detached */ }
      const gates = summarize(refreshState(root));
      return policy.offerDecision({ policy: policy.readPolicy(root).policy, branch,
        fingerprint: gates.fingerprint, gates, declinedFingerprint: input.declined_fingerprint,
        prohibited: input.prohibited === true });
    }
    default: throw new Error('Unknown native workflow action');
  }
}

if (require.main === module) {
  try {
    if (process.argv.length !== 3 || Buffer.byteLength(process.argv[2]) > 256 * 1024) throw new Error('Expected one bounded JSON request');
    console.log(JSON.stringify(dispatch(JSON.parse(process.argv[2])), null, 2));
  } catch (error) { console.error('Native workflow: ' + error.message); process.exitCode = 1; }
}
module.exports = { dispatch };
