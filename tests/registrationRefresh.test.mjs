import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

test('registration refresh keeps results mounted and stops the loading/remount loop', async () => {
  const source = readFileSync(new URL('../src/app/registrations/[id]/page.tsx', import.meta.url), 'utf8');
  const fetchSource = source.slice(source.indexOf('    const fetchRegistration ='), source.indexOf('    const grantSelectedSession ='));
  const loading = [];
  let reads = 0;
  const context = {
    registration: null,
    id: '7',
    attendanceDate: '2026-10-07',
    user: { role: 'admin' },
    getBackofficeToken: () => 'test',
    setIsLoading: (value) => loading.push(value),
    setError: () => {},
    setRegistration: (value) => { context.registration = value; },
    setAttendanceMeta: () => {},
    setGrantHistory: () => {},
    URLSearchParams,
    console: { error: () => {} },
    api: {
      registrations: { get: async () => { reads++; return { registration: { id: 7, sessions: [], invitations: [] } }; } },
      sessionGrants: { list: async () => ({ batches: [] }) },
    },
  };
  const fetchRegistration = runInNewContext(ts.transpile(fetchSource + '\nfetchRegistration;'), context);
  await fetchRegistration();
  assert.deepEqual(loading, [true, false], 'initial load shows the full-page spinner');
  loading.length = 0;
  // Grant completion and the results component's mount callback both refresh.
  await fetchRegistration();
  await fetchRegistration();
  assert.deepEqual(loading, [false, false, false, false], 'refresh must not unmount the results component');
  assert.equal(reads, 3);
  loading.length = 0;
  context.api.registrations.get = async () => { throw new Error('API unavailable'); };
  await fetchRegistration();
  assert.deepEqual(loading, [false, false], 'a failed refresh also clears loading');
});
