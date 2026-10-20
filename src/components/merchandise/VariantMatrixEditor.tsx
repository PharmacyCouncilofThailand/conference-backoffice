'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  IconArrowLeft,
  IconArrowRight,
  IconLoader2,
  IconPlus,
  IconRefresh,
  IconX,
} from '@tabler/icons-react';
import { merchandiseApi } from '@/lib/merchandiseApi';
import { isVersionConflict, merchErrorMessage } from '@/lib/merchandiseErrors';
import {
  addOptionValue,
  buildVariantPayload,
  inferMatrix,
  syncCells,
  type OptionKind,
  type VariantMatrix,
} from '@/lib/merchandiseVariants';
import type { AdminProductDto } from '@/types/merchandise';
import { useMerchandise } from './MerchandiseContext';

const KIND_OPTIONS: { value: OptionKind; label: string }[] = [
  { value: 'none', label: 'ไม่มีตัวเลือก' },
  { value: 'size', label: 'ไซซ์' },
  { value: 'color', label: 'สี' },
  { value: 'size_color', label: 'ไซซ์ และ สี' },
];

export interface VariantMatrixEditorProps {
  product: AdminProductDto;
  onSaved(p: AdminProductDto): void;
}

export default function VariantMatrixEditor({
  product,
  onSaved,
}: VariantMatrixEditorProps) {
  const { eventId, token } = useMerchandise();
  const [matrix, setMatrix] = useState<VariantMatrix>(() =>
    inferMatrix(product.variants),
  );
  const [sizeInput, setSizeInput] = useState('');
  const [colorInput, setColorInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);

  useEffect(() => {
    setMatrix(inferMatrix(product.variants));
    setConflict(false);
    setError('');
  }, [product.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleKindChange(kind: OptionKind) {
    setError('');
    setMatrix((prev) => syncCells({ ...prev, kind }));
  }

  function addDimensionValue(dim: 'sizes' | 'colors', raw: string) {
    setError('');
    const result = addOptionValue(matrix[dim], raw);
    if ('error' in result) {
      setError(result.error);
      return;
    }
    setMatrix((prev) => syncCells({ ...prev, [dim]: result.values }));
    if (dim === 'sizes') setSizeInput('');
    else setColorInput('');
  }

  function moveDimensionValue(
    dim: 'sizes' | 'colors',
    index: number,
    delta: -1 | 1,
  ) {
    const list = matrix[dim];
    const target = index + delta;
    if (target < 0 || target >= list.length) return;
    const next = [...list];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    setMatrix((prev) => syncCells({ ...prev, [dim]: next }));
  }

  function removeDimensionValue(dim: 'sizes' | 'colors', index: number) {
    const next = matrix[dim].filter((_, idx) => idx !== index);
    setMatrix((prev) => syncCells({ ...prev, [dim]: next }));
  }

  function updateCell(
    sizeTh: string | null,
    colorTh: string | null,
    patch: { enabled?: boolean; price?: string },
  ) {
    setMatrix((prev) => ({
      ...prev,
      cells: prev.cells.map((c) =>
        c.sizeTh === sizeTh && c.colorTh === colorTh ? { ...c, ...patch } : c,
      ),
    }));
  }

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
      setMatrix(inferMatrix(latest.variants));
    } catch (err) {
      setError(merchErrorMessage(err));
    }
  }

  async function handleSave() {
    setError('');
    setConflict(false);
    const built = buildVariantPayload(product.variants, matrix);
    if ('error' in built) {
      setError(built.error);
      toast.error(built.error);
      return;
    }

    setSaving(true);
    try {
      const updated = await merchandiseApi.replaceVariants(
        eventId,
        product.id,
        {
          expectedVersion: product.version,
          variants: built.variants,
        },
        token,
      );
      onSaved(updated);
      setMatrix(inferMatrix(updated.variants));
      toast.success('บันทึกตัวเลือกไซซ์/สีแล้ว');
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

  const pricePlaceholder =
    product.basePriceBaht !== null
      ? `${product.basePriceBaht} (ราคาหลัก)`
      : 'ใช้ราคาหลัก';

  const getCell = (sizeTh: string | null, colorTh: string | null) =>
    matrix.cells.find((c) => c.sizeTh === sizeTh && c.colorTh === colorTh) ?? {
      sizeTh,
      colorTh,
      enabled: true,
      price: '',
      imageId: null,
    };

  return (
    <div className="card space-y-5">
      <div>
        <h2 className="text-lg font-bold text-zinc-900">ตัวเลือกไซซ์/สี</h2>
        <p className="mt-1 text-xs text-zinc-500">
          สินค้าที่ไม่มีตัวเลือกจะไม่แสดงช่องเลือกบนหน้าร้าน · ไม่มีการตัดสต็อก
        </p>
      </div>

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

      <div className="flex flex-wrap gap-3">
        {KIND_OPTIONS.map((opt) => (
          <label
            key={opt.value}
            className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-medium transition ${
              matrix.kind === opt.value
                ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
            }`}
          >
            <input
              type="radio"
              name={`variant-kind-${product.id}`}
              value={opt.value}
              checked={matrix.kind === opt.value}
              onChange={() => handleKindChange(opt.value)}
              className="text-emerald-600 focus:ring-emerald-500"
            />
            {opt.label}
          </label>
        ))}
      </div>

      {(matrix.kind === 'size' || matrix.kind === 'size_color') && (
        <div className="space-y-2 rounded-xl bg-zinc-50 p-4">
          <div className="text-sm font-semibold text-zinc-800">รายการไซซ์</div>
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              maxLength={100}
              value={sizeInput}
              onChange={(e) => setSizeInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addDimensionValue('sizes', sizeInput);
                }
              }}
              placeholder="พิมพ์ไซซ์ เช่น S, M, L แล้วกด Enter"
              className="input-field max-w-xs"
            />
            <button
              type="button"
              onClick={() => addDimensionValue('sizes', sizeInput)}
              className="btn-secondary gap-1"
            >
              <IconPlus size={16} />
              เพิ่มไซซ์
            </button>
          </div>
          {matrix.sizes.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {matrix.sizes.map((size, idx) => (
                <span
                  key={size}
                  className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-semibold text-zinc-800"
                >
                  <span>{size}</span>
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => moveDimensionValue('sizes', idx, -1)}
                    className="text-zinc-500 hover:text-zinc-800 disabled:opacity-30"
                    title="เลื่อนซ้าย"
                  >
                    <IconArrowLeft size={14} />
                  </button>
                  <button
                    type="button"
                    disabled={idx === matrix.sizes.length - 1}
                    onClick={() => moveDimensionValue('sizes', idx, 1)}
                    className="text-zinc-500 hover:text-zinc-800 disabled:opacity-30"
                    title="เลื่อนขวา"
                  >
                    <IconArrowRight size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeDimensionValue('sizes', idx)}
                    className="text-red-500 hover:text-red-700"
                    title="ลบ"
                  >
                    <IconX size={14} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {(matrix.kind === 'color' || matrix.kind === 'size_color') && (
        <div className="space-y-2 rounded-xl bg-zinc-50 p-4">
          <div className="text-sm font-semibold text-zinc-800">รายการสี</div>
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              maxLength={100}
              value={colorInput}
              onChange={(e) => setColorInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addDimensionValue('colors', colorInput);
                }
              }}
              placeholder="พิมพ์สี เช่น ขาว, ดำ แล้วกด Enter"
              className="input-field max-w-xs"
            />
            <button
              type="button"
              onClick={() => addDimensionValue('colors', colorInput)}
              className="btn-secondary gap-1"
            >
              <IconPlus size={16} />
              เพิ่มสี
            </button>
          </div>
          {matrix.colors.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {matrix.colors.map((color, idx) => (
                <span
                  key={color}
                  className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-semibold text-zinc-800"
                >
                  <span>{color}</span>
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => moveDimensionValue('colors', idx, -1)}
                    className="text-zinc-500 hover:text-zinc-800 disabled:opacity-30"
                    title="เลื่อนซ้าย"
                  >
                    <IconArrowLeft size={14} />
                  </button>
                  <button
                    type="button"
                    disabled={idx === matrix.colors.length - 1}
                    onClick={() => moveDimensionValue('colors', idx, 1)}
                    className="text-zinc-500 hover:text-zinc-800 disabled:opacity-30"
                    title="เลื่อนขวา"
                  >
                    <IconArrowRight size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeDimensionValue('colors', idx)}
                    className="text-red-500 hover:text-red-700"
                    title="ลบ"
                  >
                    <IconX size={14} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {matrix.kind === 'none' && (
        <div className="rounded-xl border border-zinc-200 p-4">
          {(() => {
            const cell = getCell(null, null);
            return (
              <div className="flex flex-wrap items-center gap-4">
                <label className="inline-flex items-center gap-2 text-sm font-medium text-zinc-800">
                  <input
                    type="checkbox"
                    checked={cell.enabled}
                    onChange={(e) =>
                      updateCell(null, null, { enabled: e.target.checked })
                    }
                    className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  เปิดขายตัวเลือกเริ่มต้น
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <span className="text-zinc-600">ราคาเฉพาะ (บาท):</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={cell.price}
                    onChange={(e) =>
                      updateCell(null, null, { price: e.target.value })
                    }
                    placeholder={pricePlaceholder}
                    className="input-field max-w-[180px]"
                  />
                </label>
              </div>
            );
          })()}
        </div>
      )}

      {(matrix.kind === 'size' || matrix.kind === 'color') && (
        <div className="overflow-x-auto">
          {matrix.cells.length === 0 ? (
            <p className="text-sm text-zinc-500">
              กรุณาเพิ่มค่าตัวเลือกอย่างน้อย 1 รายการ
            </p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>{matrix.kind === 'size' ? 'ไซซ์' : 'สี'}</th>
                  <th>เปิดขาย</th>
                  <th>ราคาเฉพาะ (บาท)</th>
                </tr>
              </thead>
              <tbody>
                {matrix.cells.map((cell) => {
                  const label = cell.sizeTh ?? cell.colorTh ?? '';
                  return (
                    <tr key={label}>
                      <td className="font-medium text-zinc-900">{label}</td>
                      <td>
                        <label className="inline-flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={cell.enabled}
                            onChange={(e) =>
                              updateCell(cell.sizeTh, cell.colorTh, {
                                enabled: e.target.checked,
                              })
                            }
                            className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
                          />
                          <span className="text-xs">เปิดขาย</span>
                        </label>
                      </td>
                      <td>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={cell.price}
                          onChange={(e) =>
                            updateCell(cell.sizeTh, cell.colorTh, {
                              price: e.target.value,
                            })
                          }
                          placeholder={pricePlaceholder}
                          className="input-field max-w-[180px]"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {matrix.kind === 'size_color' && (
        <div className="overflow-x-auto">
          {matrix.sizes.length === 0 || matrix.colors.length === 0 ? (
            <p className="text-sm text-zinc-500">
              กรุณาเพิ่มทั้งไซซ์และสีอย่างน้อยอย่างละ 1 รายการ
            </p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>ไซซ์ \ สี</th>
                  {matrix.colors.map((c) => (
                    <th key={c}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix.sizes.map((s) => (
                  <tr key={s}>
                    <td className="font-medium text-zinc-900">{s}</td>
                    {matrix.colors.map((c) => {
                      const cell = getCell(s, c);
                      return (
                        <td key={`${s}-${c}`}>
                          <div className="space-y-2">
                            <label className="inline-flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={cell.enabled}
                                onChange={(e) =>
                                  updateCell(s, c, {
                                    enabled: e.target.checked,
                                  })
                                }
                                className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
                              />
                              <span className="text-xs">เปิดขาย</span>
                            </label>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={cell.price}
                              onChange={(e) =>
                                updateCell(s, c, { price: e.target.value })
                              }
                              placeholder={pricePlaceholder}
                              className="input-field min-w-[140px]"
                            />
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
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
          บันทึกตัวเลือกไซซ์/สี
        </button>
      </div>
    </div>
  );
}
