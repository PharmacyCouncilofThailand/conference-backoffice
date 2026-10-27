import assert from 'node:assert/strict';
import test from 'node:test';
import {
  EMAIL_MANUAL_CHUNK_SIZE,
  chunkIds,
  estimateSendSeconds,
  markSentRecipients,
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

test('markSentRecipients stamps only recipients whose result is sent', () => {
  const at = '2026-10-28T10:00:00.000Z';
  const recipients = [
    { id: 1, lastSentAt: null },
    { id: 2, lastSentAt: null },
    { id: 3, lastSentAt: '2026-10-27T01:00:00.000Z' },
    { id: 4, lastSentAt: null },
  ];
  const results = [
    { id: 1, status: 'sent' as const },
    { id: 2, status: 'failed' as const },
    { id: 3, status: 'skipped' as const },
  ];
  assert.deepEqual(markSentRecipients(recipients, results, at), [
    { id: 1, lastSentAt: at },
    { id: 2, lastSentAt: null },
    { id: 3, lastSentAt: '2026-10-27T01:00:00.000Z' },
    { id: 4, lastSentAt: null },
  ]);
});
