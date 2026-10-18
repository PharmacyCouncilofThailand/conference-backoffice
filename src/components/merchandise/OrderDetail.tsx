'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  IconArrowLeft,
  IconCreditCard,
  IconLoader2,
  IconMailForward,
  IconPencil,
  IconRefresh,
  IconTruck,
} from '@tabler/icons-react';
import { merchandiseApi } from '@/lib/merchandiseApi';
import { merchErrorMessage } from '@/lib/merchandiseErrors';
import {
  attemptStatusLabel,
  badgeClassForPayment,
  badgeClassForShipping,
  formatBaht,
  formatBangkok,
  notificationStatusLabel,
  notificationTypeLabel,
  paymentStateLabel,
  paymentStatusLabel,
  reviewReasonLabel,
  shippingStatusLabel,
} from '@/lib/merchandiseFormat';
import type { AdminOrderDetail } from '@/types/merchandise';
import { merchHref, useMerchandise } from './MerchandiseContext';
import OrderEditModal from './OrderEditModal';
import ResendNotificationModal from './ResendNotificationModal';
import ShipmentModal from './ShipmentModal';

function formatOptionText(
  sizeTh: string | null,
  colorTh: string | null,
): string {
  const parts = [sizeTh, colorTh].filter(Boolean);
  return parts.length > 0 ? ` (${parts.join(' / ')})` : '';
}

export default function OrderDetail() {
  const { eventId, token } = useMerchandise();
  const params = useParams();
  const orderId = String(params.orderId ?? '');

  const [order, setOrder] = useState<AdminOrderDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [checkingPayment, setCheckingPayment] = useState(false);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [shipmentModalOpen, setShipmentModalOpen] = useState(false);
  const [resendTarget, setResendTarget] = useState<{
    type: 'paid' | 'shipped';
    status: string;
  } | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!eventId || !token || !orderId) return;
      setLoading(true);
      setError('');
      try {
        const detail = await merchandiseApi.getOrder(
          eventId,
          orderId,
          token,
          signal,
        );
        if (!signal?.aborted) {
          setOrder(detail);
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
    [eventId, token, orderId],
  );

  useEffect(() => {
    const c = new AbortController();
    void load(c.signal);
    return () => c.abort();
  }, [load]);

  async function handleCheckPayment() {
    if (!order || checkingPayment) return;
    setCheckingPayment(true);
    setError('');
    try {
      const updated = await merchandiseApi.checkOrderPayment(
        eventId,
        order.id,
        token,
      );
      setOrder(updated);
      toast.success(
        `ผลการตรวจสอบ: ${paymentStateLabel[updated.payment.state] ?? updated.payment.state}`,
      );
    } catch (err) {
      const msg = merchErrorMessage(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setCheckingPayment(false);
    }
  }

  if (loading && !order) {
    return (
      <div className="card text-sm text-zinc-500">
        กำลังโหลดรายละเอียดคำสั่งซื้อ...
      </div>
    );
  }

  if (error && !order) {
    return (
      <div
        role="alert"
        className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-red-50 p-4 text-sm text-red-700"
      >
        <span>{error}</span>
        <button
          type="button"
          onClick={() => void load()}
          className="btn-secondary gap-2"
        >
          <IconRefresh size={16} />
          ลองใหม่
        </button>
      </div>
    );
  }

  if (!order) return null;

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
                {order.orderNumber}
              </h1>
              <span className={badgeClassForPayment(order.paymentStatus)}>
                {paymentStatusLabel[order.paymentStatus]}
              </span>
              <span className={badgeClassForShipping(order.shipping.status)}>
                {shippingStatusLabel[order.shipping.status]}
              </span>
            </div>
            <p className="text-xs text-zinc-500">
              สร้างเมื่อ {formatBangkok(order.createdAt)}
              {order.paidAt && ` · ชำระเมื่อ ${formatBangkok(order.paidAt)}`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={merchHref('/merchandise/orders', eventId)}
              className="btn-secondary min-h-11 gap-2"
            >
              <IconArrowLeft size={18} />
              กลับรายการ
            </Link>
            <button
              type="button"
              disabled={checkingPayment}
              onClick={() => void handleCheckPayment()}
              className="btn-secondary min-h-11 gap-2"
            >
              {checkingPayment ? (
                <IconLoader2 size={18} className="animate-spin" />
              ) : (
                <IconCreditCard size={18} />
              )}
              ตรวจสอบการชำระ
            </button>
            <button
              type="button"
              disabled={
                order.payment.state === 'qr_active' ||
                order.payment.state === 'verifying'
              }
              title={
                order.payment.state === 'qr_active' ||
                order.payment.state === 'verifying'
                  ? 'ออเดอร์นี้มี QR ที่ยังใช้งานได้หรือกำลังตรวจสอบ กรุณารอสักครู่ก่อนแก้ไข'
                  : undefined
              }
              onClick={() => setEditModalOpen(true)}
              className="btn-secondary min-h-11 gap-2"
            >
              <IconPencil size={18} />
              แก้ไขคำสั่งซื้อ
            </button>
            {order.paymentStatus === 'paid' && (
              <button
                type="button"
                onClick={() => setShipmentModalOpen(true)}
                className="btn-primary min-h-11 gap-2"
              >
                <IconTruck size={18} />
                {order.shipping.status === 'shipped'
                  ? 'แก้ไขการจัดส่ง'
                  : 'บันทึกการจัดส่ง'}
              </button>
            )}
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
            onClick={() => void load()}
            className="btn-secondary gap-2"
          >
            <IconRefresh size={16} />
            ลองใหม่
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card space-y-3">
          <h2 className="text-lg font-bold text-zinc-900">ข้อมูลผู้ซื้อ</h2>
          <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-zinc-500">ชื่อ–นามสกุล</dt>
              <dd className="font-medium text-zinc-900">{order.buyer.name}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">อีเมล</dt>
              <dd className="font-medium text-zinc-900">{order.buyer.email}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">เบอร์โทร</dt>
              <dd className="font-medium text-zinc-900">
                {order.buyer.phone || '—'}
              </dd>
            </div>
          </dl>
        </div>

        <div className="card space-y-3">
          <h2 className="text-lg font-bold text-zinc-900">
            ที่อยู่และผู้รับพัสดุ
          </h2>
          <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-zinc-500">ชื่อผู้รับ</dt>
              <dd className="font-medium text-zinc-900">
                {order.recipient.fullName}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">เบอร์โทรผู้รับ</dt>
              <dd className="font-medium text-zinc-900">
                {order.recipient.phone}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-zinc-500">ที่อยู่จัดส่ง</dt>
              <dd className="font-medium text-zinc-900">
                {order.recipient.addressLine} ต.{order.recipient.subdistrict} อ.
                {order.recipient.district} จ.{order.recipient.province}{' '}
                {order.recipient.postalCode}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">บริษัท / หน่วยงาน</dt>
              <dd className="font-medium text-zinc-900">
                {order.recipient.company || '—'}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">หมายเหตุจัดส่ง</dt>
              <dd className="font-medium text-zinc-900">
                {order.recipient.deliveryNote || '—'}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="card space-y-4 overflow-x-auto">
        <h2 className="text-lg font-bold text-zinc-900">รายการสินค้า</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>รายการ</th>
              <th className="text-right">จำนวน</th>
              <th className="text-right">ราคาต่อหน่วย</th>
              <th className="text-right">รวม</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id}>
                <td>
                  <div className="font-semibold text-zinc-900">
                    {item.nameTh}
                    {formatOptionText(item.sizeTh, item.colorTh)}
                  </div>
                  {item.components.length > 0 && (
                    <ul className="mt-1 space-y-0.5 text-xs text-zinc-500">
                      {item.components.map((c, idx) => (
                        <li key={idx}>
                          • {c.nameTh}
                          {formatOptionText(c.sizeTh, c.colorTh)} ×{' '}
                          {c.quantityPerBundle} ต่อชุด
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
                <td className="text-right font-medium text-zinc-900">
                  {item.quantity}
                </td>
                <td className="text-right">{formatBaht(item.unitPriceBaht)}</td>
                <td className="text-right font-semibold text-zinc-900">
                  {formatBaht(item.lineTotalBaht)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="ml-auto max-w-xs space-y-1.5 border-t border-zinc-100 pt-3 text-sm">
          <div className="flex justify-between">
            <span className="text-zinc-500">ค่าสินค้า</span>
            <span className="font-medium text-zinc-900">
              {formatBaht(order.amounts.subtotalBaht)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">ค่าจัดส่ง</span>
            <span className="font-medium text-zinc-900">
              {formatBaht(order.amounts.shippingBaht)}
            </span>
          </div>
          <div className="flex justify-between border-t border-zinc-200 pt-1.5 text-base font-bold text-zinc-900">
            <span>ยอดรวมทั้งสิ้น</span>
            <span className="text-emerald-700">
              {formatBaht(order.amounts.totalBaht)}
            </span>
          </div>
        </div>
      </div>

      <div className="card space-y-4 overflow-x-auto">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-zinc-900">การชำระเงิน</h2>
          <span className="badge badge-info">
            {paymentStateLabel[order.payment.state] ?? order.payment.state}
          </span>
        </div>

        {order.attempts.length === 0 ? (
          <p className="text-sm text-zinc-500">ยังไม่มีประวัติการสร้าง QR</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Provider Order No</th>
                <th>Transaction ID</th>
                <th className="text-right">ยอด</th>
                <th>สถานะ</th>
                <th>ขอเมื่อ</th>
                <th>หมดอายุ</th>
                <th>ชำระเมื่อ</th>
                <th>ตรวจล่าสุด</th>
                <th>การตรวจสอบ</th>
              </tr>
            </thead>
            <tbody>
              {order.attempts.map((a) => (
                <tr key={a.id}>
                  <td className="font-mono text-xs font-semibold text-zinc-900">
                    {a.referenceNo}
                  </td>
                  <td className="font-mono text-xs">
                    {a.providerOrderNo || '—'}
                  </td>
                  <td className="font-mono text-xs">
                    {a.transactionId || '—'}
                  </td>
                  <td className="whitespace-nowrap text-right font-medium text-zinc-900">
                    {formatBaht(a.amountBaht)}
                  </td>
                  <td>
                    <span className="badge badge-info">
                      {attemptStatusLabel[a.status] ?? a.status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap text-xs">
                    {formatBangkok(a.requestedAt)}
                  </td>
                  <td className="whitespace-nowrap text-xs">
                    {a.expiresAt ? formatBangkok(a.expiresAt) : '—'}
                  </td>
                  <td className="whitespace-nowrap text-xs">
                    {a.paidAt ? formatBangkok(a.paidAt) : '—'}
                  </td>
                  <td className="text-xs">
                    {a.lastCheckAt
                      ? `${formatBangkok(a.lastCheckAt)}${
                          a.lastCheckResult ? ` (${a.lastCheckResult})` : ''
                        }`
                      : '—'}
                  </td>
                  <td>
                    {a.reviewReason ? (
                      <div className="space-y-1 text-xs">
                        <div className="font-semibold text-amber-800">
                          {reviewReasonLabel[a.reviewReason] ?? a.reviewReason}
                        </div>
                        <div>
                          {a.reviewResolvedAt
                            ? `ปิดแล้ว (${formatBangkok(a.reviewResolvedAt)})`
                            : 'ยังไม่ปิดเรื่อง'}{' '}
                          ·{' '}
                          <Link
                            href={merchHref('/merchandise/reviews', eventId)}
                            className="font-semibold text-emerald-700 underline"
                          >
                            ไปหน้ารอตรวจสอบ
                          </Link>
                        </div>
                      </div>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card space-y-3">
        <h2 className="text-lg font-bold text-zinc-900">การจัดส่ง</h2>
        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-zinc-500">สถานะ</dt>
            <dd className="mt-1">
              <span className={badgeClassForShipping(order.shipping.status)}>
                {shippingStatusLabel[order.shipping.status]}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">บริษัทขนส่ง</dt>
            <dd className="mt-1 font-medium text-zinc-900">
              {order.shipping.carrier || '—'}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Tracking ID</dt>
            <dd className="mt-1 font-mono font-medium text-zinc-900">
              {order.shipping.trackingId || '—'}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">วันที่จัดส่ง</dt>
            <dd className="mt-1 font-medium text-zinc-900">
              {order.shipping.shippedAt
                ? formatBangkok(order.shipping.shippedAt)
                : '—'}
            </dd>
          </div>
        </dl>
      </div>

      <div className="card space-y-4 overflow-x-auto">
        <h2 className="text-lg font-bold text-zinc-900">อีเมลแจ้งเตือน</h2>
        {order.notifications.length === 0 ? (
          <p className="text-sm text-zinc-500">ยังไม่มีรายการส่งอีเมล</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>ประเภท</th>
                <th>สถานะ</th>
                <th>จำนวนครั้ง</th>
                <th>Error ล่าสุด</th>
                <th>ส่งเมื่อ</th>
                <th className="text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {order.notifications.map((n) => {
                const canResend =
                  n.status === 'failed' || n.status === 'unknown';
                return (
                  <tr key={n.type}>
                    <td className="font-medium text-zinc-900">
                      {notificationTypeLabel[n.type]}
                    </td>
                    <td>
                      <span
                        className={
                          n.status === 'sent'
                            ? 'badge badge-success'
                            : n.status === 'failed'
                              ? 'badge badge-error'
                              : 'badge badge-warning'
                        }
                      >
                        {notificationStatusLabel[n.status] ?? n.status}
                      </span>
                    </td>
                    <td>{n.attempts}</td>
                    <td className="font-mono text-xs text-red-600">
                      {n.lastErrorCode || '—'}
                    </td>
                    <td>{n.sentAt ? formatBangkok(n.sentAt) : '—'}</td>
                    <td className="text-right">
                      {canResend && (
                        <button
                          type="button"
                          onClick={() =>
                            setResendTarget({
                              type: n.type,
                              status: n.status,
                            })
                          }
                          className="btn-secondary gap-1"
                        >
                          <IconMailForward size={16} />
                          ส่งอีกครั้ง
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="card space-y-4">
        <h2 className="text-lg font-bold text-zinc-900">Audit Trail</h2>
        {order.audit.length === 0 ? (
          <p className="text-sm text-zinc-500">ยังไม่มีประวัติการแก้ไข</p>
        ) : (
          <ul className="space-y-3 text-sm">
            {order.audit.map((a, idx) => (
              <li
                key={idx}
                className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-zinc-900">
                    {a.action}
                  </span>
                  <span className="text-xs text-zinc-500">
                    ผู้ทำ: {a.actorId ?? 'ระบบ'} · {formatBangkok(a.createdAt)}
                  </span>
                </div>
                {a.reason && (
                  <p className="mt-1 text-zinc-700">เหตุผล: {a.reason}</p>
                )}
                {a.contactNote && (
                  <p className="mt-1 text-zinc-700">
                    บันทึกการติดต่อ: {a.contactNote}
                  </p>
                )}
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs font-semibold text-emerald-700">
                    ดูข้อมูลก่อน/หลัง
                  </summary>
                  <pre className="mt-2 max-h-72 overflow-auto rounded-lg bg-zinc-900 p-3 text-xs text-zinc-100">
                    {JSON.stringify(
                      { before: a.before, after: a.after },
                      null,
                      2,
                    )}
                  </pre>
                </details>
              </li>
            ))}
          </ul>
        )}
      </div>

      {editModalOpen && (
        <OrderEditModal
          order={order}
          onClose={() => setEditModalOpen(false)}
          onReload={() => load()}
          onSaved={(updated) => {
            setOrder(updated);
            setEditModalOpen(false);
          }}
        />
      )}

      {shipmentModalOpen && (
        <ShipmentModal
          order={order}
          onClose={() => setShipmentModalOpen(false)}
          onSaved={() => {
            setShipmentModalOpen(false);
            void load();
          }}
        />
      )}

      {resendTarget && (
        <ResendNotificationModal
          orderId={order.id}
          type={resendTarget.type}
          status={resendTarget.status}
          onClose={() => setResendTarget(null)}
          onSent={() => {
            setResendTarget(null);
            void load();
          }}
        />
      )}
    </div>
  );
}
