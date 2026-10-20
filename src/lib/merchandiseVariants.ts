import { parseBahtInput } from './merchandiseFormat';
import type { AdminVariantDto, VariantInput } from '@/types/merchandise';

export type OptionKind = 'none' | 'size' | 'color' | 'size_color';

export type MatrixCell = {
  sizeTh: string | null;
  colorTh: string | null;
  enabled: boolean;
  price: string;
};

export type VariantMatrix = {
  kind: OptionKind;
  sizes: string[];
  colors: string[];
  cells: MatrixCell[];
};

const cellKey = (sizeTh: string | null, colorTh: string | null): string =>
  `${sizeTh ?? ''}\u0000${colorTh ?? ''}`;

export function normalizeOptionValue(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

export function addOptionValue(
  values: string[],
  raw: string,
): { values: string[] } | { error: string } {
  const normalized = normalizeOptionValue(raw);
  if (normalized === '') {
    return { error: 'กรุณากรอกค่า' };
  }
  if (normalized.length > 100) {
    return { error: 'ยาวเกิน 100 ตัวอักษร' };
  }
  const lower = normalized.toLowerCase();
  if (values.some((v) => normalizeOptionValue(v).toLowerCase() === lower)) {
    return { error: 'ค่านี้มีอยู่แล้ว' };
  }
  return { values: [...values, normalized] };
}

export function inferMatrix(variants: AdminVariantDto[]): VariantMatrix {
  const hasSize = variants.some((v) => v.sizeTh !== null && v.sizeTh !== '');
  const hasColor = variants.some((v) => v.colorTh !== null && v.colorTh !== '');
  const kind: OptionKind =
    hasSize && hasColor
      ? 'size_color'
      : hasSize
        ? 'size'
        : hasColor
          ? 'color'
          : 'none';

  const sizes: string[] = [];
  const colors: string[] = [];
  for (const v of variants) {
    if (v.sizeTh && !sizes.includes(v.sizeTh)) sizes.push(v.sizeTh);
    if (v.colorTh && !colors.includes(v.colorTh)) colors.push(v.colorTh);
  }

  const cells: MatrixCell[] = variants.map((v) => ({
    sizeTh: v.sizeTh,
    colorTh: v.colorTh,
    enabled: v.saleEnabled,
    price: v.priceBaht !== null ? String(v.priceBaht) : '',
  }));

  return syncCells({
    kind,
    sizes: kind === 'size' || kind === 'size_color' ? sizes : [],
    colors: kind === 'color' || kind === 'size_color' ? colors : [],
    cells,
  });
}

export function syncCells(matrix: VariantMatrix): VariantMatrix {
  const byKey = new Map(
    matrix.cells.map((c) => [cellKey(c.sizeTh, c.colorTh), c]),
  );

  const pickCell = (
    sizeTh: string | null,
    colorTh: string | null,
  ): MatrixCell => {
    const existing = byKey.get(cellKey(sizeTh, colorTh));
    return existing
      ? { ...existing, sizeTh, colorTh }
      : { sizeTh, colorTh, enabled: true, price: '' };
  };

  if (matrix.kind === 'none') {
    return {
      kind: 'none',
      sizes: [],
      colors: [],
      cells: [pickCell(null, null)],
    };
  }

  if (matrix.kind === 'size') {
    return {
      kind: 'size',
      sizes: matrix.sizes,
      colors: [],
      cells: matrix.sizes.map((s) => pickCell(s, null)),
    };
  }

  if (matrix.kind === 'color') {
    return {
      kind: 'color',
      sizes: [],
      colors: matrix.colors,
      cells: matrix.colors.map((c) => pickCell(null, c)),
    };
  }

  const cells: MatrixCell[] = [];
  for (const s of matrix.sizes) {
    for (const c of matrix.colors) {
      cells.push(pickCell(s, c));
    }
  }
  return {
    kind: 'size_color',
    sizes: matrix.sizes,
    colors: matrix.colors,
    cells,
  };
}

export function buildVariantPayload(
  existing: AdminVariantDto[],
  matrix: VariantMatrix,
): { variants: VariantInput[] } | { error: string } {
  const synced = syncCells(matrix);
  const existingByKey = new Map(
    existing.map((v) => [cellKey(v.sizeTh, v.colorTh), v]),
  );

  const variants: VariantInput[] = [];
  for (const cell of synced.cells) {
    const old = existingByKey.get(cellKey(cell.sizeTh, cell.colorTh));
    if (!cell.enabled && !old) {
      continue;
    }
    const parsedPrice = parseBahtInput(cell.price);
    if (parsedPrice === 'invalid') {
      return { error: 'ราคาไม่ถูกต้อง' };
    }
    const item: VariantInput = {
      ...(old ? { id: old.id } : {}),
      sizeTh: cell.sizeTh,
      colorTh: cell.colorTh,
      priceBaht: parsedPrice,
      saleEnabled: cell.enabled,
    };
    variants.push(item);
  }

  if (variants.length === 0) {
    return { error: 'ต้องมีตัวเลือกอย่างน้อย 1 รายการ' };
  }

  return { variants };
}
