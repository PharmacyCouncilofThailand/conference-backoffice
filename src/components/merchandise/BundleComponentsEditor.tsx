'use client';

import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  IconAlertTriangle,
  IconArrowDown,
  IconArrowUp,
  IconLoader2,
  IconPlus,
  IconRefresh,
  IconTrash,
} from '@tabler/icons-react';
import { merchandiseApi } from '@/lib/merchandiseApi';
import { isVersionConflict, merchErrorMessage } from '@/lib/merchandiseErrors';
import { formatBaht } from '@/lib/merchandiseFormat';
import type {
  AdminComponentDto,
  AdminProductDto,
  AdminVariantDto,
  ComponentInput,
} from '@/types/merchandise';
import { useMerchandise } from './MerchandiseContext';

type DraftComponentRow = {
  key: string;
  id?: string;
  componentProductId: string;
  quantityPerBundle: string;
  mode: 'fixed' | 'selectable';
  fixedVariantId: string | null;
  allowedVariantIds: string[];
};

function hasProductOptions(p: AdminProductDto | undefined): boolean {
  if (!p) return false;
  return p.variants.some((v) => v.sizeTh !== null || v.colorTh !== null);
}

function variantLabel(v: AdminVariantDto): string {
  const parts = [v.sizeTh, v.colorTh].filter(Boolean);
  const label = parts.length > 0 ? parts.join(' / ') : 'ตัวเลือกเริ่มต้น';
  const priceText = v.priceBaht !== null ? ` (${formatBaht(v.priceBaht)})` : '';
  const disabledText = !v.saleEnabled ? ' [ปิดขาย]' : '';
  return `${label}${priceText}${disabledText}`;
}

function toDraftRows(
  components: AdminComponentDto[],
  singlesById: Map<string, AdminProductDto>,
): DraftComponentRow[] {
  return components.map((c, idx) => {
    const prod = singlesById.get(c.componentProductId);
    const hasOpts = hasProductOptions(prod);
    const defaultVariantId = prod?.variants[0]?.id ?? null;
    return {
      key: c.id || `row-${idx}`,
      id: c.id,
      componentProductId: c.componentProductId,
      quantityPerBundle: String(c.quantityPerBundle),
      mode: hasOpts ? c.mode : 'fixed',
      fixedVariantId: hasOpts
        ? c.fixedVariantId
        : (c.fixedVariantId ?? defaultVariantId),
      allowedVariantIds: hasOpts ? c.allowedVariantIds : [],
    };
  });
}

export interface BundleComponentsEditorProps {
  product: AdminProductDto;
  singles: AdminProductDto[];
  onSaved(p: AdminProductDto): void;
}

export default function BundleComponentsEditor({
  product,
  singles,
  onSaved,
}: BundleComponentsEditorProps) {
  const { eventId, token } = useMerchandise();
  const singlesById = useMemo(
    () => new Map(singles.map((s) => [s.id, s])),
    [singles],
  );

  const [rows, setRows] = useState<DraftComponentRow[]>(() =>
    toDraftRows(product.components, singlesById),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);

  useEffect(() => {
    setRows(toDraftRows(product.components, singlesById));
    setConflict(false);
    setError('');
  }, [product.id, singlesById]); // eslint-disable-line react-hooks/exhaustive-deps

  function addRow() {
    const first = singles[0];
    if (!first) return;
    const hasOpts = hasProductOptions(first);
    const firstVarId = first.variants[0]?.id ?? null;
    setRows((prev) => [
      ...prev,
      {
        key: `new-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        componentProductId: first.id,
        quantityPerBundle: '1',
        mode: 'fixed',
        fixedVariantId: firstVarId,
        allowedVariantIds: hasOpts && firstVarId ? [firstVarId] : [],
      },
    ]);
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== index));
  }

  function moveRow(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= rows.length) return;
    const next = [...rows];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    setRows(next);
  }

  function handleProductSelect(index: number, nextProductId: string) {
    const prod = singlesById.get(nextProductId);
    const hasOpts = hasProductOptions(prod);
    const firstVarId = prod?.variants[0]?.id ?? null;
    setRows((prev) =>
      prev.map((r, idx) =>
        idx === index
          ? {
              ...r,
              componentProductId: nextProductId,
              mode: 'fixed',
              fixedVariantId: firstVarId,
              allowedVariantIds: hasOpts && firstVarId ? [firstVarId] : [],
            }
          : r,
      ),
    );
  }

  function handleModeChange(index: number, mode: 'fixed' | 'selectable') {
    setRows((prev) =>
      prev.map((r, idx) => {
        if (idx !== index) return r;
        const prod = singlesById.get(r.componentProductId);
        if (!hasProductOptions(prod)) {
          return {
            ...r,
            mode: 'fixed',
            fixedVariantId: prod?.variants[0]?.id ?? null,
            allowedVariantIds: [],
          };
        }
        const firstVarId = prod?.variants[0]?.id ?? null;
        return {
          ...r,
          mode,
          fixedVariantId:
            mode === 'fixed' ? (r.fixedVariantId ?? firstVarId) : null,
          allowedVariantIds:
            mode === 'selectable'
              ? r.allowedVariantIds.length > 0
                ? r.allowedVariantIds
                : firstVarId
                  ? [firstVarId]
                  : []
              : [],
        };
      }),
    );
  }

  function toggleAllowedVariant(index: number, variantId: string) {
    setRows((prev) =>
      prev.map((r, idx) => {
        if (idx !== index) return r;
        const has = r.allowedVariantIds.includes(variantId);
        const nextAllowed = has
          ? r.allowedVariantIds.filter((id) => id !== variantId)
          : [...r.allowedVariantIds, variantId];
        return { ...r, allowedVariantIds: nextAllowed };
      }),
    );
  }

  const standaloneSum = useMemo((): number | null => {
    if (rows.length === 0) return null;
    let total = 0;
    for (const r of rows) {
      const qty = Number(r.quantityPerBundle.trim());
      if (!Number.isSafeInteger(qty) || qty < 1) return null;
      const prod = singlesById.get(r.componentProductId);
      if (!prod) return null;
      const enabledPrices = prod.variants
        .filter((v) => v.saleEnabled)
        .map((v) => v.priceBaht ?? prod.basePriceBaht)
        .filter((p): p is number => p !== null && p > 0);
      if (enabledPrices.length === 0) return null;
      total += Math.min(...enabledPrices) * qty;
    }
    return total;
  }, [rows, singlesById]);

  const hasUnavailableComponent = rows.some((r) => {
    const prod = singlesById.get(r.componentProductId);
    return !prod || !prod.saleEnabled || prod.publishState !== 'published';
  });

  async function handleReloadLatest() {
    setError('');
    setConflict(false);
    try {
      const latest = await merchandiseApi.getProduct(
        eventId,
        product.id,
        token,
      );
      onSaved(latest);
      setRows(toDraftRows(latest.components, singlesById));
    } catch (err) {
      setError(merchErrorMessage(err));
    }
  }

  async function handleSave() {
    setError('');
    setConflict(false);

    const payload: ComponentInput[] = [];
    for (const r of rows) {
      if (!r.componentProductId) {
        setError('กรุณาเลือกสินค้าส่วนประกอบ');
        return;
      }
      const qty = Number(r.quantityPerBundle.trim());
      if (!Number.isSafeInteger(qty) || qty < 1 || qty > 9999) {
        setError('จำนวนต่อชุดต้องเป็นจำนวนเต็ม 1–9,999');
        return;
      }
      const prod = singlesById.get(r.componentProductId);
      const hasOpts = hasProductOptions(prod);
      const effectiveMode = hasOpts ? r.mode : 'fixed';
      const fixedId = hasOpts
        ? r.fixedVariantId
        : (r.fixedVariantId ?? prod?.variants[0]?.id ?? null);

      if (effectiveMode === 'fixed') {
        if (!fixedId) {
          setError('กรุณาเลือกตัวเลือกตายตัวของส่วนประกอบ');
          return;
        }
        payload.push({
          ...(r.id ? { id: r.id } : {}),
          componentProductId: r.componentProductId,
          quantityPerBundle: qty,
          mode: 'fixed',
          fixedVariantId: fixedId,
          allowedVariantIds: [],
        });
      } else {
        if (r.allowedVariantIds.length === 0) {
          setError('กรุณาเลือกตัวเลือกที่อนุญาตให้ลูกค้าเลือกอย่างน้อย 1 ตัว');
          return;
        }
        payload.push({
          ...(r.id ? { id: r.id } : {}),
          componentProductId: r.componentProductId,
          quantityPerBundle: qty,
          mode: 'selectable',
          fixedVariantId: null,
          allowedVariantIds: r.allowedVariantIds,
        });
      }
    }

    setSaving(true);
    try {
      const updated = await merchandiseApi.replaceComponents(
        eventId,
        product.id,
        {
          expectedVersion: product.version,
          components: payload,
        },
        token,
      );
      onSaved(updated);
      setRows(toDraftRows(updated.components, singlesById));
      toast.success('บันทึกส่วนประกอบ Bundle แล้ว');
    } catch (err) {
      const msg = merchErrorMessage(err);
      setError(msg);
      toast.error(msg);
      if (isVersionConflict(err)) {
        setConflict(true);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-zinc-900">ส่วนประกอบ Bundle</h2>
          <p className="mt-1 text-xs text-zinc-500">
            ราคาซื้อแยกรวม:{' '}
            <strong className="text-zinc-900">
              {standaloneSum !== null ? formatBaht(standaloneSum) : '—'}
            </strong>
            {product.basePriceBaht !== null && (
              <> · ราคาชุดปัจจุบัน: {formatBaht(product.basePriceBaht)}</>
            )}
          </p>
        </div>
        <button
          type="button"
          disabled={singles.length === 0}
          onClick={addRow}
          className="btn-secondary min-h-11 gap-2"
        >
          <IconPlus size={18} />
          เพิ่มส่วนประกอบ
        </button>
      </div>

      {hasUnavailableComponent && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-xl bg-amber-50 p-4 text-sm text-amber-900"
        >
          <IconAlertTriangle size={18} className="shrink-0" />
          <span>Bundle นี้จะซื้อไม่ได้จนกว่าส่วนประกอบจะเปิดขาย</span>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-red-50 p-4 text-sm text-red-700"
        >
          <span>{error}</span>
          {conflict && (
            <button
              type="button"
              onClick={() => void handleReloadLatest()}
              className="btn-secondary gap-2"
            >
              <IconRefresh size={16} />
              โหลดข้อมูลล่าสุด
            </button>
          )}
        </div>
      )}

      {singles.length === 0 ? (
        <p className="text-sm text-zinc-500">
          ยังไม่มีสินค้าเดี่ยวในงานนี้ กรุณาสร้างสินค้าเดี่ยวก่อนเพิ่มส่วนประกอบ
        </p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-zinc-500">ยังไม่มีส่วนประกอบในชุดนี้</p>
      ) : (
        <div className="space-y-4">
          {rows.map((row, idx) => {
            const compProduct = singlesById.get(row.componentProductId);
            const hasOpts = hasProductOptions(compProduct);
            const variants = compProduct?.variants ?? [];
            return (
              <div
                key={row.key}
                className="space-y-4 rounded-xl border border-zinc-200 bg-zinc-50/60 p-4"
              >
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <label className="block space-y-1.5">
                    <span className="text-xs font-medium text-zinc-700">
                      สินค้าเดี่ยว
                    </span>
                    <select
                      value={row.componentProductId}
                      onChange={(e) => handleProductSelect(idx, e.target.value)}
                      className="input-field"
                    >
                      {singles.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.nameTh}
                          {s.publishState !== 'published' ? ' (ฉบับร่าง)' : ''}
                          {!s.saleEnabled ? ' (ปิดขาย)' : ''}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block space-y-1.5">
                    <span className="text-xs font-medium text-zinc-700">
                      จำนวนต่อชุด
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={9999}
                      value={row.quantityPerBundle}
                      onChange={(e) =>
                        setRows((prev) =>
                          prev.map((r, i) =>
                            i === idx
                              ? { ...r, quantityPerBundle: e.target.value }
                              : r,
                          ),
                        )
                      }
                      className="input-field"
                    />
                  </label>

                  <label className="block space-y-1.5">
                    <span className="text-xs font-medium text-zinc-700">
                      รูปแบบการเลือกตัวเลือก
                    </span>
                    <select
                      value={hasOpts ? row.mode : 'fixed'}
                      disabled={!hasOpts}
                      onChange={(e) =>
                        handleModeChange(
                          idx,
                          e.target.value as 'fixed' | 'selectable',
                        )
                      }
                      className="input-field"
                    >
                      <option value="fixed">กำหนดตายตัว</option>
                      {hasOpts && (
                        <option value="selectable">ให้ลูกค้าเลือก</option>
                      )}
                    </select>
                  </label>
                </div>

                {!hasOpts ? (
                  <p className="text-xs text-zinc-500">
                    สินค้านี้ไม่มีตัวเลือกไซซ์/สี
                    ระบบใช้ตัวเลือกเริ่มต้นให้อัตโนมัติ
                  </p>
                ) : row.mode === 'fixed' ? (
                  <label className="block max-w-md space-y-1.5">
                    <span className="text-xs font-medium text-zinc-700">
                      ตัวเลือกที่กำหนดตายตัว
                    </span>
                    <select
                      value={row.fixedVariantId ?? ''}
                      onChange={(e) =>
                        setRows((prev) =>
                          prev.map((r, i) =>
                            i === idx
                              ? { ...r, fixedVariantId: e.target.value }
                              : r,
                          ),
                        )
                      }
                      className="input-field"
                    >
                      {variants.map((v) => (
                        <option key={v.id} value={v.id}>
                          {variantLabel(v)}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <div className="space-y-2">
                    <span className="text-xs font-medium text-zinc-700">
                      ตัวเลือกที่อนุญาตให้ลูกค้าเลือก (อย่างน้อย 1 ตัวเลือก)
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {variants.map((v) => (
                        <label
                          key={v.id}
                          className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800"
                        >
                          <input
                            type="checkbox"
                            checked={row.allowedVariantIds.includes(v.id)}
                            onChange={() => toggleAllowedVariant(idx, v.id)}
                            className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
                          />
                          {variantLabel(v)}
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => moveRow(idx, -1)}
                    className="rounded-lg border border-zinc-200 bg-white p-1.5 text-zinc-700 hover:bg-zinc-100 disabled:opacity-40"
                    title="เลื่อนขึ้น"
                  >
                    <IconArrowUp size={16} />
                  </button>
                  <button
                    type="button"
                    disabled={idx === rows.length - 1}
                    onClick={() => moveRow(idx, 1)}
                    className="rounded-lg border border-zinc-200 bg-white p-1.5 text-zinc-700 hover:bg-zinc-100 disabled:opacity-40"
                    title="เลื่อนลง"
                  >
                    <IconArrowDown size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeRow(idx)}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                  >
                    <IconTrash size={14} />
                    ลบแถว
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex justify-end pt-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => void handleSave()}
          className="btn-primary min-h-11 gap-2"
        >
          {saving && <IconLoader2 size={18} className="animate-spin" />}
          บันทึกส่วนประกอบ Bundle
        </button>
      </div>
    </div>
  );
}
