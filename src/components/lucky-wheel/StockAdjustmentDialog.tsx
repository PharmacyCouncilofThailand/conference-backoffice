"use client";

import { useEffect, useRef, useState } from "react";
import { IconLoader2, IconX } from "@tabler/icons-react";
import { api } from "@/lib/api";
import type { WheelSegmentState } from "@/types/lucky-wheel";

type Props = {
  open: boolean;
  eventId: number;
  token: string;
  segment: WheelSegmentState | null;
  mode: "add" | "reduce";
  onClose: () => void;
  onDone: () => Promise<void> | void;
};

export function StockAdjustmentDialog({
  open,
  eventId,
  token,
  segment,
  mode,
  onClose,
  onDone,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState("");
  const [requestKey, setRequestKey] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      returnFocusRef.current = document.activeElement as HTMLElement | null;
      setQuantity("1");
      setReason("");
      setError(null);
      setRequestKey(crypto.randomUUID());
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open, segment?.id, mode]);

  const close = () => {
    if (submitting) return;
    onClose();
    queueMicrotask(() => returnFocusRef.current?.focus());
  };

  const submit = async () => {
    if (!segment || segment.kind !== "prize") return;
    const amount = Number(quantity);
    if (!Number.isInteger(amount) || amount <= 0 || !reason.trim()) {
      setError("กรอกจำนวนเต็มที่มากกว่า 0 และเหตุผล");
      return;
    }
    if (mode === "reduce" && amount > (segment.remaining ?? 0)) {
      setError("จำนวนที่ลดมากกว่าสต็อกคงเหลือ");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.luckyWheel.adjustStock(token, eventId, {
        segmentId: segment.id,
        delta: mode === "add" ? amount : -amount,
        reason: reason.trim(),
        idempotencyKey: requestKey,
      });
      await onDone();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ปรับสต็อกไม่สำเร็จ");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClose={() => {
        if (open) onClose();
        queueMicrotask(() => returnFocusRef.current?.focus());
      }}
      className="fixed inset-0 m-auto w-[min(520px,calc(100vw-2rem))] rounded-2xl p-0 shadow-2xl backdrop:bg-black/40"
      aria-labelledby="stock-adjustment-title"
    >
      <div className="flex items-start justify-between border-b border-zinc-200 px-6 py-4">
        <div>
          <h2 id="stock-adjustment-title" className="text-lg font-semibold text-zinc-900">
            {mode === "add" ? "เพิ่มสต็อก" : "ลดสต็อก"}
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            {segment?.name.th} · คงเหลือ {segment?.remaining ?? 0}
          </p>
        </div>
        <button type="button" className="rounded-lg p-2 hover:bg-zinc-100" onClick={close} aria-label="ปิด">
          <IconX size={20} />
        </button>
      </div>
      <div className="space-y-4 p-6">
        <label className="block text-sm font-medium text-zinc-700">
          จำนวน
          <input
            className="input mt-1"
            type="number"
            min={1}
            step={1}
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
          />
        </label>
        <label className="block text-sm font-medium text-zinc-700">
          เหตุผล
          <textarea
            className="input mt-1 min-h-24 resize-y"
            value={reason}
            maxLength={500}
            onChange={(event) => setReason(event.target.value)}
            placeholder="เช่น เติมของรอบเช้า / ปรับยอดจากการตรวจนับ"
          />
        </label>
        {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-secondary" onClick={close} disabled={submitting}>ยกเลิก</button>
          <button type="button" className="btn btn-primary" onClick={() => void submit()} disabled={submitting}>
            {submitting && <IconLoader2 size={17} className="animate-spin" />}
            ยืนยัน{mode === "add" ? "เพิ่ม" : "ลด"}สต็อก
          </button>
        </div>
      </div>
    </dialog>
  );
}
