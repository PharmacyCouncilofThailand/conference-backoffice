import assert from 'node:assert/strict';
import test from 'node:test';
import { api } from './api';
import { sessionGrantRetryDisabledReason } from './session-grant-tracking';
import type { GrantTrackingItemDto } from '../types/session-grants';

function row(overrides: Partial<GrantTrackingItemDto> = {}): GrantTrackingItemDto {
  return {
    id: '123e4567-e89b-42d3-a456-426614174001', batchId: '123e4567-e89b-42d3-a456-426614174002',
    registrationId: 3, regCode: 'REG-3', name: 'Test', recipientEmail: 'saved@example.invalid',
    eventId: 4, sessionId: 5, sessionName: 'Session', actorName: 'Admin',
    createdAt: '2026-10-09T00:00:00.000Z', outcome: 'added', reasonCode: null,
    emailStatus: 'failed', attemptCount: 1, lastErrorCode: null, sentAt: null,
    lastAttemptAt: null, invitation: null, ...overrides,
  };
}

test('retry is limited by feature switch, mail state, and invitation state', () => {
  assert.equal(sessionGrantRetryDisabledReason(row(), true), null);
  assert.notEqual(sessionGrantRetryDisabledReason(row(), false), null);
  for (const emailStatus of ['sent', 'pending', 'sending', 'suppressed', 'not_applicable'] as const) {
    assert.notEqual(sessionGrantRetryDisabledReason(row({ emailStatus }), true), null);
  }
  assert.notEqual(sessionGrantRetryDisabledReason(row({ outcome: 'skipped' }), true), null);
  assert.notEqual(sessionGrantRetryDisabledReason(row({ outcome: 'invited' }), true), null);
  for (const invitationStatus of ['pending', 'accepted', 'declined', 'expired', 'revoked'] as const) {
    const item = row({ outcome: 'invited', emailStatus: 'unknown', invitation: {
      invitationId: 'test-invitation', invitationStatus, expiresAt: '2099-01-01T00:00:00.000Z',
      effectiveDeadline: '2099-01-01T00:00:00.000Z', respondedAt: null,
    } });
    assert.equal(sessionGrantRetryDisabledReason(item, true) === null, invitationStatus === 'pending');
  }
});

test('tracking, attempts and retry preserve the existing HTTP contracts', async (t) => {
  const original = globalThis.fetch;
  const requests: Array<{ url: string; options?: RequestInit }> = [];
  globalThis.fetch = async (input, options) => {
    const url = String(input); requests.push({ url, options });
    const body = url.includes('/retry') ? { queued: ['item'], skipped: [] }
      : url.includes('/email-attempts') ? { attempts: [], pagination: { page: 2, limit: 50, total: 0, totalPages: 0 } }
      : { items: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 }, summary: {
        total: 0, outcomeCounts: { added: 0, invited: 0, skipped: 0 },
        invitationCounts: { pending: 0, accepted: 0, declined: 0, expired: 0, revoked: 0 },
        emailCounts: { not_applicable: 0, pending: 0, sending: 0, sent: 0, failed: 0, unknown: 0, suppressed: 0 },
      } };
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  t.after(() => { globalThis.fetch = original; });
  await api.sessionGrants.tracking('test-token', 'eventId=4&responseStatus=pending');
  await api.sessionGrants.retry('test-token', 'batch', ['item'], true);
  await api.sessionGrants.emailAttempts('test-token', 'batch', 'item', 2, 50);
  assert.ok(requests[0].url.endsWith('/api/backoffice/session-grants/tracking?eventId=4&responseStatus=pending'));
  assert.equal(new Headers(requests[0].options?.headers).get('Authorization'), 'Bearer test-token');
  assert.equal(requests[1].options?.method, 'POST');
  assert.deepEqual(JSON.parse(String(requests[1].options?.body)), { itemIds: ['item'], acknowledgeUnknown: true });
  assert.ok(requests[2].url.endsWith('/batch/items/item/email-attempts?page=2&limit=50'));
});
