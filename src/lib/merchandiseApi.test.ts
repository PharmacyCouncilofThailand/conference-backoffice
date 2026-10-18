import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiError, downloadAPIFile } from './api';
import { orderFilterQuery } from './merchandiseApi';

test('orderFilterQuery trims values, omits empty fields, and toggles paging', () => {
  assert.equal(
    orderFilterQuery(
      { search: ' PRIS ', paymentStatus: 'paid', page: 2, limit: 20 },
      { paging: false },
    ),
    'search=PRIS&paymentStatus=paid',
  );
  assert.equal(
    orderFilterQuery(
      {
        search: ' PRIS ',
        paymentStatus: 'paid',
        createdFrom: '',
        page: 2,
        limit: 20,
      },
      { paging: true },
    ),
    'search=PRIS&paymentStatus=paid&page=2&limit=20',
  );
  assert.equal(orderFilterQuery({ search: '   ' }, { paging: false }), '');
});

test('downloadAPIFile dispatches unauthorized event on 401 and rejects without saving', async () => {
  const originalWindow = (globalThis as { window?: unknown }).window;
  const fakeWindow = new EventTarget();
  let unauthorizedCount = 0;
  fakeWindow.addEventListener('accp-backoffice-auth:unauthorized', () => {
    unauthorizedCount += 1;
  });
  (globalThis as { window?: unknown }).window = fakeWindow;

  try {
    await assert.rejects(
      () =>
        downloadAPIFile('/x', 't', 'f.xlsx', {
          fetch: async () =>
            new Response(
              JSON.stringify({
                success: false,
                code: 'MERCH_AUTH_REQUIRED',
                error: 'no',
              }),
              { status: 401 },
            ),
          saveBlob: () => assert.fail('must not save'),
        }),
      (err: unknown) => {
        assert.ok(err instanceof ApiError);
        assert.equal(err.status, 401);
        assert.equal(err.code, 'MERCH_AUTH_REQUIRED');
        return true;
      },
    );
    assert.equal(unauthorizedCount, 1);
  } finally {
    if (originalWindow === undefined) {
      delete (globalThis as { window?: unknown }).window;
    } else {
      (globalThis as { window?: unknown }).window = originalWindow;
    }
  }
});

test('downloadAPIFile extracts filename from Content-Disposition and calls saveBlob', async () => {
  let savedName = '';
  let savedText = '';
  await downloadAPIFile('/orders/export.xlsx', 'tok', 'fallback.xlsx', {
    fetch: async () =>
      new Response('xlsx-bytes', {
        status: 200,
        headers: {
          'Content-Disposition':
            'attachment; filename="merch-orders-PRIS2026.xlsx"',
        },
      }),
    saveBlob: async (blob: Blob, filename: string) => {
      savedName = filename;
      savedText = await blob.text();
    },
  });
  assert.equal(savedName, 'merch-orders-PRIS2026.xlsx');
  assert.equal(savedText, 'xlsx-bytes');
});
