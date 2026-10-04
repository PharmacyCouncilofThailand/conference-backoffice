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
  onClose: () => void;
  onDone: () => Promise<void> | void;
};

export function StockAdjustmentDialog({
  open,
  eventId,
  token,
  segment,
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
  }, [open, segment?.id]);

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
    setSubmitting(true);
    setError(null);
    try {
      await api.luckyWheel.adjustStock(token, eventId, {
        segmentId: segment.id,
        delta: amount,
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
      className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[min(520px,calc(100vw-2rem))] overflow-y-auto rounded-2xl p-0 shadow-2xl backdrop:bg-black/40"
      aria-labelledby="stock-adjustment-title"
    >
      <div className="flex items-start justify-between border-b border-zinc-200 px-5 py-5 sm:px-6">
        <div>
          <h2 id="stock-adjustment-title" className="text-xl font-semibold text-zinc-950">
            เติมสต็อก
          </h2>
          <p className="mt-1 text-sm text-zinc-600">{segment?.name.th}</p>
        </div>
        <button type="button" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl hover:bg-zinc-100" onClick={close} aria-label="ปิด">
          <IconX size={20} />
        </button>
      </div>
      <div className="space-y-4 p-5 sm:p-6">
        <div className="rounded-xl bg-zinc-50 p-4"><p className="text-xs font-semibold text-zinc-500">สต็อกคงเหลือปัจจุบัน</p><p className="mt-1 text-2xl font-bold tabular-nums text-zinc-950">{segment?.remaining ?? 0}</p></div>
        <label className="block text-sm font-medium text-zinc-700">
          จำนวน
          <input
            className="input-field mt-1"
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
            className="input-field mt-1 min-h-24 resize-y"
            value={reason}
            maxLength={500}
            onChange={(event) => setReason(event.target.value)}
            placeholder="เช่น เติมของรอบเช้า / ปรับยอดจากการตรวจนับ"
          />
        </label>
        {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        <div className="grid grid-cols-2 gap-2 border-t border-zinc-100 pt-4 sm:flex sm:justify-end">
          <button type="button" className="btn-secondary disabled:cursor-not-allowed disabled:opacity-50 min-h-11" onClick={close} disabled={submitting}>ยกเลิก</button>
          <button type="button" className="btn-primary min-h-11" onClick={() => void submit()} disabled={submitting}>
            {submitting && <IconLoader2 size={17} className="animate-spin" />}
            ยืนยันเติมสต็อก
          </button>
        </div>
      </div>
    </dialog>
  );
}
