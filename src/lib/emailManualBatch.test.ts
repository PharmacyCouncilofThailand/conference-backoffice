import assert from 'node:assert/strict';
import test from 'node:test';
import {
  EMAIL_MANUAL_CHUNK_SIZE,
  chunkIds,
  estimateSendSeconds,
} from './emailManualBatch';

test('chunkIds splits evenly and keeps the remainder', () => {
  assert.equal(EMAIL_MANUAL_CHUNK_SIZE, 20);
  assert.deepEqual(chunkIds([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.deepEqual(chunkIds([], 20), []);
  assert.equal(
    chunkIds(
      Array.from({ length: 1000 }, (_, i) => i),
      20,
    ).length,
    50,
  );
  assert.throws(() => chunkIds([1], 0), RangeError);
});

test('estimateSendSeconds uses 1.5s per email', () => {
  assert.equal(estimateSendSeconds(1000), 1500);
  assert.equal(estimateSendSeconds(3), 5);
});
