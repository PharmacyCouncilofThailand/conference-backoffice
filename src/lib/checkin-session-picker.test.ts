import assert from 'node:assert/strict';
import test from 'node:test';
import {
  eventLevelEventIds,
  isMainSession,
  toAssignedSession,
} from './checkin-session-picker';

const session = (eventId: number, sessionId: number) => ({
  eventId,
  sessionId,
  sessionName: `S${sessionId}`,
  sessionType: null,
  room: null,
  startTime: '',
  endTime: '',
});

test('events without session-level assignments are event-level', () => {
  const events = [{ id: 1 }, { id: 2 }, { id: 3 }];
  assert.deepEqual(eventLevelEventIds(events, [session(2, 5)]), [1, 3]);
  assert.deepEqual(eventLevelEventIds(events, []), [1, 2, 3]);
  assert.deepEqual(eventLevelEventIds([], [session(2, 5)]), []);
});

test('session records from the events API become pickable sessions', () => {
  assert.deepEqual(
    toAssignedSession(
      {
        id: 4,
        sessionName: 'Pharma zone',
        sessionType: 'lecture',
        room: 'Room 8-10',
        startTime: '2026-10-27T19:00:00.000Z',
        endTime: '2026-10-30T03:00:00.000Z',
      },
      2,
    ),
    {
      eventId: 2,
      sessionId: 4,
      sessionName: 'Pharma zone',
      sessionType: 'lecture',
      room: 'Room 8-10',
      startTime: '2026-10-27T19:00:00.000Z',
      endTime: '2026-10-30T03:00:00.000Z',
    },
  );
  assert.equal(toAssignedSession({ sessionName: 'no id' }, 2), null);
  assert.equal(toAssignedSession({ id: 4 }, 2), null);
});

test('a session is main only when it matches its own event main session id', () => {
  const mainIds = { 2: 2, 5: 9 };
  assert.equal(isMainSession(mainIds, session(2, 2)), true);
  assert.equal(isMainSession(mainIds, session(2, 3)), false);
  assert.equal(isMainSession(mainIds, session(5, 2)), false);
  assert.equal(isMainSession(mainIds, session(7, 2)), false);
  assert.equal(isMainSession({}, session(2, 2)), false);
});
