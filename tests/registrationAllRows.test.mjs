import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../src/app/registrations/page.tsx', import.meta.url), 'utf8');
const helper = source.slice(source.indexOf('async function fetchRegistrationList('), source.indexOf('export default function RegistrationsPage'));
function loader(list) {
  return runInNewContext(ts.transpile(helper + '\nfetchRegistrationList;'), {
    api: { registrations: { list } }, URLSearchParams, Set, Error,
  });
}
const response = (ids, total, totalPages) => ({
  registrations: ids.map(id => ({ id })), pagination: { page: 1, limit: 1000, total, totalPages },
});
const params = () => new URLSearchParams({ page: '1', limit: '1000', eventId: '2', promoCodeId: '9', status: 'confirmed', source: 'free', search: 'name', sessionId: '7' });

test('all rows gathers every API page above the 1000 row cap and preserves filters', async () => {
  const calls = [];
  const fetch = loader(async (token, query) => {
    calls.push(query);
    assert.equal(token, 'token');
    const p = new URLSearchParams(query);
    for (const [key, value] of params()) if (key !== 'page') assert.equal(p.get(key), value);
    return p.get('page') === '1'
      ? response(Array.from({ length: 1000 }, (_, i) => i + 1), 1003, 2)
      : response([1001, 1002, 1003], 1003, 2);
  });
  const original = params();
  const result = await fetch('token', original, true, () => true);
  assert.equal(result.registrations.length, 1003);
  assert.equal(result.registrations[1002].id, 1003);
  assert.equal(result.pagination.totalPages, 1);
  assert.equal(result.pagination.total, 1003);
  assert.equal(calls.length, 2);
  assert.equal(original.get('page'), '1');
});

test('ordinary pagination makes one request and preserves server pagination', async () => {
  let calls = 0;
  const first = response([11, 12], 1003, 101);
  const result = await loader(async () => { calls++; return first; })('token', params(), false, () => true);
  assert.equal(result, first);
  assert.equal(calls, 1);
});

test('empty all rows result is valid and stays on a single page', async () => {
  const result = await loader(async () => response([], 0, 0))('token', params(), true, () => true);
  assert.equal(result.registrations.length, 0);
  assert.equal(result.pagination.totalPages, 1);
});

test('all rows rejects incomplete or duplicate results instead of showing partial data', async () => {
  for (const rows of [[1], [1, 1]]) {
    await assert.rejects(loader(async () => response(rows, 2, 1))('token', params(), true, () => true), /โหลดรายการไม่ครบ/);
  }
});

test('all rows rejects a changed count between pages', async () => {
  let calls = 0;
  await assert.rejects(loader(async () => ++calls === 1 ? response([1], 2, 2) : response([2], 3, 2))('token', params(), true, () => true), /ข้อมูลเปลี่ยนระหว่างโหลด/);
});

test('late response after switching filters cannot return rows or start another page', async () => {
  let current = true;
  let calls = 0;
  const result = await loader(async () => {
    calls++;
    current = false;
    return response([1], 2, 2);
  })('token', params(), true, () => current);
  assert.equal(result, null);
  assert.equal(calls, 1);
});

test('a later page failure rejects the entire all-rows operation', async () => {
  let calls = 0;
  await assert.rejects(loader(async () => {
    if (++calls === 1) return response([1], 2, 2);
    throw new Error('network unavailable');
  })('token', params(), true, () => true), /network unavailable/);
});

test('changing row limit triggers the active registration fetch, including All on page one', () => {
  const tree = ts.createSourceFile('page.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let found = false;
  const visit = node => {
    if (ts.isCallExpression(node) && node.expression.getText(tree) === 'useEffect' && node.arguments[0]?.getText(tree).includes('if (!eventSelected) return;')) {
      const dependencies = node.arguments[1];
      assert.ok(ts.isArrayLiteralExpression(dependencies));
      assert.ok(dependencies.elements.some(element => element.getText(tree) === 'limit'));
      found = true;
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  assert.ok(found);
});


test('leaving the event or unmounting invalidates the active request', () => {
  const start = source.indexOf('    if (!eventSelected) return;');
  const body = source.slice(start, source.indexOf('  }, [', start));
  const requestRef = { current: 4 };
  const cleanup = runInNewContext(ts.transpile('(function () {\n' + body + '\n})();'), {
    eventSelected: true,
    registrationRequestRef: requestRef,
    fetchRegistrations: () => {},
  });
  assert.equal(requestRef.current, 4);
  cleanup();
  assert.equal(requestRef.current, 5);
});
