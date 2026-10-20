'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  IconCheck,
  IconLoader2,
  IconRefresh,
  IconX,
} from '@tabler/icons-react';
import { merchandiseApi } from '@/lib/merchandiseApi';
import { merchErrorMessage } from '@/lib/merchandiseErrors';
import {
  formatBaht,
  formatBangkok,
  reviewReasonLabel,
} from '@/lib/merchandiseFormat';
import type { PaymentReviewDto } from '@/types/merchandise';
import { merchHref, useMerchandise } from './MerchandiseContext';

export default function PaymentReviews() {
  const { eventId, token, reloadReviews } = useMerchandise();

  const [resolved, setResolved] = useState(false);
  const [items, setItems] = useState<PaymentReviewDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [resolveTarget, setResolveTarget] = useState<PaymentReviewDto | null>(
    null,
  );
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!eventId || !token) return;
      setLoading(true);
      setError('');
      try {
        const res = await merchandiseApi.listReviews(
          eventId,
          resolved,
          token,
          signal,
        );
        if (!signal?.aborted) {
          setItems(res);
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
    [eventId, token, resolved],
  );

  useEffect(() => {
    const c = new AbortController();
    void load(c.signal);
    return () => c.abort();
  }, [load]);

  function openResolveModal(item: PaymentReviewDto) {
    setResolveTarget(item);
    setNote('');
    setModalError('');
  }

  async function handleResolveSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!resolveTarget || submitting) return;

    const trimmed = note.trim();
    if (!trimmed) {
      setModalError('กรุณาระบุบันทึกการตรวจสอบ');
      return;
    }
    if (trimmed.length > 1000) {
      setModalError('บันทึกต้องไม่เกิน 1,000 ตัวอักษร');
      return;
    }

    setSubmitting(true);
    setModalError('');
    try {
      await merchandiseApi.resolveReview(
        eventId,
        resolveTarget.attemptId,
        trimmed,
        token,
      );
      toast.success('ปิดเรื่องรายการตรวจสอบเรียบร้อยแล้ว');
      setResolveTarget(null);
      await Promise.all([load(), reloadReviews()]);
    } catch (err) {
      const msg = merchErrorMessage(err);
      setModalError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-zinc-900">รายการรอตรวจสอบ</h1>
            <p className="text-xs text-zinc-500">
              ระบบไม่คืนเงินหรือยืนยันออเดอร์อัตโนมัติ ให้เจ้าหน้าที่ตรวจสอบกับ
              PaySolution และติดต่อผู้ซื้อ แล้วบันทึกผลที่นี่
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setResolved(false)}
              className={
                !resolved
                  ? 'btn-primary min-h-11 text-sm'
                  : 'btn-secondary min-h-11 text-sm'
              }
            >
              ยังไม่ปิดเรื่อง
            </button>
            <button
              type="button"
              onClick={() => setResolved(true)}
              className={
                resolved
                  ? 'btn-primary min-h-11 text-sm'
                  : 'btn-secondary min-h-11 text-sm'
              }
            >
              ปิดเรื่องแล้ว
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
            onClick={() => void load()}
            className="btn-secondary gap-2"
          >
            <IconRefresh size={16} />
            ลองใหม่
          </button>
        </div>
      )}

      <div className="card overflow-hidden p-0">
        {loading && items.length === 0 ? (
          <div className="p-6 text-center text-sm text-zinc-500">
            กำลังโหลดรายการตรวจสอบ...
          </div>
        ) : items.length === 0 ? (
          <div className="p-6 text-center text-sm text-zinc-500">
            {resolved
              ? 'ยังไม่มีรายการที่ปิดเรื่องแล้ว'
              : 'ไม่มีรายการรอตรวจสอบในขณะนี้'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>เลขออเดอร์</th>
                  <th>Reference</th>
                  <th className="text-right">ยอดของ attempt</th>
                  <th>เหตุผล</th>
                  <th>เมื่อ</th>
                  {resolved ? (
                    <>
                      <th>ปิดเรื่องเมื่อ</th>
                      <th>บันทึก</th>
                    </>
                  ) : (
                    <th className="table-sticky-actions text-right">
                      การจัดการ
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.attemptId}>
                    <td className="font-semibold text-emerald-700">
                      <Link
                        href={merchHref(
                          `/merchandise/orders/${item.orderId}`,
                          eventId,
                        )}
                        className="hover:underline"
                      >
                        {item.orderNumber}
                      </Link>
                    </td>
                    <td className="font-mono text-xs">{item.referenceNo}</td>
                    <td className="text-right font-medium">
                      {formatBaht(item.amountBaht)}
                    </td>
                    <td>
                      <span className="badge badge-warning">
                        {reviewReasonLabel[item.reviewReason] ??
                          item.reviewReason}
                      </span>
                    </td>
                    <td className="whitespace-nowrap text-xs text-zinc-600">
                      {formatBangkok(item.createdAt)}
                    </td>
                    {resolved ? (
                      <>
                        <td className="whitespace-nowrap text-xs text-zinc-600">
                          {formatBangkok(item.resolvedAt)}
                        </td>
                        <td className="max-w-md text-xs text-zinc-700">
                          {item.note || '—'}
                        </td>
                      </>
                    ) : (
                      <td className="table-sticky-actions text-right">
                        <button
                          type="button"
                          onClick={() => openResolveModal(item)}
                          className="btn-primary min-h-11 gap-1.5 px-3 py-1.5 text-xs"
                        >
                          <IconCheck size={16} />
                          ปิดเรื่อง
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {resolveTarget && (
        <div className="modal-overlay">
          <div className="card w-full max-w-lg space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-zinc-900">
                  ปิดเรื่องรายการตรวจสอบ — {resolveTarget.orderNumber}
                </h2>
                <p className="text-xs text-zinc-500">
                  Reference: {resolveTarget.referenceNo} ·{' '}
                  {reviewReasonLabel[resolveTarget.reviewReason] ??
                    resolveTarget.reviewReason}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setResolveTarget(null)}
                className="btn-secondary p-2"
                aria-label="ปิดหน้าต่าง"
              >
                <IconX size={18} />
              </button>
            </div>

            {modalError && (
              <div
                role="alert"
                className="rounded-xl bg-red-50 p-3 text-sm text-red-700"
              >
                {modalError}
              </div>
            )}

            <form
              onSubmit={(e) => void handleResolveSubmit(e)}
              className="space-y-4"
            >
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  บันทึกผลการตรวจสอบและการติดต่อผู้ซื้อ{' '}
                  <span className="text-red-600">*</span>
                </label>
                <textarea
                  rows={4}
                  maxLength={1000}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="ระบุผลการตรวจสอบกับ PaySolution และรายละเอียดการติดต่อผู้ซื้อ (ไม่เกิน 1,000 ตัวอักษร)"
                  className="input-field"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setResolveTarget(null)}
                  className="btn-secondary min-h-11"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={submitting || !note.trim()}
                  className="btn-primary min-h-11 gap-2"
                >
                  {submitting && (
                    <IconLoader2 size={18} className="animate-spin" />
                  )}
                  ยืนยันปิดเรื่อง
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
