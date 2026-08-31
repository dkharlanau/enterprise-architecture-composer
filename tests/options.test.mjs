import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { compareSolutionOptions } from '../src/options.mjs';

async function example() {
  const url = new URL('../examples/options/record-to-report-options.json', import.meta.url);
  return JSON.parse(await readFile(url, 'utf8'));
}

test('option comparison exposes explicit dimensions and no aggregate score', async () => {
  const comparison = compareSolutionOptions((await example()).options);
  assert.equal(comparison.method.scoreFree, true);
  assert.ok(comparison.method.burdenDimensions.length >= 5);
  assert.equal(Object.hasOwn(comparison, 'score'), false);
  assert.equal(Object.hasOwn(comparison, 'ranking'), false);
  for (const option of comparison.options) {
    assert.ok(option.dimensions.constraintFit.category);
    assert.ok(option.dimensions.coupling.category);
    assert.ok(option.dimensions.operationalComplexity.category);
    assert.ok(Array.isArray(option.dimensions.dataConsistencyModel.models));
    assert.ok(option.dimensions.migrationEffort.category);
  }
});

test('unconfirmed strict-NFR option is dominated by an otherwise identical confirmed or default option', async () => {
  const comparison = compareSolutionOptions((await example()).options);
  const dominated = comparison.dominance.filter((item) => item.dominatedOptionId === 'strict-unconfirmed');
  assert.ok(dominated.length >= 1);
  assert.ok(dominated.some((item) => item.reasons.some((reason) => reason.startsWith('constraintFit:') || reason.startsWith('unresolved:'))));
  assert.equal(comparison.preferredOptionIds.includes('strict-unconfirmed'), false);
});

test('Pareto preference can retain multiple options instead of forcing one universal winner', () => {
  const comparison = compareSolutionOptions([
    {
      id: 'lean-scope',
      context: { processes: ['record-to-report'] }
    },
    {
      id: 'broader-scope',
      context: { processes: ['order-to-cash', 'record-to-report'] }
    }
  ]);
  assert.ok(comparison.preferredOptionIds.length >= 1);
  assert.match(comparison.note, /not|non-dominated|business priorities/i);
});

test('comparison is deterministic regardless of input option order', async () => {
  const options = (await example()).options;
  const one = compareSolutionOptions(options);
  const two = compareSolutionOptions([...options].reverse());
  assert.deepEqual(one, two);
});

test('duplicate option IDs are rejected explicitly', () => {
  assert.throws(() => compareSolutionOptions([
    { id: 'same', context: { processes: ['record-to-report'] } },
    { id: 'same', context: { processes: ['order-to-cash'] } }
  ]), /unique/);
});
