import assert from 'node:assert/strict';
import test from 'node:test';
import { usesPrisDesk } from './checkin-desk-route';

const pris = { eventCode: 'PRIS-2026', mainSession: { id: 2 } };

test('PRIS main session opens the desk', () => {
  assert.equal(usesPrisDesk(pris, 2), true);
});

test('other PRIS sessions keep the regular scanner', () => {
  for (const sessionId of [3, 4, 5, 6, 7])
    assert.equal(usesPrisDesk(pris, sessionId), false);
});

test('other events keep the regular scanner, even on their main session', () => {
  assert.equal(
    usesPrisDesk({ eventCode: 'OTHER-2026', mainSession: { id: 2 } }, 2),
    false,
  );
  assert.equal(usesPrisDesk(null, 2), false);
});
