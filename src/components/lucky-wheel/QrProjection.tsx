"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { IconRefresh, IconX } from "@tabler/icons-react";
import { api } from "@/lib/api";
import type { WheelQrProjection } from "@/types/lucky-wheel";

type Props = { token: string; eventId: number; qrId: string; onClose: () => void };

export function QrProjection({ token, eventId, qrId, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [projection, setProjection] = useState<WheelQrProjection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    try {
      const current = await api.luckyWheel.getQrProjection(token, eventId, qrId);
      setProjection(current);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "โหลด QR ไม่สำเร็จ");
    }
  }, [token, eventId, qrId]);

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    const initial = window.setTimeout(() => { void reload(); }, 0);
    const interval = window.setInterval(() => { if (document.visibilityState === "visible") void reload(); }, 15_000);
    return () => { window.clearTimeout(initial); window.clearInterval(interval); dialog?.close(); };
  }, [reload]);

  return (
    <dialog ref={dialogRef} onCancel={(event) => { event.preventDefault(); onClose(); }} className="fixed inset-0 m-auto max-h-[100dvh] w-[min(900px,100vw)] max-w-none overflow-y-auto rounded-2xl bg-white p-0 shadow-2xl backdrop:bg-zinc-950/85" aria-labelledby="qr-projection-title">
      <div className="flex items-center justify-between gap-4 border-b border-zinc-200 px-5 py-4">
        <h2 id="qr-projection-title" className="text-lg font-bold text-zinc-900">QR รับสิทธิ์วงล้อ</h2>
        <div className="flex gap-2">
          <button type="button" className="btn btn-secondary" onClick={() => void reload()} aria-label="รีโหลด QR"><IconRefresh size={20} /></button>
          <button type="button" className="btn btn-secondary" onClick={onClose} aria-label="ปิดหน้าฉาย QR"><IconX size={20} /></button>
        </div>
      </div>
      <div className="flex flex-col items-center px-5 py-7 text-center sm:px-10">
        {error && <p role="alert" className="mb-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        {projection ? <>
          <p className="break-words text-2xl font-bold text-zinc-950 sm:text-4xl">{projection.name}</p>
          <p className="mt-3 text-base text-zinc-700">{projection.date} · {projection.status === "open" ? "เปิดรับสิทธิ์" : "ยังไม่เปิด / ปิดรับแล้ว"}</p>
          <p className="mt-1 text-base font-semibold text-zinc-900">สิ้นสุด {new Date(projection.currentDeadline).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "medium", timeStyle: "short" })} น. (เวลาไทย)</p>
          <div className="mt-6 w-full max-w-[min(512px,80vw)] rounded-xl border-4 border-zinc-950 bg-white p-3">
            <Image src={projection.qrDataUrl} alt={`QR รับสิทธิ์ ${projection.name}`} width={512} height={512} unoptimized className="aspect-square h-auto w-full" />
          </div>
          <p className="mt-5 text-sm text-zinc-700">สแกนด้วยกล้องโทรศัพท์ แล้วเข้าสู่บัญชี PRIS ของตนเอง</p>
        </> : !error ? <p role="status" className="py-20 text-zinc-600">กำลังโหลด QR…</p> : null}
      </div>
    </dialog>
  );
}
