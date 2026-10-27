import type { AssignedSession } from '@/contexts/AuthContext';

// Session picker helpers for the check-in scanner. Every role checks in one
// chosen session at a time (no "all sessions" mode).

/** Events assigned without any session-level assignment (whole-event staff). */
export function eventLevelEventIds(
  assignedEvents: { id: number }[],
  assignedSessions: AssignedSession[],
): number[] {
  return assignedEvents
    .map((event) => event.id)
    .filter((id) => !assignedSessions.some((s) => s.eventId === id));
}

/** A session record from the events API as a pickable session. */
export function toAssignedSession(
  record: Record<string, unknown>,
  eventId: number,
): AssignedSession | null {
  if (typeof record.id !== 'number' || typeof record.sessionName !== 'string')
    return null;
  return {
    eventId,
    sessionId: record.id,
    sessionName: record.sessionName,
    sessionType:
      typeof record.sessionType === 'string' ? record.sessionType : null,
    room: typeof record.room === 'string' ? record.room : null,
    startTime: typeof record.startTime === 'string' ? record.startTime : '',
    endTime: typeof record.endTime === 'string' ? record.endTime : '',
  };
}

/** Main session id per event id, as reported by the desk summary. */
export type MainSessionIds = Record<number, number>;

export function isMainSession(
  mainSessionIds: MainSessionIds,
  session: Pick<AssignedSession, 'eventId' | 'sessionId'>,
): boolean {
  return mainSessionIds[session.eventId] === session.sessionId;
}
