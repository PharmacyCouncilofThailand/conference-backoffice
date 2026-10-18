import assert from 'node:assert/strict';
import test from 'node:test';
import type { AdminVariantDto } from '@/types/merchandise';
import {
  addOptionValue,
  buildVariantPayload,
  inferMatrix,
  normalizeOptionValue,
  syncCells,
} from './merchandiseVariants';

const mkVariant = (
  partial: Partial<AdminVariantDto> & { id: string },
): AdminVariantDto => ({
  id: partial.id,
  sizeTh: partial.sizeTh ?? null,
  colorTh: partial.colorTh ?? null,
  priceBaht: partial.priceBaht ?? null,
  saleEnabled: partial.saleEnabled ?? true,
  sortOrder: partial.sortOrder ?? 0,
  version: partial.version ?? 1,
});

test('inferMatrix detects option kind and populates sizes, colors, and cells', () => {
  const defaultMatrix = inferMatrix([mkVariant({ id: 'd' })]);
  assert.equal(defaultMatrix.kind, 'none');
  assert.deepEqual(defaultMatrix.sizes, []);
  assert.deepEqual(defaultMatrix.colors, []);
  assert.equal(defaultMatrix.cells.length, 1);

  const sizeMatrix = inferMatrix([
    mkVariant({ id: 'a', sizeTh: 'S', priceBaht: 250 }),
    mkVariant({ id: 'b', sizeTh: 'M', priceBaht: null, saleEnabled: false }),
  ]);
  assert.equal(sizeMatrix.kind, 'size');
  assert.deepEqual(sizeMatrix.sizes, ['S', 'M']);
  assert.deepEqual(sizeMatrix.colors, []);
  assert.deepEqual(sizeMatrix.cells, [
    { sizeTh: 'S', colorTh: null, enabled: true, price: '250' },
    { sizeTh: 'M', colorTh: null, enabled: false, price: '' },
  ]);
});

test('normalizeOptionValue and addOptionValue handle spaces and case-insensitive duplicates', () => {
  assert.equal(normalizeOptionValue('  Extra   Large '), 'Extra Large');
  assert.deepEqual(addOptionValue([], '  Extra   Large '), {
    values: ['Extra Large'],
  });
  assert.deepEqual(addOptionValue(['M'], ' m '), {
    error: 'ค่านี้มีอยู่แล้ว',
  });
  assert.deepEqual(addOptionValue([], '   '), {
    error: 'กรุณากรอกค่า',
  });
  assert.deepEqual(addOptionValue([], 'x'.repeat(101)), {
    error: 'ยาวเกิน 100 ตัวอักษร',
  });
});

test('syncCells builds size×color grid while preserving existing cell state', () => {
  const initial = {
    kind: 'size_color' as const,
    sizes: ['S', 'M'],
    colors: ['แดง', 'ดำ'],
    cells: [{ sizeTh: 'S', colorTh: 'แดง', enabled: false, price: '290' }],
  };
  const synced = syncCells(initial);
  assert.equal(synced.cells.length, 4);
  assert.deepEqual(synced.cells[0], {
    sizeTh: 'S',
    colorTh: 'แดง',
    enabled: false,
    price: '290',
  });
  assert.deepEqual(synced.cells[1], {
    sizeTh: 'S',
    colorTh: 'ดำ',
    enabled: true,
    price: '',
  });
});

test('buildVariantPayload preserves existing ids, omits unticked new cells, and drops removed options', () => {
  const existing = [
    mkVariant({ id: 'a', sizeTh: 'S', priceBaht: 200 }),
    mkVariant({ id: 'b', sizeTh: 'M', priceBaht: null }),
    mkVariant({ id: 'x', sizeTh: 'XL', priceBaht: null }),
  ];
  const matrix = {
    kind: 'size' as const,
    sizes: ['S', 'M', 'L', 'XXL'],
    colors: [],
    cells: [
      { sizeTh: 'S', colorTh: null, enabled: true, price: '250' },
      { sizeTh: 'M', colorTh: null, enabled: false, price: '' },
      { sizeTh: 'L', colorTh: null, enabled: true, price: '' },
      { sizeTh: 'XXL', colorTh: null, enabled: false, price: '' },
    ],
  };
  const result = buildVariantPayload(existing, matrix);
  assert.deepEqual(result, {
    variants: [
      {
        id: 'a',
        sizeTh: 'S',
        colorTh: null,
        priceBaht: 250,
        saleEnabled: true,
      },
      {
        id: 'b',
        sizeTh: 'M',
        colorTh: null,
        priceBaht: null,
        saleEnabled: false,
      },
      {
        sizeTh: 'L',
        colorTh: null,
        priceBaht: null,
        saleEnabled: true,
      },
    ],
  });
});

test('buildVariantPayload drops default variant id when switching from none to size and rejects invalid price', () => {
  const existing = [mkVariant({ id: 'd', sizeTh: null, colorTh: null })];
  const switched = buildVariantPayload(existing, {
    kind: 'size',
    sizes: ['S'],
    colors: [],
    cells: [{ sizeTh: 'S', colorTh: null, enabled: true, price: '' }],
  });
  assert.deepEqual(switched, {
    variants: [
      {
        sizeTh: 'S',
        colorTh: null,
        priceBaht: null,
        saleEnabled: true,
      },
    ],
  });

  const badPrice = buildVariantPayload(existing, {
    kind: 'none',
    sizes: [],
    colors: [],
    cells: [{ sizeTh: null, colorTh: null, enabled: true, price: '12.5' }],
  });
  assert.deepEqual(badPrice, { error: 'ราคาไม่ถูกต้อง' });
});
