import assert from 'node:assert/strict';
import test from 'node:test';
import { api } from './api';
import {
  persistPendingResend,
  readPendingResend,
  resendDisabledReason,
  resendStorageKey,
  selectResends,
} from './session-invitation-resend';
import type { GrantTrackingItemDto } from '../types/session-grants';

const row = (
  id: string,
  overrides: Partial<GrantTrackingItemDto> = {},
): GrantTrackingItemDto => ({
  id,
  batchId: `batch-${id}`,
  registrationId: 1,
  regCode: 'REG',
  name: 'Name',
  recipientEmail: 'saved@example.invalid',
  outcome: 'invited',
  reasonCode: null,
  eventId: 1,
  sessionId: 2,
  sessionName: 'Session',
  actorName: 'Admin',
  createdAt: '',
  emailStatus: 'sent',
  attemptCount: 1,
  lastErrorCode: null,
  sentAt: null,
  lastAttemptAt: null,
  invitation: {
    invitationId: id,
    invitationStatus: 'pending',
    expiresAt: '2099-01-01',
    effectiveDeadline: '2099-01-01',
    respondedAt: null,
  },
  resendEligible: true,
  resendDisabledReason: null,
  ...overrides,
});

test('selection retains different batches across pages, caps at 500 and resets scope', () => {
  let selected = selectResends(
    { scope: '', rows: new Map() },
    'actor:event:session',
    [row('one')],
    true,
  );
  selected = selectResends(selected, 'actor:event:session', [row('two')], true);
  assert.deepEqual([...selected.rows.keys()], ['one', 'two']);
  selected = selectResends(
    selected,
    'actor:event:session',
    [row('two')],
    false,
  );
  assert.deepEqual([...selected.rows.keys()], ['one']);
  selected = selectResends(
    selected,
    'actor:event:session',
    Array.from({ length: 600 }, (_, n) => row(String(n))),
    true,
  );
  assert.equal(selected.rows.size, 500);
  assert.equal(selectResends(selected, 'other-session', [], true).rows.size, 0);
  assert.equal(
    selectResends(selected, 'other-event', [row('other')], true).rows.size,
    1,
  );
});

test('eligibility fails closed and uses server policy including cooldown boundary', () => {
  assert.equal(resendDisabledReason(row('1'), true, true), null);
  assert.ok(resendDisabledReason(row('1'), false, true));
  assert.ok(resendDisabledReason(row('1'), true, false));
  assert.ok(
    resendDisabledReason(row('1', { resendEligible: undefined }), true, true),
  );
  for (const emailStatus of [
    'pending',
    'sending',
    'failed',
    'unknown',
    'suppressed',
  ] as const)
    assert.ok(resendDisabledReason(row('1', { emailStatus }), true, true));
  for (const invitationStatus of [
    'accepted',
    'expired',
    'declined',
    'revoked',
  ] as const)
    assert.ok(
      resendDisabledReason(
        row('1', { invitation: { ...row('1').invitation!, invitationStatus } }),
        true,
        true,
      ),
    );
  assert.ok(resendDisabledReason(row('1', { outcome: 'skipped' }), true, true));
  assert.equal(
    resendDisabledReason(
      row('1', {
        resendEligible: false,
        resendDisabledReason: 'RESEND_COOLDOWN',
        resendEligibleAt: '2026-10-23T03:05:00Z',
      }),
      true,
      true,
    ),
    'RESEND_COOLDOWN',
  );
  assert.equal(
    resendDisabledReason(
      row('1', {
        resendEligible: true,
        resendEligibleAt: '2026-10-23T03:05:00Z',
      }),
      true,
      true,
    ),
    null,
  );
});

test('durable recovery preserves exact key and input across uncertain results and actor scopes', () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
  const pending = {
    key: 'original-key',
    input: { sessionId: 2, invitationIds: ['b', 'a'] },
  };
  persistPendingResend(storage, 1, pending);
  assert.deepEqual(readPendingResend(storage, 1, 2), pending);
  assert.equal(readPendingResend(storage, 2, 2), null);
  assert.equal(readPendingResend(storage, 1, 3), null);
  persistPendingResend(storage, 1, { ...pending, requestId: 'request' });
  assert.deepEqual(readPendingResend(storage, 1, 2), {
    ...pending,
    requestId: 'request',
  });
  storage.setItem(
    resendStorageKey(1, 2),
    JSON.stringify({
      ...pending,
      input: { sessionId: 3, invitationIds: ['a'] },
    }),
  );
  assert.throws(() => readPendingResend(storage, 1, 2));
});

test('resend clients preserve exact HTTP contract and create preview compatibility', async (t) => {
  const original = globalThis.fetch;
  const calls: Array<{ url: string; options?: RequestInit }> = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    return new Response('{}', {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  t.after(() => {
    globalThis.fetch = original;
  });
  const input = { sessionId: 2, invitationIds: ['original-invitation'] };
  await api.sessionGrants.resendPreview('token', input);
  await api.sessionGrants.resend('token', 'same-key', input);
  await api.sessionGrants.resendOperation('token', 'request', 2, 500);
  await api.sessionGrants.preview('token', {
    sessionId: 2,
    registrationIds: [1],
  });
  assert.ok(calls[0].url.endsWith('/session-grants/resend-preview'));
  assert.ok(calls[1].url.endsWith('/session-grants/resend'));
  for (const call of calls.slice(0, 2)) {
    assert.equal(call.options?.method, 'POST');
    assert.deepEqual(JSON.parse(String(call.options?.body)), input);
  }
  assert.equal(
    new Headers(calls[1].options?.headers).get('Idempotency-Key'),
    'same-key',
  );
  assert.equal(
    new Headers(calls[1].options?.headers).get('Authorization'),
    'Bearer token',
  );
  assert.ok(calls[2].url.endsWith('/resends/request?page=2&limit=100'));
  assert.ok(calls[3].url.endsWith('/session-grants/preview'));
  assert.deepEqual(JSON.parse(String(calls[3].options?.body)), {
    sessionId: 2,
    registrationIds: [1],
  });
});
