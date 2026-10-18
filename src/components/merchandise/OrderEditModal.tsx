'use client';

import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  IconAlertTriangle,
  IconLoader2,
  IconPlus,
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import { merchandiseApi } from '@/lib/merchandiseApi';
import { merchErrorMessage } from '@/lib/merchandiseErrors';
import { formatBaht } from '@/lib/merchandiseFormat';
import {
  buildOrderEditPayload,
  computeEditedTotal,
  SHIPPING_FEE_BAHT,
  type EditLine,
} from '@/lib/merchandiseOrderEdit';
import type {
  AdminOrderDetail,
  AdminProductDto,
  AdminVariantDto,
  Recipient,
} from '@/types/merchandise';
import { useMerchandise } from './MerchandiseContext';

interface OrderEditModalProps {
  order: AdminOrderDetail;
  onSaved: (updated: AdminOrderDetail) => void;
  onClose: () => void;
}

function variantOptionLabel(v: {
  sizeTh: string | null;
  colorTh: string | null;
}): string {
  const parts = [v.sizeTh, v.colorTh].filter(Boolean);
  return parts.length > 0 ? parts.join(' / ') : 'มาตรฐาน (ไม่มีตัวเลือก)';
}

function computeNewLineUnitPrice(
  product: AdminProductDto | undefined,
  variantId: string | null,
  bundleSelections: { componentId: string; variantId: string }[],
): number | null {
  if (!product) return null;
  if (product.kind === 'single') {
    if (!variantId) return null;
    const variant = product.variants.find(
      (v) => v.id === variantId && v.saleEnabled,
    );
    if (!variant) return null;
    return variant.priceBaht ?? product.basePriceBaht;
  }
  const selectableComponents = product.components.filter(
    (c) => c.mode === 'selectable',
  );
  for (const comp of selectableComponents) {
    const sel = bundleSelections.find((s) => s.componentId === comp.id);
    if (
      !sel ||
      !sel.variantId ||
      !comp.allowedVariantIds.includes(sel.variantId)
    ) {
      return null;
    }
  }
  return product.basePriceBaht;
}

export default function OrderEditModal({
  order,
  onSaved,
  onClose,
}: OrderEditModalProps) {
  const { eventId, token } = useMerchandise();

  const [recipient, setRecipient] = useState<Recipient>(() => ({
    fullName: order.recipient.fullName,
    phone: order.recipient.phone,
    addressLine: order.recipient.addressLine,
    subdistrict: order.recipient.subdistrict,
    district: order.recipient.district,
    province: order.recipient.province,
    postalCode: order.recipient.postalCode,
    company: order.recipient.company,
    deliveryNote: order.recipient.deliveryNote,
  }));

  const [lines, setLines] = useState<EditLine[]>(() =>
    order.items.map((item) => ({
      kind: 'source',
      sourceItemId: item.id,
      quantity: item.quantity,
      unitPriceBaht: item.unitPriceBaht,
    })),
  );

  const [reason, setReason] = useState('');
  const [contactConfirmed, setContactConfirmed] = useState(false);
  const [contactNote, setContactNote] = useState('');

  const [products, setProducts] = useState<AdminProductDto[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (!eventId || !token) return;
    const c = new AbortController();
    setLoadingProducts(true);
    merchandiseApi
      .listProducts(eventId, { status: 'published' }, token, c.signal)
      .then((res) => {
        if (!c.signal.aborted) {
          setProducts(res);
        }
      })
      .catch((err) => {
        if (!c.signal.aborted) {
          toast.error(merchErrorMessage(err));
        }
      })
      .finally(() => {
        if (!c.signal.aborted) {
          setLoadingProducts(false);
        }
      });
    return () => c.abort();
  }, [eventId, token]);

  const productsById = useMemo(() => {
    const map = new Map<string, AdminProductDto>();
    for (const p of products) {
      map.set(p.id, p);
    }
    return map;
  }, [products]);

  const sellablePublishedProducts = useMemo(
    () =>
      products.filter((p) => p.publishState === 'published' && p.saleEnabled),
    [products],
  );

  const isPaid =
    order.paymentStatus === 'paid' || order.payment.state === 'paid';
  const editedTotals = useMemo(() => computeEditedTotal(lines), [lines]);

  const validationResult = useMemo(
    () =>
      buildOrderEditPayload(order, {
        recipient,
        lines,
        reason,
        contactConfirmed,
        contactNote,
      }),
    [order, recipient, lines, reason, contactConfirmed, contactNote],
  );

  function updateSourceQuantity(sourceItemId: string, quantity: number) {
    setLines((prev) =>
      prev.map((l) =>
        l.kind === 'source' && l.sourceItemId === sourceItemId
          ? {
              ...l,
              quantity: Number.isNaN(quantity)
                ? 0
                : Math.max(0, Math.min(9999, quantity)),
            }
          : l,
      ),
    );
  }

  function handleAddNewLine() {
    const firstProduct = sellablePublishedProducts[0] ?? products[0];
    if (!firstProduct) return;

    let initialVariantId: string | null = null;
    let initialBundleSelections: { componentId: string; variantId: string }[] =
      [];

    if (firstProduct.kind === 'single') {
      const enabledVariants = firstProduct.variants.filter(
        (v) => v.saleEnabled,
      );
      if (enabledVariants.length === 1) {
        initialVariantId = enabledVariants[0].id;
      }
    } else {
      initialBundleSelections = firstProduct.components
        .filter((c) => c.mode === 'selectable')
        .map((c) => ({
          componentId: c.id,
          variantId: c.allowedVariantIds[0] ?? '',
        }))
        .filter((s) => Boolean(s.variantId));
    }

    const unitPriceBaht = computeNewLineUnitPrice(
      firstProduct,
      initialVariantId,
      initialBundleSelections,
    );

    setLines((prev) => [
      ...prev,
      {
        kind: 'new',
        productId: firstProduct.id,
        variantId: initialVariantId,
        bundleSelections: initialBundleSelections,
        quantity: 1,
        unitPriceBaht,
      },
    ]);
  }

  function updateNewLineProduct(lineIndex: number, productId: string) {
    const product = productsById.get(productId);
    let variantId: string | null = null;
    let bundleSelections: { componentId: string; variantId: string }[] = [];

    if (product?.kind === 'single') {
      const enabled = product.variants.filter((v) => v.saleEnabled);
      if (enabled.length === 1) {
        variantId = enabled[0].id;
      }
    } else if (product?.kind === 'bundle') {
      bundleSelections = product.components
        .filter((c) => c.mode === 'selectable')
        .map((c) => ({
          componentId: c.id,
          variantId: c.allowedVariantIds[0] ?? '',
        }))
        .filter((s) => Boolean(s.variantId));
    }

    const unitPriceBaht = computeNewLineUnitPrice(
      product,
      variantId,
      bundleSelections,
    );

    setLines((prev) =>
      prev.map((l, idx) =>
        idx === lineIndex && l.kind === 'new'
          ? {
              ...l,
              productId,
              variantId,
              bundleSelections,
              unitPriceBaht,
            }
          : l,
      ),
    );
  }

  function updateNewLineVariant(lineIndex: number, variantId: string | null) {
    setLines((prev) =>
      prev.map((l, idx) => {
        if (idx !== lineIndex || l.kind !== 'new') return l;
        const product = productsById.get(l.productId);
        const unitPriceBaht = computeNewLineUnitPrice(
          product,
          variantId,
          l.bundleSelections,
        );
        return {
          ...l,
          variantId,
          unitPriceBaht,
        };
      }),
    );
  }

  function updateNewLineBundleSelection(
    lineIndex: number,
    componentId: string,
    variantId: string,
  ) {
    setLines((prev) =>
      prev.map((l, idx) => {
        if (idx !== lineIndex || l.kind !== 'new') return l;
        const product = productsById.get(l.productId);
        const otherSelections = l.bundleSelections.filter(
          (s) => s.componentId !== componentId,
        );
        const nextSelections = variantId
          ? [...otherSelections, { componentId, variantId }]
          : otherSelections;
        const unitPriceBaht = computeNewLineUnitPrice(
          product,
          null,
          nextSelections,
        );
        return {
          ...l,
          bundleSelections: nextSelections,
          unitPriceBaht,
        };
      }),
    );
  }

  function updateNewLineQuantity(lineIndex: number, quantity: number) {
    setLines((prev) =>
      prev.map((l, idx) =>
        idx === lineIndex && l.kind === 'new'
          ? {
              ...l,
              quantity: Number.isNaN(quantity)
                ? 1
                : Math.max(1, Math.min(9999, quantity)),
            }
          : l,
      ),
    );
  }

  function removeNewLine(lineIndex: number) {
    setLines((prev) => prev.filter((_, idx) => idx !== lineIndex));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if ('error' in validationResult || submitting) return;

    setSubmitting(true);
    setSubmitError('');
    try {
      const updated = await merchandiseApi.editOrder(
        eventId,
        order.id,
        validationResult.payload,
        token,
      );
      toast.success('บันทึกการแก้ไขคำสั่งซื้อเรียบร้อยแล้ว');
      onSaved(updated);
    } catch (err) {
      const msg = merchErrorMessage(err);
      setSubmitError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="card max-h-[90vh] w-full max-w-3xl space-y-5 overflow-y-auto">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-zinc-900">
              แก้ไขคำสั่งซื้อ — {order.orderNumber}
            </h2>
            <p className="text-xs text-zinc-500">
              {isPaid ? 'ออเดอร์ชำระแล้ว' : 'QR ใบถัดไปจะใช้ยอดใหม่'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary p-2"
            aria-label="ปิดหน้าต่าง"
          >
            <IconX size={18} />
          </button>
        </div>

        {isPaid && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
            <IconAlertTriangle
              size={18}
              className="mt-0.5 shrink-0 text-amber-600"
            />
            <span>
              ออเดอร์ชำระแล้ว ยอดรวมต้องเท่าเดิม ส่วนต่างให้จัดการนอกระบบ
            </span>
          </div>
        )}

        {submitError && (
          <div
            role="alert"
            className="rounded-xl bg-red-50 p-3 text-sm text-red-700"
          >
            {submitError}
          </div>
        )}

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6">
          {/* 1. ผู้รับ */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-zinc-900">1. ข้อมูลผู้รับ</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700">
                  ชื่อ–นามสกุล <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  maxLength={200}
                  value={recipient.fullName}
                  onChange={(e) =>
                    setRecipient((r) => ({ ...r, fullName: e.target.value }))
                  }
                  className="input-field"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700">
                  เบอร์โทรศัพท์ <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  maxLength={30}
                  value={recipient.phone}
                  onChange={(e) =>
                    setRecipient((r) => ({ ...r, phone: e.target.value }))
                  }
                  className="input-field"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-zinc-700">
                  ที่อยู่ <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  maxLength={500}
                  value={recipient.addressLine}
                  onChange={(e) =>
                    setRecipient((r) => ({ ...r, addressLine: e.target.value }))
                  }
                  className="input-field"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700">
                  ตำบล/แขวง <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  maxLength={100}
                  value={recipient.subdistrict}
                  onChange={(e) =>
                    setRecipient((r) => ({ ...r, subdistrict: e.target.value }))
                  }
                  className="input-field"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700">
                  อำเภอ/เขต <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  maxLength={100}
                  value={recipient.district}
                  onChange={(e) =>
                    setRecipient((r) => ({ ...r, district: e.target.value }))
                  }
                  className="input-field"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700">
                  จังหวัด <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  maxLength={100}
                  value={recipient.province}
                  onChange={(e) =>
                    setRecipient((r) => ({ ...r, province: e.target.value }))
                  }
                  className="input-field"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700">
                  รหัสไปรษณีย์ (5 หลัก) <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  maxLength={5}
                  value={recipient.postalCode}
                  onChange={(e) =>
                    setRecipient((r) => ({ ...r, postalCode: e.target.value }))
                  }
                  className="input-field"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700">
                  บริษัท (ถ้ามี)
                </label>
                <input
                  type="text"
                  maxLength={200}
                  value={recipient.company ?? ''}
                  onChange={(e) =>
                    setRecipient((r) => ({
                      ...r,
                      company: e.target.value ? e.target.value : null,
                    }))
                  }
                  className="input-field"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700">
                  หมายเหตุจัดส่ง (ถ้ามี)
                </label>
                <input
                  type="text"
                  maxLength={500}
                  value={recipient.deliveryNote ?? ''}
                  onChange={(e) =>
                    setRecipient((r) => ({
                      ...r,
                      deliveryNote: e.target.value ? e.target.value : null,
                    }))
                  }
                  className="input-field"
                />
              </div>
            </div>
          </div>

          {/* 2. รายการสินค้า */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-zinc-900">
                  2. รายการสินค้า
                </h3>
                <p className="text-xs text-zinc-500">
                  รายการเดิมแก้จำนวนได้ (0 = นำออก, ราคาต่อหน่วยคงเดิม) ·
                  รายการใหม่ใช้ราคาจากแค็ตตาล็อกปัจจุบัน
                </p>
              </div>
              <button
                type="button"
                disabled={
                  loadingProducts || sellablePublishedProducts.length === 0
                }
                onClick={handleAddNewLine}
                className="btn-secondary min-h-11 gap-1.5 text-xs"
              >
                <IconPlus size={16} />
                เพิ่มรายการ
              </button>
            </div>

            <div className="space-y-3">
              {lines.map((line, index) => {
                if (line.kind === 'source') {
                  const sourceItem = order.items.find(
                    (i) => i.id === line.sourceItemId,
                  );
                  if (!sourceItem) return null;
                  const optText = [sourceItem.sizeTh, sourceItem.colorTh]
                    .filter(Boolean)
                    .join(' / ');
                  return (
                    <div
                      key={`source-${line.sourceItemId}`}
                      className={`rounded-xl border p-3 ${
                        line.quantity === 0
                          ? 'border-zinc-200 bg-zinc-50 opacity-60'
                          : 'border-zinc-200 bg-white'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="space-y-0.5">
                          <div className="text-sm font-semibold text-zinc-900">
                            {sourceItem.nameTh}
                            {optText ? ` (${optText})` : ''}
                            {line.quantity === 0 && (
                              <span className="ml-2 text-xs font-normal text-red-600">
                                (นำออก)
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-zinc-500">
                            ราคาเดิมต่อหน่วย {formatBaht(line.unitPriceBaht)}
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <label className="text-xs text-zinc-600">
                            จำนวน (0–9999)
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={9999}
                            value={line.quantity}
                            onChange={(e) =>
                              updateSourceQuantity(
                                line.sourceItemId,
                                Number.parseInt(e.target.value, 10),
                              )
                            }
                            className="input-field w-24 text-right"
                          />
                          <div className="w-28 text-right text-sm font-semibold text-zinc-900">
                            {formatBaht(line.unitPriceBaht * line.quantity)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }

                const selectedProduct = productsById.get(line.productId);
                const enabledVariants =
                  selectedProduct?.kind === 'single'
                    ? selectedProduct.variants.filter((v) => v.saleEnabled)
                    : [];

                return (
                  <div
                    key={`new-${index}`}
                    className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/40 p-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <span className="badge badge-info">รายการใหม่</span>
                      <button
                        type="button"
                        onClick={() => removeNewLine(index)}
                        className="btn-danger gap-1 px-2.5 py-1 text-xs"
                      >
                        <IconTrash size={14} />
                        ลบรายการ
                      </button>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div className="sm:col-span-2">
                        <label className="mb-1 block text-xs font-medium text-zinc-700">
                          สินค้า (เผยแพร่แล้ว)
                        </label>
                        <select
                          value={line.productId}
                          onChange={(e) =>
                            updateNewLineProduct(index, e.target.value)
                          }
                          className="input-field"
                        >
                          {sellablePublishedProducts.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.nameTh} (
                              {p.kind === 'bundle' ? 'Bundle' : 'สินค้าเดี่ยว'})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-medium text-zinc-700">
                          จำนวน (1–9999)
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={9999}
                          value={line.quantity}
                          onChange={(e) =>
                            updateNewLineQuantity(
                              index,
                              Number.parseInt(e.target.value, 10),
                            )
                          }
                          className="input-field text-right"
                        />
                      </div>
                    </div>

                    {selectedProduct?.kind === 'single' && (
                      <div>
                        <label className="mb-1 block text-xs font-medium text-zinc-700">
                          ตัวเลือกไซซ์/สี
                        </label>
                        <select
                          value={line.variantId ?? ''}
                          onChange={(e) =>
                            updateNewLineVariant(index, e.target.value || null)
                          }
                          className="input-field"
                        >
                          <option value="">— เลือกตัวเลือก —</option>
                          {enabledVariants.map((v: AdminVariantDto) => {
                            const price =
                              v.priceBaht ?? selectedProduct.basePriceBaht;
                            return (
                              <option key={v.id} value={v.id}>
                                {variantOptionLabel(v)}
                                {price !== null
                                  ? ` — ${formatBaht(price)}`
                                  : ''}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    )}

                    {selectedProduct?.kind === 'bundle' && (
                      <div className="space-y-2 rounded-lg border border-zinc-200 bg-white p-3">
                        <div className="text-xs font-semibold text-zinc-700">
                          ส่วนประกอบ Bundle
                        </div>
                        {selectedProduct.components.map((comp) => {
                          const compProduct = productsById.get(
                            comp.componentProductId,
                          );
                          if (comp.mode === 'fixed') {
                            const fixedVar = compProduct?.variants.find(
                              (v) => v.id === comp.fixedVariantId,
                            );
                            return (
                              <div
                                key={comp.id}
                                className="text-xs text-zinc-600"
                              >
                                •{' '}
                                {compProduct?.nameTh ?? comp.componentProductId}{' '}
                                (
                                {fixedVar
                                  ? variantOptionLabel(fixedVar)
                                  : 'กำหนดตายตัว'}
                                ) × {comp.quantityPerBundle} ต่อชุด
                              </div>
                            );
                          }

                          const currentSel =
                            line.bundleSelections.find(
                              (s) => s.componentId === comp.id,
                            )?.variantId ?? '';
                          const allowedVars = (
                            compProduct?.variants ?? []
                          ).filter(
                            (v) =>
                              comp.allowedVariantIds.includes(v.id) &&
                              v.saleEnabled,
                          );

                          return (
                            <div key={comp.id} className="space-y-1">
                              <label className="block text-xs font-medium text-zinc-700">
                                {compProduct?.nameTh ?? 'ส่วนประกอบ'} (×{' '}
                                {comp.quantityPerBundle} ต่อชุด)
                              </label>
                              <select
                                value={currentSel}
                                onChange={(e) =>
                                  updateNewLineBundleSelection(
                                    index,
                                    comp.id,
                                    e.target.value,
                                  )
                                }
                                className="input-field"
                              >
                                <option value="">— เลือกตัวเลือก —</option>
                                {allowedVars.map((v) => (
                                  <option key={v.id} value={v.id}>
                                    {variantOptionLabel(v)}
                                  </option>
                                ))}
                              </select>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div className="flex items-center justify-between text-xs text-zinc-600">
                      <span>
                        ราคาต่อหน่วย:{' '}
                        {line.unitPriceBaht !== null
                          ? formatBaht(line.unitPriceBaht)
                          : 'กรุณาเลือกตัวเลือกให้ครบ'}
                      </span>
                      <span className="text-sm font-semibold text-zinc-900">
                        รวม:{' '}
                        {line.unitPriceBaht !== null
                          ? formatBaht(line.unitPriceBaht * line.quantity)
                          : '—'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3. สรุปยอด */}
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
            <h3 className="mb-2 text-sm font-bold text-zinc-900">
              3. สรุปยอด (ยอดเดิม vs ยอดใหม่)
            </h3>
            <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
              <div className="space-y-1">
                <div className="text-xs font-semibold text-zinc-500">
                  ยอดเดิม
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-600">ค่าสินค้า</span>
                  <span>{formatBaht(order.amounts.subtotalBaht)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-600">ค่าจัดส่ง</span>
                  <span>{formatBaht(order.amounts.shippingBaht)}</span>
                </div>
                <div className="flex justify-between font-bold text-zinc-900">
                  <span>ยอดรวมเดิม</span>
                  <span>{formatBaht(order.amounts.totalBaht)}</span>
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-xs font-semibold text-zinc-500">
                  ยอดใหม่
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-600">ค่าสินค้า</span>
                  <span>
                    {editedTotals ? formatBaht(editedTotals.subtotalBaht) : '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-600">ค่าจัดส่ง</span>
                  <span>{formatBaht(SHIPPING_FEE_BAHT)}</span>
                </div>
                <div
                  className={`flex justify-between font-bold ${
                    isPaid &&
                    editedTotals &&
                    editedTotals.totalBaht !== order.amounts.totalBaht
                      ? 'text-red-600'
                      : 'text-emerald-700'
                  }`}
                >
                  <span>ยอดรวมใหม่</span>
                  <span>
                    {editedTotals ? formatBaht(editedTotals.totalBaht) : '—'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 4. ออเดอร์ชำระแล้ว: ยืนยันการติดต่อ */}
          {isPaid && (
            <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/50 p-4">
              <h3 className="text-sm font-bold text-zinc-900">
                4. การติดต่อผู้ซื้อ (บังคับสำหรับออเดอร์ที่ชำระแล้ว)
              </h3>
              <label className="flex items-center gap-2 text-sm font-medium text-zinc-800">
                <input
                  type="checkbox"
                  checked={contactConfirmed}
                  onChange={(e) => setContactConfirmed(e.target.checked)}
                />
                ติดต่อผู้ซื้อแล้ว
              </label>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700">
                  บันทึกการติดต่อ (ช่องทาง วันที่ ผล){' '}
                  <span className="text-red-600">*</span>
                </label>
                <textarea
                  rows={2}
                  maxLength={1000}
                  value={contactNote}
                  onChange={(e) => setContactNote(e.target.value)}
                  placeholder="เช่น โทรคุยกับลูกค้าวันที่ 18/10/2026 เวลา 14:00 ลูกค้ายืนยันเปลี่ยนไซซ์"
                  className="input-field"
                />
              </div>
            </div>
          )}

          {/* เหตุผลการแก้ไข */}
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">
              เหตุผลการแก้ไข <span className="text-red-600">*</span>
            </label>
            <textarea
              rows={2}
              maxLength={1000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="ระบุเหตุผลการแก้ไขคำสั่งซื้อ (ไม่เกิน 1,000 ตัวอักษร)"
              className="input-field"
            />
          </div>

          {'error' in validationResult && (
            <div className="rounded-xl bg-amber-50 p-3 text-xs font-medium text-amber-800">
              {validationResult.error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className="btn-secondary min-h-11"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={submitting || 'error' in validationResult}
              className="btn-primary min-h-11 gap-2"
            >
              {submitting && <IconLoader2 size={18} className="animate-spin" />}
              บันทึกการแก้ไข
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
