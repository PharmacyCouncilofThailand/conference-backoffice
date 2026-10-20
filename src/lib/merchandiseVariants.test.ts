import assert from 'node:assert/strict';
import test from 'node:test';
import type { AdminVariantDto } from '@/types/merchandise';
import {
  addOptionValue,
  buildVariantPayload,
  colorImage,
  inferMatrix,
  normalizeOptionValue,
  setCellImage,
  setColorImage,
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
  imageId: partial.imageId ?? null,
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
    { sizeTh: 'S', colorTh: null, enabled: true, price: '250', imageId: null },
    { sizeTh: 'M', colorTh: null, enabled: false, price: '', imageId: null },
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
    cells: [{ sizeTh: 'S', colorTh: 'แดง', enabled: false, price: '290', imageId: null }],
  };
  const synced = syncCells(initial);
  assert.equal(synced.cells.length, 4);
  assert.deepEqual(synced.cells[0], {
    sizeTh: 'S',
    colorTh: 'แดง',
    enabled: false,
    price: '290',
    imageId: null,
  });
  assert.deepEqual(synced.cells[1], {
    sizeTh: 'S',
    colorTh: 'ดำ',
    enabled: true,
    price: '',
    imageId: null,
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
      { sizeTh: 'S', colorTh: null, enabled: true, price: '250', imageId: null },
      { sizeTh: 'M', colorTh: null, enabled: false, price: '', imageId: null },
      { sizeTh: 'L', colorTh: null, enabled: true, price: '', imageId: null },
      { sizeTh: 'XXL', colorTh: null, enabled: false, price: '', imageId: null },
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
        imageId: null,
      },
      {
        id: 'b',
        sizeTh: 'M',
        colorTh: null,
        priceBaht: null,
        saleEnabled: false,
        imageId: null,
      },
      {
        sizeTh: 'L',
        colorTh: null,
        priceBaht: null,
        saleEnabled: true,
        imageId: null,
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
    cells: [{ sizeTh: 'S', colorTh: null, enabled: true, price: '', imageId: null }],
  });
  assert.deepEqual(switched, {
    variants: [
      {
        sizeTh: 'S',
        colorTh: null,
        priceBaht: null,
        saleEnabled: true,
        imageId: null,
      },
    ],
  });

  const badPrice = buildVariantPayload(existing, {
    kind: 'none',
    sizes: [],
    colors: [],
    cells: [{ sizeTh: null, colorTh: null, enabled: true, price: '12.5', imageId: null }],
  });
  assert.deepEqual(badPrice, { error: 'ราคาไม่ถูกต้อง' });
});

test('inferMatrix and buildVariantPayload round-trip imageId', () => {
  const m = inferMatrix([mkVariant({ id: 'a', sizeTh: '46Oz', imageId: 'img1' }), mkVariant({ id: 'b', sizeTh: '32Oz' })]);
  assert.deepEqual(m.cells.map((c) => c.imageId), ['img1', null]);
  const built = buildVariantPayload([], setCellImage(m, '32Oz', null, 'img2'));
  assert.ok('variants' in built);
  assert.deepEqual(built.variants.map((v) => v.imageId), ['img1', 'img2']);
});

test('setColorImage sets every size of that colour', () => {
  const m = syncCells({ kind: 'size_color', sizes: ['S', 'M'], colors: ['ขาว', 'ดำ'], cells: [] });
  const next = setColorImage(m, 'ขาว', 'img1');
  assert.deepEqual(next.cells.filter((c) => c.colorTh === 'ขาว').map((c) => c.imageId), ['img1', 'img1']);
  assert.deepEqual(next.cells.filter((c) => c.colorTh === 'ดำ').map((c) => c.imageId), [null, null]);
  assert.equal(colorImage(next, 'ขาว'), 'img1');
});

test('syncCells: new size cells inherit their colour image', () => {
  const m = setColorImage(syncCells({ kind: 'size_color', sizes: ['S'], colors: ['ขาว'], cells: [] }), 'ขาว', 'img1');
  const grown = syncCells({ ...m, sizes: ['S', 'L'] });
  assert.deepEqual(grown.cells.map((c) => c.imageId), ['img1', 'img1']);
});

test('syncCells: colour image survives kind change', () => {
  const colourOnly = inferMatrix([mkVariant({ id: 'a', colorTh: 'ขาว', imageId: 'img1' })]);
  const both = syncCells({ ...colourOnly, kind: 'size_color', sizes: ['S'] });
  assert.equal(colorImage(both, 'ขาว'), 'img1');
  const back = syncCells({ ...both, kind: 'color' });
  assert.equal(back.cells[0].imageId, 'img1');
});

test('inferMatrix: disagreeing cells of a colour take the first cell image', () => {
  const m = inferMatrix([
    mkVariant({ id: 'a', sizeTh: 'S', colorTh: 'ขาว', imageId: 'img1' }),
    mkVariant({ id: 'b', sizeTh: 'M', colorTh: 'ขาว', imageId: 'img2' }),
  ]);
  assert.deepEqual(m.cells.map((c) => c.imageId), ['img1', 'img1']);
});
