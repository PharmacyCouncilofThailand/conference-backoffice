import assert from 'node:assert/strict';
import test from 'node:test';
import { isCheckinTestCode, testRegistration, testSessions } from './checkin-test-mode';

test('only the exact word test triggers the scanner self-test', () => {
  for (const code of ['test', 'TEST', ' Test ', 'tEsT']) assert.equal(isCheckinTestCode(code), true);
  for (const code of ['', 'TEST1', 'TESTJAMEYET', 'REG-TEST', 'te st']) assert.equal(isCheckinTestCode(code), false);
});

test('simulated attendee uses the current event and has two open sessions', () => {
  assert.equal(testRegistration('PRIS 2026').eventName, 'PRIS 2026');
  assert.equal(testRegistration(null).eventName, 'ทดสอบระบบ');
  const sessions = testSessions();
  assert.equal(sessions.length, 2);
  assert.ok(sessions.every((s) => s.checkedInAt === null && s.sessionId < 0));
});
