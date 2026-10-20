'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { IconAlertTriangle, IconLoader2, IconX } from '@tabler/icons-react';
import { merchandiseApi } from '@/lib/merchandiseApi';
import { merchErrorMessage } from '@/lib/merchandiseErrors';
import { notificationTypeLabel } from '@/lib/merchandiseFormat';
import { useMerchandise } from './MerchandiseContext';

export interface ResendNotificationModalProps {
  orderId: string;
  type: 'paid' | 'shipped';
  status: string;
  onSent(): void;
  onClose(): void;
}

export default function ResendNotificationModal({
  orderId,
  type,
  status,
  onSent,
  onClose,
}: ResendNotificationModalProps) {
  const { eventId, token } = useMerchandise();
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    const trimmed = reason.trim();
    if (!trimmed || trimmed.length > 1000) {
      setError('กรุณาระบุเหตุผล (1–1,000 ตัวอักษร)');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await merchandiseApi.resendNotification(
        eventId,
        orderId,
        type,
        trimmed,
        token,
      );
      toast.success('เข้าคิวส่งอีเมลอีกครั้งแล้ว');
      onSent();
    } catch (err) {
      const msg = merchErrorMessage(err);
      setError(msg);
      toast.error(msg);
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
              ส่งอีเมลอีกครั้ง ({notificationTypeLabel[type]})
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100"
          >
            <IconX size={18} />
          </button>
        </div>

        {status === 'unknown' && (
          <div
            role="alert"
            className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-900"
          >
            <IconAlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>
              สถานะไม่ทราบผล อาจส่งถึงผู้ซื้อแล้ว
              การส่งอีกครั้งอาจทำให้ได้รับซ้ำ
            </span>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="mt-4 rounded-xl bg-red-50 p-3 text-xs text-red-700"
          >
            {error}
          </div>
        )}

        <form onSubmit={(e) => void handleSubmit(e)} className="mt-4 space-y-4">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-zinc-700">
              เหตุผลการส่งซ้ำ
            </span>
            <textarea
              rows={3}
              required
              maxLength={1000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="ระบุเหตุผลที่ต้องส่งอีเมลซ้ำ"
              className="input-field"
              autoFocus
            />
          </label>

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
              ยืนยันส่งอีกครั้ง
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
