'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROUTING_MARKER = '<!-- sd0x-routing-contract:v1 ';

function routingContractBlock(unit, routing) {
  return [
    `${ROUTING_MARKER}unit=${unit} -->`,
    '```json',
    JSON.stringify({
      positive_triggers: routing.positive_triggers,
      negative_boundaries: routing.negative_boundaries
    }, null, 2),
    '```'
  ].join('\n');
}

function routingDescription(target, registry) {
  const encoded = JSON.stringify(
    `Route ${target} using exact migration registry ${JSON.stringify(registry)}.`
  );
  assert.ok(Buffer.byteLength(encoded) <= 4096,
    `routing description exceeds 4096 bytes for ${target}`);
  return encoded;
}

function routingTestSource(spec) {
  const registry = spec.registry || [{ unit: spec.unit, routing: spec.routing }];
  const payload = {
    target: spec.target,
    targetPackage: spec.targetPackage,
    unit: spec.unit,
    registry,
    routing: {
      positive_triggers: spec.routing.positive_triggers,
      negative_boundaries: spec.routing.negative_boundaries
    }
  };
  return [
    "'use strict';",
    `// sd0x-migration-test target=${spec.target} unit=${spec.unit}`,
    "const { defineRoutingContractTests } = require('../scripts/skill-routing-test');",
    `defineRoutingContractTests(${JSON.stringify(payload, null, 2)});`,
    ''
  ].join('\n');
}

function parseRoutingContract(skillText, unit) {
  const marker = `${ROUTING_MARKER}unit=${unit} -->`;
  const markerIndex = skillText.indexOf(marker);
  assert.notEqual(markerIndex, -1, `SKILL.md is missing routing contract for ${unit}`);
  assert.equal(skillText.indexOf(marker, markerIndex + marker.length), -1,
    `SKILL.md has duplicate routing contract for ${unit}`);
  const tail = skillText.slice(markerIndex + marker.length);
  const match = /^\s*```json\s*\n([\s\S]*?)\n```/.exec(tail);
  assert.ok(match, `SKILL.md routing contract for ${unit} must be a JSON block`);
  return JSON.parse(match[1]);
}

function containedRegularFile(root, relative) {
  const rootReal = fs.realpathSync(root);
  let current = root;
  for (const component of relative.split('/')) {
    current = path.join(current, component);
    let stat;
    try {
      stat = fs.lstatSync(current);
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      throw error;
    }
    assert.equal(stat.isSymbolicLink(), false,
      `routing skill path must not contain symlinks: ${relative}`);
  }
  assert.equal(fs.lstatSync(current).isFile(), true,
    `routing skill path must be a regular file: ${relative}`);
  const resolved = fs.realpathSync(current);
  assert.ok(resolved.startsWith(`${rootReal}${path.sep}`),
    `routing skill path escapes repository: ${relative}`);
  return { relative, absolute: current };
}

function skillCandidate(root, spec) {
  const values = [
    `migration/candidates/${spec.target}/SKILL.md`,
    `plugin/sd0x-dev-flow-codex/skills/${spec.target}/SKILL.md`
  ];
  if (spec.targetPackage !== 'core') {
    values.push(`migration/packs/${spec.targetPackage}/${spec.target}/SKILL.md`);
  }
  const matches = values.map((relative) => containedRegularFile(root, relative)).filter(Boolean);
  const candidate = matches.find((entry) => entry.relative.startsWith('migration/candidates/'));
  if (candidate) return candidate;
  assert.equal(matches.length, 1,
    `routing test requires exactly one final SKILL.md for ${spec.target}`);
  return matches[0];
}

function validateRoutingContract(skillText, spec) {
  assert.ok(Array.isArray(spec.registry) && spec.registry.length > 0,
    'routing registry is required');
  const markerPrefixCount = (skillText.match(/<!-- sd0x-routing-contract:v1/g) || []).length;
  const markerUnits = [...skillText.matchAll(
    /<!-- sd0x-routing-contract:v1 unit=([^\s>]+) -->/g
  )].map((match) => match[1]).sort();
  const registryUnits = spec.registry.map((entry) => entry.unit).sort();
  assert.equal(markerPrefixCount, markerUnits.length,
    'SKILL.md contains malformed routing contract marker');
  assert.deepEqual(markerUnits, registryUnits,
    'SKILL.md routing contract units must exactly equal the registry');
  for (const entry of spec.registry) {
    const contract = parseRoutingContract(skillText, entry.unit);
    assert.deepEqual(contract, entry.routing,
      `SKILL.md routing contract differs from migration-contract.json for ${entry.unit}`);
    assert.ok(skillText.includes(routingContractBlock(entry.unit, entry.routing)),
      `SKILL.md routing contract block must use canonical bytes for ${entry.unit}`);
  }
  const owners = new Map();
  const excluded = new Set();
  for (const entry of spec.registry) {
    for (const prompt of entry.routing.positive_triggers) {
      if (!owners.has(prompt)) owners.set(prompt, []);
      owners.get(prompt).push(entry.unit);
    }
    for (const prompt of entry.routing.negative_boundaries) excluded.add(prompt);
  }
  for (const [prompt, units] of owners) {
    assert.equal(units.length, 1,
      `positive routing prompt must have exactly one unit owner: ${prompt}`);
    assert.equal(excluded.has(prompt), false,
      `routing prompt cannot be both positive and negative across units: ${prompt}`);
  }
  const selected = spec.registry.find((entry) => entry.unit === spec.unit);
  assert.ok(selected, `routing registry is missing selected unit ${spec.unit}`);
  assert.deepEqual(selected.routing, spec.routing,
    `selected routing contract differs for ${spec.unit}`);
  const actual = selected.routing;
  const positive = new Set(actual.positive_triggers);
  const negative = new Set(actual.negative_boundaries);
  for (const value of positive) {
    assert.equal(negative.has(value), false,
      `routing case cannot be both positive and negative: ${value}`);
  }
  const frontmatter = /^---\n([\s\S]*?)\n---/.exec(skillText);
  assert.ok(frontmatter, 'SKILL.md requires frontmatter for routing');
  const descriptionLine = frontmatter[1].split('\n')
    .find((line) => line.startsWith('description: '));
  assert.equal(descriptionLine,
    `description: ${routingDescription(spec.target, spec.registry)}`,
  `SKILL.md description contradicts routing contract for ${spec.unit}`);
  let unmanaged = skillText.replace(frontmatter[0], '');
  for (const entry of spec.registry) {
    unmanaged = unmanaged.replace(routingContractBlock(entry.unit, entry.routing), '');
  }
  assert.doesNotMatch(unmanaged,
    /\b(?:route|routing|trigger(?:s|ed)?|positive prompts?|negative prompts?)\b|\b(?:use|do not use|don't use)\s+(?:this|the)\s+skill\b/i,
  `SKILL.md has routing policy outside the managed registry for ${spec.unit}`);
  return actual;
}

function routePrompt(skillText, spec, prompt) {
  validateRoutingContract(skillText, spec);
  if (spec.registry.some((entry) => entry.routing.negative_boundaries.includes(prompt))) {
    return false;
  }
  const owners = spec.registry.filter((entry) => entry.routing.positive_triggers.includes(prompt));
  return owners.length === 1 && owners[0].unit === spec.unit;
}

function defineRoutingContractTests(spec) {
  const selected = skillCandidate(process.cwd(), spec);
  const skillText = fs.readFileSync(selected.absolute, 'utf8');
  const actual = validateRoutingContract(skillText, spec);
  for (const [index, prompt] of actual.positive_triggers.entries()) {
    test(`positive routing ${spec.unit} case ${index + 1}: ${prompt}`, () => {
      assert.equal(routePrompt(skillText, spec, prompt), true);
    });
  }
  for (const [index, prompt] of actual.negative_boundaries.entries()) {
    test(`negative routing ${spec.unit} case ${index + 1}: ${prompt}`, () => {
      assert.equal(routePrompt(skillText, spec, prompt), false);
    });
  }
}

module.exports = {
  defineRoutingContractTests,
  routingContractBlock,
  routingDescription,
  routingTestSource,
  validateRoutingContract
};
