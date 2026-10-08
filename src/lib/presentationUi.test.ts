import assert from 'node:assert/strict';
import test from 'node:test';
import type { PresentationDetailDto, PresentationListRow, RevisionDto } from '../types/presentations';
import { presentationUserAssignments, activePresentationRequest, canResendPresentationJob, isPresentationActionAudit, canManagePresentations, presentationAuditSummary, presentationRouteId, thaiDeadlineInput, deadlineInputToClose, selectablePresentationIds } from './presentationUi';
import { api, ApiError } from './api';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as React from 'react';
import type { AuthProvider, User } from '../contexts/AuthContext';
import type { Sidebar } from '../components/layout/Sidebar';
import { PresentationComparison, PresentationEmailAttempts, PresentationDeadlineHistory, presentationProblemLabel } from '../components/presentations/PresentationHistoryViews';

test('only admins manage posters', () => {
  for (const role of ['organizer', 'reviewer', 'staff', 'verifier', 'team_registration_viewer', '', 'Admin']) {
    assert.equal(canManagePresentations(role), false);
  }
  assert.equal(canManagePresentations('admin'), true);
});

test('Organizer and Reviewer share type grants; categories remain Reviewer-only', () => {
  assert.deepEqual(presentationUserAssignments('organizer', ['oral'], ['clinical']), { assignedPresentationTypes: ['oral'] });
  assert.deepEqual(presentationUserAssignments('reviewer', ['poster'], ['clinical']), { assignedCategories: ['clinical'], assignedPresentationTypes: ['poster'] });
  assert.deepEqual(presentationUserAssignments('organizer', [], []), { assignedPresentationTypes: [] });
  assert.deepEqual(presentationUserAssignments('admin', ['oral'], ['clinical']), {});
});

test('Thai inclusive seconds map to the exclusive UTC close independently of host timezone', () => {
  for (const timezone of ['UTC', 'America/New_York', 'Asia/Bangkok']) {
    const original = process.env.TZ;
    try {
      process.env.TZ = timezone;
      assert.equal(thaiDeadlineInput('2026-10-15T17:00:00.000Z'), '2026-10-15T23:59:59');
      assert.equal(deadlineInputToClose('2026-10-15T23:59:59'), '2026-10-15T17:00:00.000Z');
      for (const value of ['2028-02-29T00:00:00', '2026-01-01T23:59:59', '2026-10-16T00:00:00']) {
        assert.equal(thaiDeadlineInput(deadlineInputToClose(value)), value);
      }
    } finally {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    }
  }
});

test('deadline inputs reject invalid calendar dates and missing seconds', () => {
  for (const value of ['2026-02-30T12:00:00', '2026-02-29T12:00:00', '2026-13-01T12:00:00', '2026-01-01T24:00:00', '2026-01-01T12:60:00', '2026-01-01T12:00', '2026-01-01T12:00:00Z', '']) {
    assert.throws(() => deadlineInputToClose(value));
  }
  assert.throws(() => thaiDeadlineInput('invalid'));
});

test('selection deduplicates abstract IDs and excludes ineligible rows', () => {
  assert.deepEqual(selectablePresentationIds([
    { abstractId: 501, canNotify: true }, { abstractId: null, canNotify: false },
    { abstractId: 501, canNotify: true }, { abstractId: 502, canNotify: false },
    { abstractId: null, canNotify: true }, { abstractId: 503, canNotify: true },
  ] as PresentationListRow[]), [501, 503]);
});

test('all poster routes preserve envelopes, verbs, scoped IDs, JSON and idempotency headers', async () => {
  const originalFetch = globalThis.fetch;
  const fingerprint = 'a'.repeat(64);
  const requestId = '11111111-1111-4111-8111-111111111111';
  const key = '22222222-2222-4222-8222-222222222222';
  const closesAt = '2026-10-15T17:00:00.000Z';
  const revision = { kind: 'revision' as const, abstractId: 501, requestId, details: 'Fix caption', closesAt };
  const preview = { fingerprint, requestId, closesAt, messages: [{ abstractId: 501, recipient: 'owner@example.invalid', subject: 'Revision', html: '<p>Revision</p>', templateVersion: 'presentation-v1' }] };
  const cases: Array<{ path: string; method: string; status?: number; body?: unknown; data?: unknown; keyed?: boolean; call: () => Promise<unknown> }> = [
    { path: '/presentation-settings', method: 'GET', call: () => api.presentations.getSettings(42, 'token') },
    { path: '/presentation-reconciliations', method: 'POST', status: 201, keyed: true, body: {}, call: () => api.presentations.recheck(42, key, 'token') },
    { path: '/presentation-targets?page=2&search=A%26B', method: 'GET', call: () => api.presentations.list(42, new URLSearchParams({ page: '2', search: 'A&B' }), 'token') },
    { path: '/presentation-targets/501', method: 'GET', call: () => api.presentations.detail(42, 501, 'token') },
    { path: '/presentation-email-previews', method: 'POST', body: revision, data: preview, call: () => api.presentations.preview(42, revision, 'token') },
    { path: '/presentation-notification-batches', method: 'POST', status: 202, keyed: true, body: { kind: 'initial', abstractIds: [501], previewFingerprint: fingerprint }, call: () => api.presentations.batch(42, { kind: 'initial', abstractIds: [501], previewFingerprint: fingerprint }, key, 'token') },
    { path: `/presentation-notification-batches/${requestId}`, method: 'GET', call: () => api.presentations.batchResult(42, requestId, 'token') },
    { path: '/presentation-verifications', method: 'POST', status: 201, keyed: true, body: { sourceKey: '1:501', fingerprint, reason: 'Checked' }, call: () => api.presentations.verify(42, { sourceKey: '1:501', fingerprint, reason: 'Checked' }, key, 'token') },
    { path: '/presentation-settings', method: 'PATCH', keyed: true, body: { closesAt, version: 1, reason: 'Extension' }, call: () => api.presentations.settings(42, { closesAt, version: 1, reason: 'Extension' }, key, 'token') },
    { path: '/presentation-targets/501/revision-requests', method: 'POST', status: 201, keyed: true, body: { requestId, details: 'Fix caption', closesAt, previewFingerprint: fingerprint }, call: () => api.presentations.createRevision(42, 501, { requestId, details: 'Fix caption', closesAt, previewFingerprint: fingerprint }, key, 'token') },
    { path: `/presentation-revision-requests/${requestId}/cancellations`, method: 'POST', status: 201, keyed: true, body: { reason: 'Replacement' }, call: () => api.presentations.cancelRevision(42, requestId, 'Replacement', key, 'token') },
    { path: `/presentation-email-jobs/${requestId}/resends`, method: 'POST', status: 202, keyed: true, body: { previewFingerprint: fingerprint }, call: () => api.presentations.resend(42, requestId, fingerprint, key, 'token') },
  ];
  try {
    for (const item of cases) {
      const envelope = { success: true, data: item.data ?? { marker: item.path } };
      globalThis.fetch = async (url, options) => {
        assert.ok(String(url).endsWith(`/api/backoffice/events/42${item.path}`));
        assert.equal(options?.method ?? 'GET', item.method);
        const headers = new Headers(options?.headers);
        assert.equal(headers.get('Authorization'), 'Bearer token');
        assert.equal(headers.get('Idempotency-Key'), item.keyed ? key : null);
        if (item.body !== undefined) {
          assert.equal(headers.get('Content-Type'), 'application/json');
          assert.deepEqual(JSON.parse(String(options?.body)), item.body);
        } else assert.equal(options?.body, undefined);
        return Response.json(envelope, { status: item.status ?? 200 });
      };
      assert.deepEqual(await item.call(), envelope);
    }
    globalThis.fetch = async () => Response.json({ error: 'Forbidden', code: 'PRESENTATION_FORBIDDEN' }, { status: 403 });
    await assert.rejects(api.presentations.recheck(42, key, 'token'), (error: unknown) => error instanceof ApiError && error.status === 403 && error.code === 'PRESENTATION_FORBIDDEN');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// Run the real components with only hooks/navigation replaced; no browser or new test framework.
function componentModule<T>(file: string, hooks: Partial<typeof React>, auth?: unknown, modules: Record<string, unknown> = {}): T {
  const require = createRequire(import.meta.url);
  const exports = {};
  const code = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  runInNewContext(code, { exports, URLSearchParams, crypto: globalThis.crypto, require: (name: string) => {
    if (name in modules) return modules[name];
    if (name === 'react') return { ...React, ...hooks };
    if (name === '@/contexts/AuthContext') return { useAuth: () => auth };
    if (name === '@/lib/jwt') return { isTokenExpired: () => false };
    if (name === 'next/navigation') return { usePathname: () => '/presentations' };
    return require(name);
  } });
  return exports as T;
}

test('page access, real sidebar links and assigned-event scope agree for every role', () => {
  const roles: User['role'][] = ['admin', 'organizer', 'reviewer', 'staff', 'verifier', 'team_registration_viewer'];
  for (const role of roles) {
    const user: User = { id: 1, firstName: 'Test', lastName: 'Staff', email: 'test@example.invalid', role, assignedEvents: [{ id: 42, code: 'EVENT', name: 'Assigned' }] };
    let stateIndex = 0;
    const states = [user, 'token', user.assignedEvents[0], false];
    const { AuthProvider: Provider } = componentModule<{ AuthProvider: typeof AuthProvider }>('src/contexts/AuthContext.tsx', {
      useEffect: () => {}, useState: (() => [states[stateIndex++], () => {}]) as typeof React.useState,
    });
    const context = Provider({ children: null }).props.value;
    const readable = role === 'admin';
    assert.equal(context.hasAccess('/presentations'), readable, role);
    assert.equal(context.hasAccess('/presentations/501'), readable, role);
    assert.equal(context.canAccessEvent(42), true, role);
    assert.equal(context.canAccessEvent(99), role === 'admin', role);
    assert.deepEqual(Array.from(context.getAccessibleEventIds()), role === 'admin' ? [] : [42]);
    const { Sidebar: Menu } = componentModule<{ Sidebar: typeof Sidebar }>('src/components/layout/Sidebar.tsx', {
      useState: (() => [[], () => {}]) as typeof React.useState,
    }, context);
    const hrefs: string[] = [];
    const visit = (node: unknown): void => {
      if (Array.isArray(node)) return node.forEach(visit);
      if (!React.isValidElement<{ href?: string; children?: unknown }>(node)) return;
      if (node.props.href) hrefs.push(node.props.href);
      visit(node.props.children);
    };
    visit(Menu({}));
    assert.equal(hrefs.includes('/presentations'), readable, role);
    if (role === 'organizer' || role === 'reviewer') {
      assert.equal(hrefs.includes('/abstracts'), true, role);
      assert.equal(hrefs.includes('/abstract-categories'), false, role);
    }
    if (role === 'admin' || role === 'organizer' || role === 'reviewer') {
      const redirects: string[] = [];
      const { AuthGuard: Guard } = componentModule<{ AuthGuard: (props: { children: React.ReactNode }) => React.ReactElement | null }>('src/components/auth/AuthGuard.tsx', {
        useEffect: ((effect: () => unknown) => { effect(); }) as typeof React.useEffect,
      }, context, { 'next/navigation': { usePathname: () => '/presentations/501', useRouter: () => ({ replace: (path: string) => redirects.push(path) }) } });
      assert.equal(Guard({ children: React.createElement('div') }) === null, role !== 'admin', role);
      assert.deepEqual(redirects, role === 'admin' ? [] : [role === 'organizer' ? '/members' : '/abstracts']);
    }
  }
});

function nodes(element: unknown): React.ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(element)) return element.flatMap(nodes);
  if (!React.isValidElement<Record<string, unknown>>(element)) return [];
  return [element, ...nodes(element.props.children)];
}

test('real table gates conflict approval, invalid selection and read-only controls', () => {
  const { PresentationTable } = componentModule<{ PresentationTable: (props: Record<string, unknown>) => React.ReactElement }>('src/components/presentations/PresentationTable.tsx', {}, undefined, {
    'next/link': { default: 'a' }, './PresentationHistoryViews': { PresentationComparison, presentationProblemLabel },
  });
  const rows = ['ready', 'alias_pending', 'conflict', 'missing', 'withdrawn'].map((matchState, index) => ({
    sourceKey: `1:${index}`, abstractId: matchState === 'missing' ? null : index + 1, matchState,
    announcement: { trackingId: `ID-${index}`, title: 'Poster work', submitterName: 'Owner', round: 1, presentationType: 'poster' },
    problems: [], progress: 'not_submitted', currentUpload: null, activeRequest: null, lastEmail: null,
    canNotify: matchState === 'ready', submitterEmail: 'same@example.invalid', snapshot: {},
  }));
  const props = { rows, selected: new Set(), onSelect: () => {}, onVerify: () => {}, eventId: 42, closesAt: '2026-10-15T17:00:00.000Z' };
  const managed = nodes(PresentationTable({ ...props, manage: true, view: 'notifications' }));
  const checkboxes = managed.filter(node => node.type === 'input');
  assert.equal(checkboxes.length, 4);
  assert.equal(checkboxes.filter(node => !node.props.disabled).length, 1);
  assert.equal(managed.filter(node => node.type === 'button').length, 1, 'only alias pending can approve');
  const readonly = nodes(PresentationTable({ ...props, manage: false, view: 'verify' }));
  assert.equal(JSON.stringify(readonly).includes('ผลตรวจรายชื่อ'), false);
  assert.equal(JSON.stringify(readonly).includes('Poster / Email'), false);
  assert.equal(JSON.stringify(readonly).includes('ยังไม่แจ้ง'), false);
  assert.equal(readonly.filter(node => node.type === 'input' || node.type === 'button').length, 0);
});

function presentationHarness(file: string, component: string, modules: Record<string, unknown>, auth?: unknown, unwrap = false) {
  const states: unknown[] = [], refs: unknown[] = [], dependencies: unknown[][] = [];
  let stateCursor = 0, refCursor = 0, effectCursor = 0;
  const effects: Array<() => unknown> = [];
  const hooks = {
    useState: (initial: unknown) => { const index = stateCursor++; if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
      return [states[index], (value: unknown) => { states[index] = typeof value === 'function' ? value(states[index]) : value; }]; },
    useMemo: (factory: () => unknown) => factory(),
    useRef: (initial: unknown) => { const index = refCursor++; refs[index] ??= { current: initial }; return refs[index]; },
    useEffect: (effect: () => unknown, deps: unknown[]) => { const index = effectCursor++; if (!dependencies[index] || deps.some((value, i) => value !== dependencies[index][i])) { effects.push(effect); dependencies[index] = deps; } },
  } as unknown as Partial<typeof React>;
  const exported = componentModule<Record<string, (props: Record<string, unknown>) => React.ReactElement>>(file, hooks, auth, modules);
  return { render: (props: Record<string, unknown>) => {
    stateCursor = 0; refCursor = 0; effectCursor = 0;
    const element = exported[component](props);
    if (unwrap) { const child = (element.props as { children: React.ReactElement }).children; return nodes((child.type as (props: unknown) => React.ReactElement)(child.props)); }
    return nodes(element);
  }, effects };
}

function emailHarness(mockApi: unknown) {
  return presentationHarness('src/components/presentations/PresentationEmailDialog.tsx', 'PresentationEmailDialog', {
    '@/lib/api': { api: mockApi, ApiError }, './PresentationDialog': { PresentationDialog: 'dialog' },
  });
}

test('Organizer and Reviewer cannot read the Presentation page or trigger its API reads', async () => {
  for (const role of ['organizer', 'reviewer']) {
    let reads = 0, settingsReads = 0;
    const auth = { user: { role, assignedEvents: [{ id: 42, code: 'PRIS-2026', name: 'PRIS' }] }, token: 'synthetic', isAdmin: false, isLoading: false };
    const harness = presentationHarness('src/app/presentations/page.tsx', 'default', {
      '@/components/layout/AdminLayout': { AdminLayout: 'main' },
      '@/components/common': { Pagination: 'pagination' },
      '@/lib/api': { api: { presentations: {
        list: async (eventId: number, query: URLSearchParams) => {
          reads++; assert.equal(eventId, 42); assert.equal(query.get('received'), 'true'); assert.equal(query.has('matchState'), false);
          return { data: { items: [], counts: {}, total: 0, pageSize: 25, settings: {}, capabilities: { manage: false } } };
        },
        getSettings: async () => { settingsReads++; return { data: {} }; },
      } } },
      '@/lib/presentationUi': { selectablePresentationIds },
      '@/components/presentations/PresentationTable': { PresentationTable: 'presentation-table', progressLabels: {}, matchLabels: {}, mailLabels: {}, thaiTime: (value: string) => value },
      '@/components/presentations/PresentationEmailDialog': { PresentationEmailDialog: 'email-dialog' },
      '@/components/presentations/PresentationManagementDialog': { PresentationManagementDialog: 'management-dialog' },
      '@/components/presentations/PresentationHistoryViews': { PresentationDeadlineHistory: 'deadline-history' },
    }, auth);
    harness.render({}); while (harness.effects.length) harness.effects.shift()!();
    harness.render({}); while (harness.effects.length) harness.effects.shift()!();
    await new Promise(resolve => setImmediate(resolve));
    const rendered = harness.render({});
    assert.ok(JSON.stringify(rendered).includes('ไม่มีสิทธิ์เข้าถึงไฟล์นำเสนอ'));
    assert.equal(settingsReads, 0); assert.equal(reads, 0);
    assert.equal(rendered.some(node => node.type === 'presentation-table' || node.type === 'nav'), false);
  }
});

test('same email yields two sandboxed previews and network-unknown retry keeps identical key and payload', async () => {
  const calls: Array<{ input: unknown; key: string }> = [];
  let queued = 0;
  const preview = { fingerprint: 'a'.repeat(64), messages: [501, 502].map(abstractId => ({ abstractId, recipient: 'same@example.invalid', subject: `Work ${abstractId}`, html: '<p>Body</p>' })) };
  const harness = emailHarness({ presentations: {
    preview: async () => ({ data: preview }), batch: async (_event: number, input: unknown, key: string) => {
      calls.push({ input, key }); if (calls.length === 1) throw new Error('Network outcome unknown');
      return { data: { batchId: 'batch', queued: 2 } };
    },
  } });
  const props = { eventId: 42, token: 'synthetic', kind: 'initial', abstractIds: [501, 502], onClose: () => {}, onQueued: (_id: string, count: number) => { queued = count; } };
  harness.render(props); harness.effects.shift()!(); await new Promise(resolve => setImmediate(resolve));
  let rendered = harness.render(props);
  const frames = rendered.filter(node => node.type === 'iframe');
  assert.equal(frames.length, 2);
  for (const frame of frames) { assert.equal(frame.props.sandbox, ''); assert.equal(frame.props.referrerPolicy, 'no-referrer'); }
  await (rendered.find(node => node.type === 'button' && String(node.props.children).startsWith('ส่ง'))!.props.onClick as () => Promise<void>)();
  rendered = harness.render(props);
  assert.equal(rendered.find(node => node.type === 'button' && String(node.props.children).startsWith('ส่ง'))!.props.disabled, false);
  await (rendered.find(node => node.type === 'button' && String(node.props.children).startsWith('ส่ง'))!.props.onClick as () => Promise<void>)();
  assert.deepEqual(calls[0], calls[1]); assert.equal(queued, 2);
});

test('stale preview disables send, refreshes preview and requires another review with a fresh operation key', async () => {
  const keys: string[] = []; let previewCount = 0;
  const harness = emailHarness({ presentations: {
    preview: async () => ({ data: { fingerprint: String(++previewCount).repeat(64), messages: [{ abstractId: 501, recipient: 'a@example.invalid', subject: 'Work', html: '<p>Body</p>' }] } }),
    batch: async (_event: number, _input: unknown, key: string) => { keys.push(key); if (keys.length === 1) throw new ApiError('Changed', 409, 'PRESENTATION_PREVIEW_STALE'); return { data: { batchId: 'batch', queued: 1 } }; },
  } });
  const props = { eventId: 42, token: 'synthetic', kind: 'reminder', abstractIds: [501], onClose: () => {}, onQueued: () => {} };
  harness.render(props); harness.effects.shift()!(); await new Promise(resolve => setImmediate(resolve));
  let rendered = harness.render(props);
  await (rendered.find(node => node.type === 'button' && String(node.props.children).startsWith('ส่ง'))!.props.onClick as () => Promise<void>)();
  rendered = harness.render(props);
  assert.equal(rendered.find(node => node.type === 'button' && String(node.props.children).startsWith('ส่ง'))!.props.disabled, true);
  harness.effects.shift()!(); await new Promise(resolve => setImmediate(resolve)); rendered = harness.render(props);
  await (rendered.find(node => node.type === 'button' && String(node.props.children).startsWith('ส่ง'))!.props.onClick as () => Promise<void>)();
  assert.equal(previewCount, 2); assert.notEqual(keys[0], keys[1]);
});

test('real deadline input change updates preview and submits the edited Thai date as exclusive UTC', async () => {
  const states: unknown[] = [], refs: unknown[] = [];
  let stateCursor = 0, refCursor = 0;
  const submitted: unknown[] = [];
  const hooks = {
    useState: (initial: unknown) => { const index = stateCursor++; if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
      return [states[index], (value: unknown) => { states[index] = typeof value === 'function' ? value(states[index]) : value; }]; },
    useMemo: (factory: () => unknown) => factory(),
    useRef: (initial: unknown) => { const index = refCursor++; refs[index] ??= { current: initial }; return refs[index]; },
  } as unknown as Partial<typeof React>;
  const { PresentationManagementDialog } = componentModule<{ PresentationManagementDialog: (props: Record<string, unknown>) => React.ReactElement }>('src/components/presentations/PresentationManagementDialog.tsx', hooks, undefined, {
    '@/lib/api': { api: { presentations: { settings: async (_event: number, input: unknown) => { submitted.push(input); } } }, ApiError },
    '@/lib/presentationUi': { deadlineInputToClose, thaiDeadlineInput },
    './PresentationDialog': { PresentationDialog: 'dialog' }, './PresentationHistoryViews': { PresentationComparison },
    './PresentationTable': { thaiTime: (value: string) => value },
  });
  const props = { eventId: 42, token: 'synthetic', settings: { closesAt: '2026-10-15T17:00:00.000Z', version: 4 }, onClose: () => {}, onSaved: () => {} };
  const render = () => { stateCursor = 0; refCursor = 0; return nodes(PresentationManagementDialog(props)); };
  let rendered = render();
  const input = rendered.find(node => node.type === 'input' && node.props.type === 'datetime-local')!;
  assert.equal(input.props.value, '2026-10-15T23:59:59');
  (input.props.onChange as (event: unknown) => void)({ target: { value: '2026-10-18T23:59:59' } });
  (rendered.find(node => node.type === 'textarea')!.props.onChange as (event: unknown) => void)({ target: { value: 'Synthetic edited deadline' } });
  rendered = render();
  assert.equal(rendered.find(node => node.type === 'input')!.props.value, '2026-10-18T23:59:59');
  assert.ok(rendered.some(node => node.type === 'p' && JSON.stringify(node.props.children).includes('2026-10-18 23:59:59')), 'new deadline preview follows the real input handler');
  await (rendered.find(node => node.type === 'form')!.props.onSubmit as (event: unknown) => Promise<void>)({ preventDefault() {} });
  assert.deepEqual(JSON.parse(JSON.stringify(submitted)), [{ closesAt: '2026-10-18T17:00:00.000Z', version: 4, reason: 'Synthetic edited deadline' }]);
});

test('detail route IDs and lifecycle gates use server effective request statuses and preserve exact file bindings', () => {
  for (const value of ['0', '-1', '1.5', '1e3', ' 42', '42 ', '01', '2147483648', '', null, undefined, ['42', '43']]) assert.equal(presentationRouteId(value), null);
  assert.equal(presentationRouteId('42'), 42); assert.equal(presentationRouteId('2147483647'), 2147483647);
  const requests = ['expired', 'cancelled', 'submitted', 'open'].map((status, index) => ({ id: `request-${index}`, status, closesAt: '2000-01-01T00:00:00.000Z' } as RevisionDto));
  assert.equal(activePresentationRequest(requests)?.id, 'request-3', 'trust the server status rather than the browser clock');
  assert.equal(activePresentationRequest(requests.slice(0, 3)), null);
  const detail = { requests, row: { canNotify: false, currentUpload: { id: 'v1', version: 1 } }, uploads: [{ id: 'v1', revisionRequestId: null }, { id: 'v2', revisionRequestId: 'request-2' }] } as PresentationDetailDto;
  const job = { kind: 'revision', state: 'failed', requestId: 'request-3' } as PresentationDetailDto['emailJobs'][number];
  assert.equal(canResendPresentationJob(job, detail), true);
  for (const request of requests.slice(0, 3)) assert.equal(canResendPresentationJob({ ...job, requestId: request.id }, detail), false);
  for (const state of ['pending', 'sending'] as const) assert.equal(canResendPresentationJob({ ...job, state }, detail), false);
  assert.equal(canResendPresentationJob({ ...job, kind: 'receipt', uploadId: 'v1' }, detail), true, 'historical receipt remains resendable');
  assert.equal(canResendPresentationJob({ ...job, kind: 'receipt', uploadId: 'missing' }, detail), false);
  assert.equal(canResendPresentationJob({ ...job, kind: 'initial' }, detail), false);
  assert.equal(detail.row.currentUpload?.id, 'v1', 'open revision does not erase the old accepted current file');
  assert.deepEqual(detail.uploads.filter(file => file.revisionRequestId === 'request-2').map(file => file.id), ['v2']);
});

test('stored email uses recorded HTML for readers without requesting an Admin preview or exposing send', () => {
  let previews = 0;
  const harness = emailHarness({ presentations: { preview: () => { previews++; throw new Error('Reader must not preview'); } } });
  const props = { eventId: 42, abstractId: 501, token: 'viewer', kind: 'stored', job: { id: 'job', recipient: 'owner@example.invalid', subject: 'Original subject', html: '<p>Recorded body</p>' }, onClose: () => {} };
  harness.render(props); harness.effects.shift()!();
  const rendered = harness.render(props), frame = rendered.find(node => node.type === 'iframe')!;
  assert.equal(frame.props.srcDoc, '<p>Recorded body</p>'); assert.equal(frame.props.sandbox, '');
  assert.equal(rendered.filter(node => node.type === 'button').length, 0); assert.equal(previews, 0);
});

test('unknown mail resend shows an intentional warning and ambiguous retry preserves exact job/fingerprint/key', async () => {
  const calls: Array<{ jobId: string; fingerprint: string; key: string }> = [];
  const previews: unknown[] = [];
  const harness = emailHarness({ presentations: {
    preview: async (_event: number, input: unknown) => { previews.push(input); return { data: { fingerprint: 'b'.repeat(64), messages: [{ abstractId: 501, recipient: 'new-owner@example.invalid', subject: 'Fresh payload', html: '<p>Fresh</p>' }] } }; },
    resend: async (_event: number, jobId: string, fingerprint: string, key: string) => { calls.push({ jobId, fingerprint, key }); if (calls.length === 1) throw new ApiError('Unknown outcome', 503); return { data: { jobId: 'new-job' } }; },
  } });
  let resent = '';
  const props = { eventId: 42, abstractId: 501, token: 'admin', kind: 'resend', job: { id: 'old-job', state: 'unknown' }, onClose: () => {}, onResent: (jobId: string) => { resent = jobId; }, onConflict: () => {} };
  harness.render(props); harness.effects.shift()!(); await new Promise(resolve => setImmediate(resolve));
  let rendered = harness.render(props);
  assert.ok(rendered.some(node => node.props.role === 'alert' && String(node.props.children).includes('อีเมลซ้ำ')));
  const send = () => rendered.find(node => node.type === 'button' && node.props.children === 'ยืนยันส่งซ้ำ 1 อีเมล')!.props.onClick as () => Promise<void>;
  await send()(); rendered = harness.render(props); assert.equal(rendered.find(node => node.type === 'dialog')!.props.busy, true); await send()();
  assert.deepEqual(calls[0], calls[1]); assert.equal(resent, 'new-job');
  assert.deepEqual(JSON.parse(JSON.stringify(previews)), [{ kind: 'resend', jobId: 'old-job' }]);
});

function revisionHarness(presentations: unknown) {
  return presentationHarness('src/components/presentations/PresentationRevisionDialog.tsx', 'PresentationRevisionDialog', {
    '@/lib/api': { api: { presentations }, ApiError }, '@/lib/presentationUi': { deadlineInputToClose },
    './PresentationDialog': { PresentationDialog: 'dialog' }, './PresentationTable': { thaiTime: (value: string) => value },
  });
}

function changeNode(rendered: ReturnType<typeof nodes>, type: string, value: string) {
  (rendered.find(node => node.type === type)!.props.onChange as (event: unknown) => void)({ target: { value } });
}

test('revision edits invalidate preview and creation binds the proposed server request ID and freezes ambiguous retries', async () => {
  const calls: Array<{ input: unknown; key: string }> = [];
  const preview = { fingerprint: 'c'.repeat(64), requestId: 'proposed-request', closesAt: '2026-10-20T17:00:00.000Z', messages: [{ abstractId: 501, recipient: 'owner@example.invalid', subject: 'Revision', html: '<p>Revision</p>' }] };
  const harness = revisionHarness({ preview: async () => ({ data: preview }), createRevision: async (_event: number, _abstract: number, input: unknown, key: string) => {
    calls.push({ input, key }); if (calls.length === 1) throw new ApiError('Ambiguous creation', 503);
    return { data: { request: { id: 'proposed-request', status: 'open' }, emailJobId: 'job' } };
  } });
  const props = { eventId: 42, abstractId: 501, token: 'admin', onClose: () => {}, onCreated: () => {}, onConflict: () => {} };
  let rendered = harness.render(props); changeNode(rendered, 'textarea', 'Fix the legend'); changeNode(rendered, 'input', '2026-10-20T23:59:59'); rendered = harness.render(props);
  const review = () => (rendered.find(node => node.type === 'form')!.props.onSubmit as (event: unknown) => Promise<void>)({ preventDefault() {} });
  await review(); rendered = harness.render(props); assert.equal(rendered.filter(node => node.type === 'iframe').length, 1);
  changeNode(rendered, 'textarea', 'Fix the figure'); rendered = harness.render(props); assert.equal(rendered.filter(node => node.type === 'iframe').length, 0);
  await review(); rendered = harness.render(props);
  const confirm = () => rendered.find(node => node.type === 'button' && node.props.children === 'ยืนยันสร้างคำขอและงานอีเมล')!.props.onClick as () => Promise<void>;
  await confirm()(); rendered = harness.render(props);
  assert.equal(rendered.find(node => node.type === 'textarea')!.props.disabled, true); assert.equal(rendered.find(node => node.type === 'input')!.props.disabled, true);
  assert.equal(rendered.find(node => node.type === 'dialog')!.props.busy, true, 'unknown operation cannot discard its key by closing');
  changeNode(rendered, 'textarea', 'Must not change during unknown outcome'); rendered = harness.render(props);
  await confirm()(); assert.deepEqual(calls[0], calls[1]);
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0].input)), { requestId: 'proposed-request', details: 'Fix the figure', closesAt: preview.closesAt, previewFingerprint: preview.fingerprint });
});

test('stale revision preview refetches proposed request and requires explicit second confirmation with a new key', async () => {
  let previews = 0; const calls: Array<{ input: unknown; key: string }> = [];
  const harness = revisionHarness({ preview: async () => ({ data: { fingerprint: 'd'.repeat(64), requestId: `request-${++previews}`, closesAt: '2026-10-20T17:00:00.000Z', messages: [] } }),
    createRevision: async (_event: number, _abstract: number, input: unknown, key: string) => { calls.push({ input, key }); if (calls.length === 1) throw new ApiError('Stale', 409, 'PRESENTATION_PREVIEW_STALE'); return { data: { request: { status: 'open' } } }; },
  });
  const props = { eventId: 42, abstractId: 501, token: 'admin', onClose: () => {}, onCreated: () => {}, onConflict: () => {} };
  let rendered = harness.render(props); changeNode(rendered, 'textarea', 'Fix caption'); changeNode(rendered, 'input', '2026-10-20T23:59:59'); rendered = harness.render(props);
  await (rendered.find(node => node.type === 'form')!.props.onSubmit as (event: unknown) => Promise<void>)({ preventDefault() {} }); rendered = harness.render(props);
  const confirm = () => rendered.find(node => node.type === 'button' && node.props.children === 'ยืนยันสร้างคำขอและงานอีเมล')!.props.onClick as () => Promise<void>;
  await confirm()(); rendered = harness.render(props); assert.equal(previews, 2); assert.equal(calls.length, 1);
  await confirm()(); assert.notEqual(calls[0].key, calls[1].key);
  assert.equal((calls[0].input as { requestId: string }).requestId, 'request-1'); assert.equal((calls[1].input as { requestId: string }).requestId, 'request-2');
});

test('cancel requires a reason and freezes that reason and key after an ambiguous response', async () => {
  const calls: Array<{ id: string; reason: string; key: string }> = [];
  const harness = revisionHarness({ cancelRevision: async (_event: number, id: string, reason: string, key: string) => { calls.push({ id, reason, key }); if (calls.length === 1) throw new ApiError('Unknown cancellation', 503); return { data: { id, status: 'cancelled' } }; } });
  const props = { eventId: 42, abstractId: 501, token: 'admin', request: { id: 'open-request', status: 'open', details: 'Immutable terms', closesAt: '2026-10-20T17:00:00.000Z' }, onClose: () => {}, onCreated: () => {}, onConflict: () => {} };
  let rendered = harness.render(props); assert.equal(rendered.find(node => node.type === 'button')!.props.disabled, true);
  changeNode(rendered, 'textarea', 'Replace the request'); rendered = harness.render(props);
  const cancel = () => (rendered.find(node => node.type === 'form')!.props.onSubmit as (event: unknown) => Promise<void>)({ preventDefault() {} });
  await cancel(); rendered = harness.render(props); assert.equal(rendered.find(node => node.type === 'textarea')!.props.disabled, true);
  changeNode(rendered, 'textarea', 'Different reason'); rendered = harness.render(props); await cancel();
  assert.deepEqual(calls[0], calls[1]); assert.equal(calls[0].reason, 'Replace the request');
});

function detailHarness(auth: unknown, route: { abstractId: string; eventId: string }, detail: (eventId: number, abstractId: number) => Promise<unknown>) {
  return presentationHarness('src/app/presentations/[abstractId]/page.tsx', 'default', {
    'next/navigation': { useParams: () => ({ abstractId: route.abstractId }), useSearchParams: () => new URLSearchParams({ eventId: route.eventId }) },
    'next/link': { default: 'a' }, '@/components/layout/AdminLayout': { AdminLayout: 'main' },
    '@/lib/api': { api: { presentations: { detail } } }, '@/lib/presentationUi': { activePresentationRequest, canResendPresentationJob, isPresentationActionAudit, presentationAuditSummary, presentationRouteId },
    '@/components/presentations/PresentationDialog': { PresentationDialog: 'dialog' },
    '@/components/presentations/PresentationHistoryViews': { PresentationComparison, PresentationEmailAttempts, presentationProblemLabel },
    '@/components/presentations/PresentationEmailDialog': { PresentationEmailDialog: 'email-dialog' },
    '@/components/presentations/PresentationRevisionDialog': { PresentationRevisionDialog: 'revision-dialog' },
    '@/components/presentations/PresentationTable': { progressLabels: { revision_pending: 'Revision pending' }, progressColors: { revision_pending: 'bg-amber-100 text-amber-800' }, matchLabels: { ready: 'Ready' }, mailLabels: { failed: 'Failed', unknown: 'Unknown' }, thaiTime: (value: string) => value },
  }, auth, true);
}

function detailFixture(title = 'Synthetic detail'): PresentationDetailDto {
  const upload = { id: 'v1', version: 1, fileName: 'original.pdf', mimeType: 'application/pdf', sizeBytes: 100, storedFileName: 'original.pdf', storageProvider: 'r2', driveFileId: null, fileUrl: 'http://127.0.0.1:53018/fixture.pdf', receivedAt: '2026-10-07T00:00:00.000Z', revisionRequestId: null } as const;
  const request = { id: 'request-open', status: 'open', requestedBy: 1, details: 'Fix legend', closesAt: '2026-10-20T17:00:00.000Z', createdAt: '2026-10-07T00:00:00.000Z', submittedAt: null, cancelledAt: null, cancelledBy: null, cancellationReason: null } as const;
  return { row: { abstractId: 501, announcement: { title, trackingId: 'PRIS-501', round: 1, presentationType: 'poster', submitterName: 'Owner' }, problems: [], snapshot: {}, matchState: 'ready', progress: 'revision_pending', currentUpload: upload, canNotify: false, submitterEmail: 'owner@example.invalid', verifiedBy: null, verifiedAt: null, verificationReason: null },
    uploads: [upload], requests: [request], emailJobs: [{ id: 'job-1', kind: 'revision', state: 'unknown', recipient: 'owner@example.invalid', subject: 'Stored', html: '<p>Body</p>', createdAt: '2026-10-07T00:00:00.000Z', finishedAt: null, triggeredBy: 1, parentJobId: null, requestId: request.id, uploadId: null, errorCode: null, attempts: [] }], audit: [], capabilities: { read: true, manage: true },
  } as unknown as PresentationDetailDto;
}

test('real detail page restricts viewer controls, invalid IDs and unassigned event reads', async () => {
  for (const role of ['admin', 'organizer', 'reviewer']) {
    let reads = 0;
    const auth = { user: { role, assignedEvents: [{ id: 42, code: 'PRIS-2026' }] }, token: 'synthetic', isAdmin: role === 'admin', isLoading: false };
    const harness = detailHarness(auth, { abstractId: '501', eventId: '42' }, async (eventId, abstractId) => { reads++; assert.equal(eventId, 42); assert.equal(abstractId, 501); const detail = detailFixture(); detail.audit = [{ action: 'match_changed' }, { action: 'alias_verified' }, { action: 'revision_created' }, { action: 'revision_cancelled' }]; return { data: detail }; });
    harness.render({}); harness.effects.shift()!(); await new Promise(resolve => setImmediate(resolve));
    const rendered = harness.render({}), buttons = rendered.filter(node => node.type === 'button');
    assert.equal(buttons.some(node => node.props.children === 'ยกเลิกคำขอ'), role === 'admin');
    assert.equal(buttons.some(node => node.props.children === 'ตรวจและส่งซ้ำ'), role === 'admin');
    assert.equal(buttons.some(node => node.props.children === 'ดูอีเมลที่บันทึกไว้'), role === 'admin');
    assert.equal(JSON.stringify(rendered).includes('ประกาศ / ฐานข้อมูล / ผลตรวจ'), role === 'admin');
    assert.equal(JSON.stringify(rendered).includes('รับรองโดย'), role === 'admin');
    assert.equal(JSON.stringify(rendered).includes('ประวัติอีเมล'), role === 'admin');
    assert.equal(JSON.stringify(rendered).includes('ตรวจข้อมูลประกาศ'), role === 'admin');
    assert.equal(JSON.stringify(rendered).includes('รับรองรหัสเดิม'), role === 'admin');
    assert.equal(JSON.stringify(rendered).includes('สร้างคำขอแก้ไข'), role === 'admin');
    assert.equal(JSON.stringify(rendered).includes('ยกเลิกคำขอแก้ไข'), role === 'admin');
    assert.equal(reads, role === 'admin' ? 1 : 0);
    if (role === 'admin') assert.equal(rendered.find(node => node.type === 'iframe')!.props.src, 'http://127.0.0.1:53018/fixture.pdf');
    else {
      assert.equal(rendered.some(node => node.type === 'iframe'), false);
      assert.ok(JSON.stringify(rendered).includes('ไม่มีสิทธิ์ดูไฟล์นำเสนอ'));
    }
  }
  for (const route of [{ abstractId: '-1', eventId: '42' }, { abstractId: '501', eventId: '1e2' }, { abstractId: '501', eventId: '99' }]) {
    let reads = 0;
    const harness = detailHarness({ user: { role: 'reviewer', assignedEvents: [{ id: 42, code: 'PRIS-2026' }] }, token: 'synthetic', isAdmin: false, isLoading: false }, route, async () => { reads++; return { data: detailFixture() }; });
    const rendered = harness.render({}); harness.effects.shift()!();
    assert.equal(reads, 0); assert.ok(rendered.some(node => node.props.role === 'alert'));
  }
});

test('accepted Oral opens its Drive URL without an iframe and retains original history names', async () => {
  const detail = detailFixture();
  detail.row.announcement.presentationType = 'oral';
  const upload = { ...detail.uploads[0], storageProvider: 'drive' as const, driveFileId: 'file-new',
    storedFileName: 'PRIS-O001_original.pdf', fileUrl: 'https://drive.google.com/file/d/file-new/view' };
  detail.row.currentUpload = upload;
  detail.uploads = [upload, { ...upload, id: 'v0', version: 0, driveFileId: 'file-old', fileUrl: 'https://drive.google.com/file/d/file-old/view' }];
  const harness = detailHarness({ user: { role: 'admin', assignedEvents: [{ id: 42, code: 'PRIS-2026' }] }, token: 'synthetic', isAdmin: true, isLoading: false }, { abstractId: '501', eventId: '42' }, async () => ({ data: detail }));
  harness.render({}); harness.effects.shift()!(); await new Promise(resolve => setImmediate(resolve));
  const rendered = harness.render({});
  assert.equal(rendered.filter(node => node.type === 'iframe').length, 0);
  assert.ok(rendered.some(node => node.type === 'a' && node.props.href === upload.fileUrl && node.props.children === 'เปิดไฟล์ Oral ใน Google Drive'));
  assert.ok(rendered.some(node => node.type === 'a' && node.props.href === detail.uploads[1].fileUrl));
  assert.equal(JSON.stringify(rendered).includes(upload.storedFileName), false);
  assert.ok(JSON.stringify(rendered).includes('original.pdf'));
});

test('real detail late responses cannot replace a new scoped work', async () => {
  const route = { abstractId: '501', eventId: '42' };
  const pending: Array<(value: unknown) => void> = [];
  const harness = detailHarness({ user: { role: 'admin' }, token: 'synthetic', isAdmin: true, isLoading: false }, route, async () => new Promise(resolve => pending.push(resolve)));
  harness.render({}); const cleanup = harness.effects.shift()!() as () => void;
  route.abstractId = '502'; cleanup(); harness.render({}); harness.effects.shift()!();
  pending[1]({ data: detailFixture('New work') }); await new Promise(resolve => setImmediate(resolve));
  pending[0]({ data: detailFixture('Old work') }); await new Promise(resolve => setImmediate(resolve));
  const rendered = harness.render({});
  assert.ok(rendered.some(node => node.type === 'h1' && node.props.children === 'New work'));
  assert.equal(rendered.some(node => node.type === 'h1' && node.props.children === 'Old work'), false);
});

test('audit summaries keep work actions readable without recursive technical snapshots', async () => {
  const audit = { action: 'revision_cancelled', actor_id: 9, created_at: '2026-10-07T04:00:00Z', reason: 'แก้ไขคำขอใหม่', before_state: { status: 'open' }, after_state: { status: 'cancelled', nested: { candidates: Array(100).fill({ secretTechnicalField: 'raw snapshot' }) } } };
  const { changes: auditChanges, ...summary } = presentationAuditSummary(audit); assert.equal(auditChanges.length, 1); assert.deepEqual(summary, { action: 'ยกเลิกคำขอแก้ไข', actor: 'ผู้ดูแล #9', createdAt: audit.created_at, reason: audit.reason, change: 'เปิดรับฉบับแก้ไข → ยกเลิกแล้ว', closesAt: null });
  assert.equal(presentationAuditSummary({ action: 'match_changed', after_state: { match: { state: 'ready' } } }).actor, 'ระบบ');
  const detail = detailFixture(); detail.audit = [audit];
  const harness = detailHarness({ user: { role: 'admin' }, token: 'synthetic', isAdmin: true, isLoading: false }, { abstractId: '501', eventId: '42' }, async () => ({ data: detail }));
  harness.render({}); harness.effects.shift()!(); await new Promise(resolve => setImmediate(resolve));
  const rendered = harness.render({});
  assert.ok(rendered.some(node => node.type === 'h3' && node.props.children === 'ยกเลิกคำขอแก้ไข'));
  const changes = rendered.find(node => node.type === 'details' && nodes(node).some(child => child.type === 'summary' && JSON.stringify(child.props.children).includes('ดูรายละเอียดการเปลี่ยนแปลง')))!;
  assert.equal(changes.props.open, undefined, 'technical details are collapsed by default');
  assert.ok(nodes(changes).some(node => node.type === 'div' && String(node.props.className).includes('max-h-80 space-y-4 overflow-auto')));
  assert.equal(nodes(changes).some(node => node.type === 'dl'), false); assert.equal(JSON.stringify(rendered).includes('secretTechnicalField'), false);
  const sameState = presentationAuditSummary({ action: 'match_changed', before_state: { match: { state: 'ready' } }, after_state: { match: { state: 'ready' } } });
  assert.equal(sameState.change, null, 'same-status field changes remain available in the disclosure');
  const titleChange = presentationAuditSummary({ action: 'match_changed', before_state: { match: { state: 'conflict' }, candidates: [{ title: 'เดิม', firstName: 'ชื่อเดิม', lastName: 'นามสกุล', email: 'private@example.invalid', abstractId: 123 }] }, after_state: { match: { state: 'conflict' }, candidates: [{ title: 'ใหม่', firstName: 'ชื่อใหม่', lastName: 'นามสกุล', email: 'private@example.invalid', abstractId: 123 }] } });
  assert.deepEqual(titleChange.changes.map(field => field.label), ['ชื่อผลงานในฐานข้อมูล', 'ผู้ส่งในฐานข้อมูล']);
  assert.equal(JSON.stringify(titleChange).includes('private@example.invalid'), false);
  assert.equal(presentationAuditSummary({ action: 'unknown', after_state: { fingerprint: 'technical' } }).changes.length, 0);
});

test('shared reconciliation, attempt and deadline views expose business fields without raw snapshot keys', () => {
  assert.deepEqual(['SOURCE_DUPLICATE_ABSTRACT', 'SOURCE_REMAP'].map(presentationProblemLabel), ['หลายรายการประกาศอ้างถึงผลงานเดียวกัน', 'รายการประกาศเปลี่ยนไปอ้างถึงผลงานอื่น ต้องตรวจสอบข้อมูล']);
  const snapshot = { announcement: { trackingId: 'ANN-1', title: 'ชื่อประกาศ', submitterName: 'ผู้ส่ง', presentationType: 'poster', categoryName: 'หมวด' }, candidates: [{ canonicalTrackingId: 'DB-1', title: 'ชื่อฐานข้อมูล', firstName: 'ชื่อ', lastName: 'สกุล', aliases: ['ANN-1'], userId: 99, email: 'private@example.invalid' }, { canonicalTrackingId: 'DB-2', title: 'อีกผลงาน' }], match: { state: 'alias_pending', via: 'alias', fingerprint: 'secret-fingerprint', problems: ['TITLE_MISMATCH'] } };
  const rendered = nodes(PresentationComparison({ value: snapshot }));
  const output = JSON.stringify(rendered);
  assert.ok(output.includes('ข้อมูลในประกาศ') && output.includes('ชื่อฐานข้อมูล') && output.includes('รหัสเดิมของผลงาน'));
  assert.ok(output.includes('ชื่อผลงานไม่ตรงกัน') && output.includes('DB-2'));
  for (const technical of ['canonicalTrackingId', 'fingerprint', 'private@example.invalid', 'userId']) assert.equal(output.includes(technical), false);
  const attempts = JSON.stringify(nodes(PresentationEmailAttempts({ value: [{ id: 'internal-id', claim_token: 'internal-token', result: 'sent', started_at: '2026-10-07T00:00:00Z' }] })));
  assert.ok(attempts.includes('ผู้ให้บริการรับอีเมลแล้ว')); assert.equal(attempts.includes('internal-token'), false);
  assert.ok(JSON.stringify(nodes(PresentationDeadlineHistory({ value: { closesAt: '2026-10-15T17:00:00Z', version: 2, manifestDigest: 'internal-digest' } }))).includes('รุ่น 2'));
  for (const path of ['src/app/presentations/[abstractId]/page.tsx', 'src/components/presentations/PresentationTable.tsx', 'src/components/presentations/PresentationManagementDialog.tsx', 'src/app/presentations/page.tsx']) assert.equal(readFileSync(path, 'utf8').includes('PresentationSnapshot'), false, path);
});
