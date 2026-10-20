'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  IconArrowLeft,
  IconClipboardText,
  IconLoader2,
  IconRefresh,
  IconTruckDelivery,
} from '@tabler/icons-react';
import { ApiError } from '@/lib/api';
import { merchandiseApi } from '@/lib/merchandiseApi';
import { merchErrorMessage } from '@/lib/merchandiseErrors';
import { formatBangkok } from '@/lib/merchandiseFormat';
import {
  applyShipmentDrafts,
  fillCarrierForEmpty,
  parseShipmentPaste,
} from '@/lib/merchandiseShipping';
import type { AdminOrderRow, BulkShipmentRow } from '@/types/merchandise';
import { merchHref, useMerchandise } from './MerchandiseContext';

const CHUNK_SIZE = 500;

interface PasteSummary {
  appliedCount: number;
  unknownOrders: string[];
  incomplete: string[];
  duplicates: string[];
}

export default function BulkShipping() {
  const { eventId, token } = useMerchandise();

  const [orders, setOrders] = useState<AdminOrderRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [drafts, setDrafts] = useState<
    Record<string, { carrier: string; trackingId: string }>
  >({});
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});

  const [pasteText, setPasteText] = useState('');
  const [overwriteExisting, setOverwriteExisting] = useState(false);
  const [pasteSummary, setPasteSummary] = useState<PasteSummary | null>(null);

  const [commonCarrier, setCommonCarrier] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadAllUnshippedPaid = useCallback(
    async (signal?: AbortSignal) => {
      if (!eventId || !token) return;
      setLoading(true);
      setError('');
      try {
        const all: AdminOrderRow[] = [];
        let page = 1;
        let totalPages = 1;
        while (page <= totalPages) {
          const res = await merchandiseApi.listOrders(
            eventId,
            {
              paymentStatus: 'paid',
              shippingStatus: 'not_shipped',
              page,
              limit: 100,
            },
            token,
            signal,
          );
          all.push(...res.items);
          totalPages = Math.max(1, res.pagination.totalPages);
          page += 1;
        }
        all.sort((a, b) => {
          const ta = a.paidAt ? new Date(a.paidAt).getTime() : 0;
          const tb = b.paidAt ? new Date(b.paidAt).getTime() : 0;
          if (ta !== tb) return ta - tb;
          return a.orderNumber.localeCompare(b.orderNumber);
        });

        if (!signal?.aborted) {
          setOrders(all);
          setDrafts((prev) => {
            const next: Record<
              string,
              { carrier: string; trackingId: string }
            > = {};
            for (const row of all) {
              const existing = prev[row.orderNumber];
              next[row.orderNumber] = existing ?? {
                carrier: row.shipping.carrier ?? '',
                trackingId: row.shipping.trackingId ?? '',
              };
            }
            return next;
          });
        }
      } catch (err) {
        if (!signal?.aborted) {
          setError(merchErrorMessage(err));
        }
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [eventId, token],
  );

  useEffect(() => {
    const c = new AbortController();
    void loadAllUnshippedPaid(c.signal);
    return () => c.abort();
  }, [loadAllUnshippedPaid]);

  const knownOrderNumbers = useMemo(
    () => new Set(orders.map((o) => o.orderNumber.toUpperCase())),
    [orders],
  );

  const readyRows = useMemo(() => {
    const list: BulkShipmentRow[] = [];
    for (const order of orders) {
      const d = drafts[order.orderNumber];
      const carrier = d?.carrier.trim() ?? '';
      const trackingId = d?.trackingId.trim() ?? '';
      if (carrier && trackingId) {
        list.push({
          orderId: order.id,
          expectedVersion: order.version,
          carrier,
          trackingId,
        });
      }
    }
    return list;
  }, [orders, drafts]);

  function handleApplyPaste() {
    const parsed = parseShipmentPaste(pasteText, knownOrderNumbers);
    setDrafts((prev) =>
      applyShipmentDrafts(prev, parsed.rows, overwriteExisting),
    );
    setPasteSummary({
      appliedCount: parsed.rows.length,
      unknownOrders: parsed.unknownOrders,
      incomplete: parsed.incomplete,
      duplicates: parsed.duplicates,
    });
  }

  function handleFillCommonCarrier() {
    if (!commonCarrier.trim()) return;
    setDrafts((prev) => fillCarrierForEmpty(prev, commonCarrier));
  }

  function updateField(
    orderNumber: string,
    field: 'carrier' | 'trackingId',
    value: string,
  ) {
    setDrafts((prev) => {
      const current = prev[orderNumber] ?? { carrier: '', trackingId: '' };
      return {
        ...prev,
        [orderNumber]: {
          ...current,
          [field]: value,
        },
      };
    });
  }

  async function handleSubmit() {
    if (readyRows.length === 0 || submitting) return;

    for (const row of readyRows) {
      if (row.carrier.length > 100 || row.trackingId.length > 100) {
        toast.error('บริษัทขนส่งและ Tracking ID ต้องไม่เกิน 100 ตัวอักษร');
        return;
      }
    }

    setSubmitting(true);
    setError('');
    const nextRowErrors: Record<string, string> = {};
    let successCount = 0;

    try {
      for (let i = 0; i < readyRows.length; i += CHUNK_SIZE) {
        const chunk = readyRows.slice(i, i + CHUNK_SIZE);
        const res = await merchandiseApi.bulkShipments(eventId, chunk, token);
        for (const r of res.results) {
          if (r.ok) {
            successCount += 1;
          } else {
            nextRowErrors[r.id] = merchErrorMessage(
              new ApiError(
                r.error || 'เกิดข้อผิดพลาด',
                400,
                r.code ?? undefined,
              ),
            );
          }
        }
      }

      setRowErrors(nextRowErrors);
      if (successCount > 0) {
        toast.success(`บันทึกการจัดส่งแล้ว ${successCount} รายการ`);
      }
      if (Object.keys(nextRowErrors).length > 0) {
        toast.error(
          `บันทึกไม่สำเร็จ ${Object.keys(nextRowErrors).length} รายการ กรุณาตรวจสอบในตาราง`,
        );
      }
      await loadAllUnshippedPaid();
    } catch (err) {
      const msg = merchErrorMessage(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-zinc-900">จัดส่งแบบ Bulk</h1>
            <p className="text-xs text-zinc-500">
              ผู้ซื้อจะได้รับอีเมลแจ้งจัดส่งอัตโนมัติ
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={merchHref('/merchandise/orders', eventId)}
              className="btn-secondary min-h-11 gap-2"
            >
              <IconArrowLeft size={18} />
              กลับรายการคำสั่งซื้อ
            </Link>
            <button
              type="button"
              disabled={submitting || readyRows.length === 0}
              onClick={() => void handleSubmit()}
              className="btn-primary min-h-11 gap-2"
            >
              {submitting ? (
                <IconLoader2 size={18} className="animate-spin" />
              ) : (
                <IconTruckDelivery size={18} />
              )}
              บันทึกการจัดส่ง ({readyRows.length} รายการ)
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-red-50 p-4 text-sm text-red-700"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => void loadAllUnshippedPaid()}
            className="btn-secondary gap-2"
          >
            <IconRefresh size={16} />
            ลองใหม่
          </button>
        </div>
      )}

      {/* วางข้อมูลจาก Excel + เติมขนส่งเดียวกัน */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="card space-y-3 lg:col-span-2">
          <div className="flex items-center gap-2">
            <IconClipboardText size={18} className="text-emerald-700" />
            <h2 className="text-sm font-bold text-zinc-900">
              วางข้อมูลจาก Excel
            </h2>
          </div>
          <p className="text-xs text-zinc-500">
            วางข้อมูลคอลัมน์ <code>เลขออเดอร์, บริษัทขนส่ง, Tracking ID</code>{' '}
            (คั่นด้วย Tab จาก Excel หรือเครื่องหมายจุลภาค)
          </p>
          <textarea
            rows={4}
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder={'PRIS2026-M-000001\tไปรษณีย์ไทย (EMS)\tEF123456789TH'}
            className="input-field font-mono text-xs"
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-xs text-zinc-700">
              <input
                type="checkbox"
                checked={overwriteExisting}
                onChange={(e) => setOverwriteExisting(e.target.checked)}
              />
              เขียนทับค่าที่มีอยู่
            </label>
            <button
              type="button"
              disabled={!pasteText.trim()}
              onClick={handleApplyPaste}
              className="btn-secondary min-h-11 text-xs"
            >
              เติมจากข้อความที่วาง
            </button>
          </div>

          {pasteSummary && (
            <div className="space-y-1.5 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs">
              <div className="font-semibold text-emerald-700">
                เติมแล้ว {pasteSummary.appliedCount} แถว
              </div>
              {pasteSummary.unknownOrders.length > 0 && (
                <div className="text-amber-800">
                  ไม่พบเลขออเดอร์ ({pasteSummary.unknownOrders.length}):{' '}
                  {pasteSummary.unknownOrders.join(', ')}
                </div>
              )}
              {pasteSummary.incomplete.length > 0 && (
                <div className="text-red-700">
                  ข้อมูลไม่ครบ ({pasteSummary.incomplete.length}):{' '}
                  {pasteSummary.incomplete.join(', ')}
                </div>
              )}
              {pasteSummary.duplicates.length > 0 && (
                <div className="text-amber-700">
                  เลขออเดอร์ซ้ำ (ใช้บรรทัดสุดท้าย):{' '}
                  {pasteSummary.duplicates.join(', ')}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="card space-y-3">
          <h2 className="text-sm font-bold text-zinc-900">
            ขนส่งเดียวกันทุกแถว
          </h2>
          <p className="text-xs text-zinc-500">
            เติมชื่อบริษัทขนส่งเฉพาะแถวที่ยังว่างอยู่
            (ไม่เปลี่ยนค่าที่มีอยู่แล้ว และไม่แตะช่อง Tracking ID)
          </p>
          <input
            type="text"
            maxLength={100}
            value={commonCarrier}
            onChange={(e) => setCommonCarrier(e.target.value)}
            placeholder="เช่น ไปรษณีย์ไทย (EMS), Kerry, Flash"
            className="input-field"
          />
          <button
            type="button"
            disabled={!commonCarrier.trim() || orders.length === 0}
            onClick={handleFillCommonCarrier}
            className="btn-secondary min-h-11 w-full"
          >
            เติมบริษัทขนส่งในแถวที่ว่าง
          </button>
        </div>
      </div>

      {/* ตารางรายการรอจัดส่ง */}
      <div className="card overflow-hidden p-0">
        {loading && orders.length === 0 ? (
          <div className="p-6 text-center text-sm text-zinc-500">
            กำลังโหลดรายการคำสั่งซื้อที่ชำระแล้ว...
          </div>
        ) : orders.length === 0 ? (
          <div className="p-6 text-center text-sm text-zinc-500">
            ไม่มีคำสั่งซื้อที่ชำระแล้วและรอการจัดส่ง
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>เลขออเดอร์</th>
                  <th>ผู้ซื้อ</th>
                  <th>รายการ</th>
                  <th>บริษัทขนส่ง</th>
                  <th>Tracking ID</th>
                  <th>สถานะผลล่าสุด</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  const d = drafts[order.orderNumber] ?? {
                    carrier: '',
                    trackingId: '',
                  };
                  const rowErr = rowErrors[order.id];
                  return (
                    <tr key={order.id}>
                      <td className="font-semibold text-emerald-700">
                        <Link
                          href={merchHref(
                            `/merchandise/orders/${order.id}`,
                            eventId,
                          )}
                          className="hover:underline"
                        >
                          {order.orderNumber}
                        </Link>
                        <div className="text-xs font-normal text-zinc-500">
                          ชำระเมื่อ {formatBangkok(order.paidAt)}
                        </div>
                      </td>
                      <td>
                        <div className="font-medium text-zinc-900">
                          {order.buyerName}
                        </div>
                        <div className="text-xs text-zinc-500">
                          {order.buyerEmail}
                        </div>
                      </td>
                      <td className="max-w-xs text-xs text-zinc-700">
                        {order.itemsText}
                      </td>
                      <td className="min-w-[180px]">
                        <input
                          type="text"
                          maxLength={100}
                          value={d.carrier}
                          onChange={(e) =>
                            updateField(
                              order.orderNumber,
                              'carrier',
                              e.target.value,
                            )
                          }
                          placeholder="บริษัทขนส่ง"
                          className="input-field"
                        />
                      </td>
                      <td className="min-w-[200px]">
                        <input
                          type="text"
                          maxLength={100}
                          value={d.trackingId}
                          onChange={(e) =>
                            updateField(
                              order.orderNumber,
                              'trackingId',
                              e.target.value,
                            )
                          }
                          placeholder="Tracking ID"
                          className="input-field font-mono"
                        />
                      </td>
                      <td className="text-xs">
                        {rowErr ? (
                          <span className="font-medium text-red-600">
                            {rowErr}
                          </span>
                        ) : d.carrier.trim() && d.trackingId.trim() ? (
                          <span className="text-emerald-700">พร้อมบันทึก</span>
                        ) : (
                          <span className="text-zinc-400">รอข้อมูล</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
