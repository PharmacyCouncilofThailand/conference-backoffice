import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const base = 'http://127.0.0.1:3007';
const artifacts = process.env.RESEND_UI_ARTIFACTS || 'D:/confer/confer/conference/.codex-tmp/session-invitation-resend';
await mkdir(artifacts, { recursive: true });
const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const token = `e30.${Buffer.from(JSON.stringify({ exp: 4102444800 })).toString('base64url')}.synthetic`;
await context.addInitScript(({ token }) => {
  if (window.top !== window) return;
  localStorage.setItem('backoffice_token', token);
  localStorage.setItem('backoffice_user', JSON.stringify({ id: 1, firstName: 'Synthetic', lastName: 'Admin',
    role: 'admin', email: 'admin@example.invalid', assignedEvents: [] }));
}, { token });
const rows = [1, 2].map(n => ({ id: uuid(10 + n), batchId: uuid(20 + n), registrationId: n,
  regCode: `SYNTHETIC-${n}`, name: `Recipient ${n}`, recipientEmail: `recipient${n}@example.invalid`,
  eventId: 2, sessionId: 5, sessionName: 'Policy Innovation Workshop', actorName: 'Synthetic Admin',
  createdAt: '2026-10-23T00:00:00.000Z', outcome: 'invited', reasonCode: null, emailStatus: 'sent',
  attemptCount: 1, lastErrorCode: null, sentAt: '2026-10-23T00:00:00.000Z', lastAttemptAt: '2026-10-23T00:00:00.000Z',
  lastSuccessfulSentAt: '2026-10-23T00:00:00.000Z', lastResendQueuedAt: null,
  successfulResendCount: 0, resendEligible: true, resendDisabledReason: null, resendEligibleAt: null,
  invitation: { invitationId: uuid(n), invitationStatus: 'pending', expiresAt: '2099-01-01T03:30:00.000Z',
    effectiveDeadline: '2099-01-01T03:30:00.000Z', respondedAt: null } }));
const pagination = (total, page = 1, limit = 100) => ({ page, limit, total, totalPages: Math.ceil(total / limit) });
const posts = [];
const operations = new Map();
let result;
let failFirstPost = true;
let operationGets = 0;
await context.route('**/*', async route => {
  const request = route.request();
  const url = new URL(request.url());
  if (url.origin !== base) return route.abort('blockedbyclient');
  if (!url.pathname.startsWith('/api/')) return route.continue();
  const json = data => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
  if (url.pathname === '/api/backoffice/events') return json({ events: [{ id: 2, eventName: 'PRIS 2026' }], pagination: pagination(1) });
  if (url.pathname === '/api/backoffice/sessions') return json({ sessions: [5, 6].map(id => ({ id, eventId: 2,
    sessionName: id === 5 ? 'Policy Innovation Workshop' : 'Other Session', isActive: true })), pagination: pagination(2) });
  if (url.pathname.endsWith('/session-grants/status')) return json({ enabled: true, resendSupported: true });
  if (url.pathname.endsWith('/session-grants/tracking')) {
    const p = Number(url.searchParams.get('page') || '1');
    return json({ items: [rows[p === 2 ? 1 : 0]], pagination: pagination(2, p, 1), summary: { total: 2,
      outcomeCounts: { added: 0, invited: 2, skipped: 0 }, invitationCounts: { pending: 2, accepted: 0, declined: 0, expired: 0, revoked: 0 },
      emailCounts: { sent: 2, pending: 0, sending: 0, failed: 0, unknown: 0, suppressed: 0, not_applicable: 0 } } });
  }
  if (url.pathname.endsWith('/session-grants/resend-preview')) {
    const input = request.postDataJSON();
    return json({ emails: input.invitationIds.map(id => {
      const row = rows.find(row => row.invitation.invitationId === id);
      return { invitationId: id, registrationId: row.registrationId, name: row.name, recipient: row.recipientEmail,
        subject: 'Synthetic shared invitation subject', html: '<html lang="th"><body><p>ข้อความตัวอย่าง</p><p><a href="https://preview.invalid/">https://preview.invalid/</a></p></body></html>' };
    }), skipped: [] });
  }
  if (url.pathname.endsWith('/session-grants/resend')) {
    const input = request.postDataJSON();
    posts.push({ key: request.headers()['idempotency-key'], input });
    result = operations.get(request.headers()['idempotency-key']) || {
      requestId: uuid(100 + operations.size), sessionId: input.sessionId, requestedCount: input.invitationIds.length,
      queued: input.invitationIds.map(id => ({ invitationId: id, itemId: rows.find(row => row.invitation.invitationId === id).id })), skipped: [] };
    operations.set(request.headers()['idempotency-key'], result);
    if (failFirstPost) { failFirstPost = false; return route.abort('failed'); }
    return json(result);
  }
  if (url.pathname.includes('/session-grants/resends/')) {
    operationGets++;
    if (operationGets === 2) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Synthetic temporary failure' }) });
    const waiting = operationGets === 1;
    return json({ result, actorId: 1, createdAt: '2026-10-23T03:00:00.000Z',
    entries: result.queued.map(entry => ({ ...entry, batchId: rows.find(row => row.id === entry.itemId).batchId,
      recipient: 'synthetic@example.invalid', name: 'Synthetic', state: waiting ? 'waiting' : 'sent', attemptNo: waiting ? null : 2,
      finishedAt: waiting ? null : '2026-10-23T03:00:01.000Z', errorCode: null })), summary: { waiting: waiting ? result.queued.length : 0, sending: 0, sent: waiting ? 0 : result.queued.length,
      failed: 0, unknown: 0, suppressed: 0 }, pagination: pagination(result.queued.length) });
  }
  return json({});
});
try {
  await page.goto(`${base}/session-grants?eventId=2&sessionId=5&limit=1`, { waitUntil: 'networkidle' });
  await page.getByRole('checkbox', { name: 'เลือกส่งคำเชิญซ้ำ Recipient 1' }).check();
  await page.locator('select').nth(1).selectOption('6');
  await page.getByText('เลือกข้ามหน้า 0 / 500 รายการ', { exact: false }).waitFor();
  await page.locator('select').nth(1).selectOption('5');
  await page.getByRole('checkbox', { name: 'เลือกส่งคำเชิญซ้ำ Recipient 1' }).check();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('checkbox', { name: 'เลือกส่งคำเชิญซ้ำ Recipient 2' }).check();
  await page.getByText('เลือกข้ามหน้า 2 / 500 รายการ', { exact: false }).waitFor();
  await page.screenshot({ path: `${artifacts}/resend-cross-page.png`, fullPage: true });
  await page.getByRole('button', { name: 'ส่งคำเชิญซ้ำ (2)', exact: true }).click();
  await page.getByRole('dialog').waitFor();
  assert.equal(await page.getByText('Synthetic shared invitation subject', { exact: false }).count(), 1);
  await page.getByRole('button', { name: 'ยืนยันส่งคำเชิญซ้ำ 2 ฉบับ', exact: true }).click();
  await page.waitForFunction(() => !!sessionStorage.getItem('session-invitation-resend:1:5'));
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'กู้คืนคำขอเดิม', exact: true }).click();
  await page.getByRole('region', { name: 'ผลส่งคำเชิญซ้ำ' }).waitFor();
  await page.getByText('เข้าคิวแล้ว 2 · ข้าม 0 · เลือกทั้งหมด 2', { exact: true }).waitFor();
  assert.equal(posts.length, 2);
  assert.deepEqual(posts[0], posts[1], 'ambiguous POST recovery uses the exact original key and IDs');
  assert.equal(new Set(posts[0].input.invitationIds).size, 2, 'cross-page selection preserved both recipients');
  await page.waitForFunction(() => sessionStorage.getItem('session-invitation-resend:1:5') === null, { timeout: 15_000 });
  assert.ok(operationGets >= 3, 'polling recovers automatically after a transient operation GET failure');
  await page.screenshot({ path: `${artifacts}/resend-recovered-results.png`, fullPage: true });
  await page.getByRole('button', { name: 'ส่งคำเชิญซ้ำ', exact: true }).click();
  await page.getByRole('button', { name: 'ยืนยันส่งคำเชิญซ้ำ 1 ฉบับ', exact: true }).click();
  await page.waitForFunction(() => sessionStorage.getItem('session-invitation-resend:1:5') === null);
  assert.equal(posts.length, 3);
  assert.equal(posts[2].input.invitationIds.length, 1, 'single-row send submits exactly one original invitation');
  assert.notEqual(posts[2].key, posts[1].key, 'a new intentional operation receives a new key');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => document.querySelector('aside')?.getBoundingClientRect().right <= 1);
  await page.screenshot({ path: `${artifacts}/resend-mobile.png`, fullPage: true });
  assert.deepEqual(errors, [], 'no browser runtime errors');
  console.log(JSON.stringify({ passed: ['single-row resend', 'cross-page bulk selection', 'shared preview', 'ambiguous POST recovery after reload',
    'same idempotency key and recipients', 'operation results', 'terminal storage cleanup', 'session scope reset',
    'automatic polling recovery after503', 'desktop/mobile rendering'], posts: posts.length, operationGets, errors }));
} catch (error) {
  await page.screenshot({ path: `${artifacts}/resend-failure.png`, fullPage: true });
  console.error((await page.locator('body').innerText()).slice(-7000));
  throw error;
} finally { await browser.close(); }
