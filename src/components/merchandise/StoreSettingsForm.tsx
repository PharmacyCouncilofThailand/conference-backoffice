'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { IconLoader2, IconRefresh } from '@tabler/icons-react';
import { merchandiseApi } from '@/lib/merchandiseApi';
import { isVersionConflict, merchErrorMessage } from '@/lib/merchandiseErrors';
import { bangkokInputToIso, isoToBangkokInput } from '@/lib/merchandiseFormat';
import type { AdminStoreDto } from '@/types/merchandise';
import { useMerchandise } from './MerchandiseContext';

export default function StoreSettingsForm() {
  const { eventId, token, store, reloadStore } = useMerchandise();

  const [enabled, setEnabled] = useState(false);
  const [opensAt, setOpensAt] = useState('');
  const [closesAt, setClosesAt] = useState('');
  const [productionInfoTh, setProductionInfoTh] = useState('');
  const [shippingInfoTh, setShippingInfoTh] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);
  const [initializedVersion, setInitializedVersion] = useState<number | null>(
    null,
  );

  function fillFromStore(s: AdminStoreDto) {
    setEnabled(s.enabled);
    setOpensAt(isoToBangkokInput(s.opensAt));
    setClosesAt(isoToBangkokInput(s.closesAt));
    setProductionInfoTh(s.productionInfoTh ?? '');
    setShippingInfoTh(s.shippingInfoTh ?? '');
    setInitializedVersion(s.version);
    setConflict(false);
    setError('');
  }

  useEffect(() => {
    if (store && initializedVersion === null) {
      fillFromStore(store);
    }
  }, [store, initializedVersion]);

  useEffect(() => {
    setInitializedVersion(null);
  }, [eventId]);

  async function handleReloadLatest() {
    setError('');
    setConflict(false);
    try {
      const latest = await merchandiseApi.getStore(eventId, token);
      fillFromStore(latest);
      await reloadStore();
    } catch (err) {
      setError(merchErrorMessage(err));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!store || saving) return;
    setError('');
    setConflict(false);

    let opensIso: string | null = null;
    let closesIso: string | null = null;
    try {
      if (opensAt.trim()) {
        opensIso = bangkokInputToIso(opensAt);
      }
      if (closesAt.trim()) {
        closesIso = bangkokInputToIso(closesAt);
      }
    } catch (err) {
      setError(merchErrorMessage(err));
      return;
    }

    if (
      opensIso &&
      closesIso &&
      new Date(opensIso).getTime() >= new Date(closesIso).getTime()
    ) {
      setError('เวลาเปิดพรีออเดอร์ต้องอยู่ก่อนเวลาปิด');
      return;
    }

    setSaving(true);
    try {
      const updated = await merchandiseApi.updateStore(
        eventId,
        {
          expectedVersion: store.version,
          enabled,
          opensAt: opensIso,
          closesAt: closesIso,
          productionInfoTh: productionInfoTh.trim()
            ? productionInfoTh.trim()
            : null,
          shippingInfoTh: shippingInfoTh.trim() ? shippingInfoTh.trim() : null,
        },
        token,
      );
      fillFromStore(updated);
      await reloadStore();
      toast.success('บันทึกการตั้งค่าร้านแล้ว');
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

  if (!store) {
    return (
      <div className="card text-sm text-zinc-500">
        กำลังโหลดการตั้งค่าร้าน...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
          ตั้งค่าร้าน
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          ร้านรับออเดอร์ได้เมื่อเปิดร้านและอยู่ในช่วงเวลา หลังปิด QR
          ที่ออกไปแล้วยังชำระได้จนหมดอายุ
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
              className="btn-secondary gap-2"
              onClick={() => void handleReloadLatest()}
            >
              <IconRefresh size={16} />
              โหลดข้อมูลล่าสุด
            </button>
          )}
        </div>
      )}

      <form onSubmit={(e) => void handleSubmit(e)} className="card space-y-5">
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
          />
          <span className="text-sm font-semibold text-zinc-900">เปิดร้าน</span>
        </label>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="merch-opens-at"
                className="text-sm font-medium text-zinc-700"
              >
                เปิดพรีออเดอร์ (เวลาไทย)
              </label>
              {opensAt && (
                <button
                  type="button"
                  onClick={() => setOpensAt('')}
                  className="text-xs text-zinc-500 underline hover:text-zinc-800"
                >
                  ล้างค่า
                </button>
              )}
            </div>
            <input
              id="merch-opens-at"
              type="datetime-local"
              value={opensAt}
              onChange={(e) => setOpensAt(e.target.value)}
              className="input-field"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="merch-closes-at"
                className="text-sm font-medium text-zinc-700"
              >
                ปิดพรีออเดอร์ (เวลาไทย)
              </label>
              {closesAt && (
                <button
                  type="button"
                  onClick={() => setClosesAt('')}
                  className="text-xs text-zinc-500 underline hover:text-zinc-800"
                >
                  ล้างค่า
                </button>
              )}
            </div>
            <input
              id="merch-closes-at"
              type="datetime-local"
              value={closesAt}
              onChange={(e) => setClosesAt(e.target.value)}
              className="input-field"
            />
          </div>
        </div>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-zinc-700">กำหนดผลิต</span>
          <textarea
            rows={3}
            maxLength={5000}
            value={productionInfoTh}
            onChange={(e) => setProductionInfoTh(e.target.value)}
            placeholder="เช่น ผลิตหลังปิดพรีออเดอร์ ใช้เวลาประมาณ 14 วัน"
            className="input-field"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-zinc-700">กำหนดจัดส่ง</span>
          <textarea
            rows={3}
            maxLength={5000}
            value={shippingInfoTh}
            onChange={(e) => setShippingInfoTh(e.target.value)}
            placeholder="เช่น จัดส่งทางพัสดุภายในเดือนพฤศจิกายน 2569"
            className="input-field"
          />
        </label>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="btn-primary min-h-11 gap-2"
          >
            {saving && <IconLoader2 size={18} className="animate-spin" />}
            บันทึกการตั้งค่าร้าน
          </button>
        </div>
      </form>
    </div>
  );
}
