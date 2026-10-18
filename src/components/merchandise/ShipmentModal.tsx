'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { IconLoader2, IconRefresh, IconX } from '@tabler/icons-react';
import { merchandiseApi } from '@/lib/merchandiseApi';
import { isVersionConflict, merchErrorMessage } from '@/lib/merchandiseErrors';
import type { AdminOrderDetail, OrderSummary } from '@/types/merchandise';
import { useMerchandise } from './MerchandiseContext';

export interface ShipmentModalProps {
  order: AdminOrderDetail;
  onSaved(summary: OrderSummary): void;
  onClose(): void;
}

export default function ShipmentModal({
  order,
  onSaved,
  onClose,
}: ShipmentModalProps) {
  const { eventId, token } = useMerchandise();
  const alreadyShipped = order.shipping.status === 'shipped';

  const [carrier, setCarrier] = useState(order.shipping.carrier ?? '');
  const [trackingId, setTrackingId] = useState(order.shipping.trackingId ?? '');
  const [reason, setReason] = useState('');
  const [expectedVersion, setExpectedVersion] = useState(order.version);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);

  async function handleReloadLatest() {
    setError('');
    setConflict(false);
    try {
      const latest = await merchandiseApi.getOrder(eventId, order.id, token);
      setExpectedVersion(latest.version);
    } catch (err) {
      setError(merchErrorMessage(err));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setError('');
    setConflict(false);

    const trimmedCarrier = carrier.trim();
    const trimmedTracking = trackingId.trim();
    const trimmedReason = reason.trim();

    if (!trimmedCarrier || trimmedCarrier.length > 100) {
      setError('กรุณากรอกบริษัทขนส่ง (1–100 ตัวอักษร)');
      return;
    }
    if (!trimmedTracking || trimmedTracking.length > 100) {
      setError('กรุณากรอก Tracking ID (1–100 ตัวอักษร)');
      return;
    }
    if (alreadyShipped && (!trimmedReason || trimmedReason.length > 1000)) {
      setError('กรุณาระบุเหตุผล (1–1,000 ตัวอักษร)');
      return;
    }

    setSaving(true);
    try {
      const summary = await merchandiseApi.setShipment(
        eventId,
        order.id,
        {
          expectedVersion,
          carrier: trimmedCarrier,
          trackingId: trimmedTracking,
          ...(alreadyShipped ? { reason: trimmedReason } : {}),
        },
        token,
      );
      toast.success('บันทึกข้อมูลการจัดส่งแล้ว');
      onSaved(summary);
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
    <div className="modal-overlay">
      <div className="modal-content max-w-md p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-zinc-900">
              {alreadyShipped ? 'แก้ไขการจัดส่ง' : 'บันทึกการจัดส่ง'}
            </h2>
            <p className="mt-1 text-xs text-zinc-500">
              {alreadyShipped
                ? 'ไม่ส่งอีเมลซ้ำ'
                : 'ผู้ซื้อจะได้รับอีเมลแจ้งจัดส่ง'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100"
          >
            <IconX size={18} />
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-red-50 p-3 text-xs text-red-700"
          >
            <span>{error}</span>
            {conflict && (
              <button
                type="button"
                onClick={() => void handleReloadLatest()}
                className="btn-secondary gap-1 text-xs"
              >
                <IconRefresh size={14} />
                โหลดข้อมูลล่าสุด
              </button>
            )}
          </div>
        )}

        <form onSubmit={(e) => void handleSubmit(e)} className="mt-4 space-y-4">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-zinc-700">
              บริษัทขนส่ง
            </span>
            <input
              type="text"
              required
              maxLength={100}
              value={carrier}
              onChange={(e) => setCarrier(e.target.value)}
              placeholder="เช่น ไปรษณีย์ไทย, Kerry, Flash"
              className="input-field"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-zinc-700">
              Tracking ID
            </span>
            <input
              type="text"
              required
              maxLength={100}
              value={trackingId}
              onChange={(e) => setTrackingId(e.target.value)}
              placeholder="ระบุหมายเลขพัสดุ"
              className="input-field"
            />
          </label>

          {alreadyShipped && (
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-zinc-700">
                เหตุผลการแก้ไข
              </span>
              <textarea
                rows={3}
                required
                maxLength={1000}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="ระบุเหตุผลในการแก้ไขเลขพัสดุหรือขนส่ง"
                className="input-field"
              />
            </label>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              disabled={saving}
              onClick={onClose}
              className="btn-secondary min-h-11"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary min-h-11 gap-2"
            >
              {saving && <IconLoader2 size={18} className="animate-spin" />}
              บันทึกการจัดส่ง
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
