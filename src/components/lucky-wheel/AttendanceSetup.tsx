"use client";

import { useEffect, useRef, useState } from "react";
import { IconAlertTriangle, IconCheck, IconLoader2, IconRefresh, IconX } from "@tabler/icons-react";
import { api, ApiError } from "@/lib/api";
import type { AdminWheelState, AttendanceSetupBlocker, AttendanceSetupInput, AttendanceSetupResult } from "@/types/lucky-wheel";

const blockerLabels: Record<AttendanceSetupBlocker, string> = {
  SCHEMA_REQUIRED: "ฐานข้อมูลยังไม่มีโครงสร้างที่ต้องใช้",
  INVALID_MAIN_SESSION: "Main Session ที่ผูกกับวงล้อไม่ถูกต้องหรือยังไม่เปิดใช้งาน",
  MISSING_ENTITLEMENTS: "บัตรที่ confirmed ยังมีสิทธิ์ Main Session ไม่ครบ",
  UNLINKED_ACCOUNTS: "รายการลงทะเบียนยังไม่ผูกบัญชีผู้เข้าร่วม",
  LEGACY_SCANNER_MISSING: "ประวัติเดิมไม่มีข้อมูลเจ้าหน้าที่ผู้สแกนที่ตรวจสอบได้",
  LEGACY_TIME_INVALID: "เวลาเช็คอินเดิมอยู่นอกช่วง session หรือไม่ถูกต้อง",
  LEGACY_DAILY_CONFLICT: "ประวัติเดิมขัดกับรายการเช็คอินรายวันที่มีอยู่",
  CANCELLATION_CONFLICT: "มีประวัติยกเลิกที่ต้องตรวจสอบก่อนนำเข้า",
};

type Props = { token: string; eventId: number; state: AdminWheelState;
  mainSessionName?: string; onReload: () => Promise<void> };

export function AttendanceSetup({ token, eventId, state, mainSessionName, onReload }: Props) {
  const readiness = state.attendanceReadiness;
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingRequest, setPendingRequest] = useState<AttendanceSetupInput | null>(null);
  const [result, setResult] = useState<AttendanceSetupResult | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const canSetup = Boolean(readiness && /^[a-f0-9]{64}$/.test(readiness.revision)
    && !readiness.blockers.length && !readiness.setupComplete && state.wheel.paused);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (open && dialog && !dialog.open) {
      returnFocusRef.current = document.activeElement as HTMLElement | null;
      dialog.showModal();
    } else if (!open && dialog?.open) {
      dialog.close();
      returnFocusRef.current?.focus();
    }
  }, [open]);

  const reload = async () => {
    setBusy(true);
    try { await onReload(); setError(null); }
    catch { setError("โหลดสถานะล่าสุดไม่สำเร็จ กรุณาลองใหม่"); }
    finally { setBusy(false); }
  };

  const submit = async () => {
    if (busy || (!pendingRequest && (!canSetup || !reason.trim() || !reviewed))) return;
    const input = pendingRequest ?? { mainSessionId: readiness.mainSessionId,
      expectedReadinessRevision: readiness.revision, reason: reason.trim(), idempotencyKey: crypto.randomUUID() };
    setPendingRequest(input); setBusy(true); setError(null);
    let succeeded: AttendanceSetupResult;
    try { succeeded = await api.luckyWheel.setupAttendance(token, eventId, input); }
    catch (err) {
      if (err instanceof ApiError && err.status < 500 && err.code !== "ATTENDANCE_SETUP_BUSY" && err.status !== 429) {
        setPendingRequest(null); setReviewed(false);
        setError(err.code === "ATTENDANCE_SETUP_STALE" ? "ข้อมูลเปลี่ยนแล้ว ต้องโหลดและตรวจทานใหม่ก่อนยืนยัน" : err.message);
        if (err.code === "ATTENDANCE_SETUP_STALE") {
          setOpen(false);
          try { await onReload(); } catch { setError("ข้อมูลเปลี่ยนแล้ว แต่โหลดสถานะล่าสุดไม่สำเร็จ กรุณาลองใหม่"); }
        }
      } else {
        setError("ยังยืนยันผลคำขอไม่ได้ กดตรวจคำขอเดิมอีกครั้ง ระบบจะไม่สร้างรายการซ้ำ");
      }
      setBusy(false); return;
    }
    setResult(succeeded); setPendingRequest(null); setOpen(false);
    try { await onReload(); }
    catch { setError("ตั้งค่าสำเร็จแล้ว แต่โหลดสถานะล่าสุดไม่สำเร็จ กรุณากดโหลดสถานะ โดยไม่ต้องยืนยัน setup ซ้ำ"); }
    finally { setBusy(false); }
  };

  const audit = result && state.audit.find(item => item.id === result.auditId);
  return <section className="card border border-zinc-200/80" aria-labelledby="attendance-readiness-title">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="max-w-2xl">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">Check-in readiness</p>
        <h2 id="attendance-readiness-title" className="mt-2 text-xl font-semibold text-zinc-950">เช็คอินรายวันสำหรับวงล้อ</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-600">ใช้ Main Session และบัตรเดิม เปิดระบบรายวันและนำเข้าเฉพาะประวัติที่มีหลักฐาน ก่อนเปิดแจกสิทธิ์</p>
        <p className="mt-2 text-sm font-medium text-zinc-700">{mainSessionName ?? "Main Session"} · #{state.wheel.mainSessionId}</p>
      </div>
      <span className={`self-start rounded-full px-3 py-1.5 text-xs font-bold ${readiness?.runtimeReady ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>
        {readiness?.runtimeReady ? "เช็คอินรายวันเปิดใช้งาน" : readiness ? "ยังตั้งค่าไม่ครบ" : "ยังตรวจสถานะไม่ได้"}
      </span>
    </div>
    {readiness && <dl className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
      {[["ลงทะเบียน confirmed", readiness.counts.confirmedRegistrations], ["มีสิทธิ์ Main Session", readiness.counts.confirmedEntitlements],
        ["ประวัติเดิมรอนำเข้า", readiness.counts.pendingLegacyImports]].map(([label, value]) =>
        <div key={label} className="rounded-xl bg-zinc-50 p-4"><dt className="text-xs font-medium text-zinc-600">{label}</dt><dd className="mt-1 text-2xl font-semibold tabular-nums text-zinc-950">{value}</dd></div>)}
    </dl>}
    {!!readiness?.blockers.length && <ul className="mt-4 space-y-2 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
      {readiness.blockers.map(item => <li key={item.code}>{blockerLabels[item.code]} · {item.count} รายการ</li>)}
    </ul>}
    {!state.wheel.paused && !readiness?.setupComplete && <p className="mt-4 text-sm text-amber-800">พักกิจกรรมก่อนตั้งค่า เพื่อให้ตรวจและนำเข้าประวัติได้อย่างปลอดภัย</p>}
    {pendingRequest && <p role="status" className="mt-4 text-sm text-amber-800">มีคำขอที่ต้องตรวจผล กรุณาตรวจคำขอเดิมก่อนเริ่มรายการใหม่</p>}
    {result && <div role="status" className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900">
      <p className="flex items-center gap-2 font-semibold"><IconCheck size={18} />ตั้งค่าสำเร็จ{result.replayed ? " · ผลคำขอเดิม" : ""}</p>
      <p className="mt-1">นำเข้า {result.importedCount} · เคยนำเข้าแล้ว {result.alreadyImportedCount} · มีประวัติตรงกันแล้ว {result.alreadyCoveredCount}</p>
      {audit && <p className="mt-1 text-xs">โดย Admin #{audit.actorId} · {new Date(audit.createdAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}</p>}
    </div>}
    {error && !open && <p role="alert" className="mt-4 flex gap-2 rounded-xl bg-amber-50 p-4 text-sm text-amber-900"><IconAlertTriangle size={18} className="shrink-0" />{error}</p>}
    <div className="mt-5 flex flex-wrap gap-2 border-t border-zinc-100 pt-4">
      <button className="btn-primary min-h-11 disabled:cursor-not-allowed disabled:opacity-50" type="button"
        disabled={busy || (!pendingRequest && (!canSetup || Boolean(result)))} onClick={() => { setReviewed(Boolean(pendingRequest)); setOpen(true); }}>
        {pendingRequest ? "ตรวจคำขอเดิม" : "ตั้งค่าเช็คอินรายวัน"}
      </button>
      <button className="btn-secondary min-h-11" type="button" disabled={busy} onClick={() => void reload()}><IconRefresh size={17} />โหลดสถานะล่าสุด</button>
    </div>
    <dialog ref={dialogRef} aria-labelledby="attendance-setup-dialog-title" onCancel={event => { event.preventDefault(); if (!busy) setOpen(false); }}
      className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[min(560px,calc(100vw-2rem))] overflow-y-auto rounded-2xl p-0 shadow-2xl backdrop:bg-black/40">
      <div className="flex items-start justify-between border-b border-zinc-200 p-5 sm:p-6">
        <div><h3 id="attendance-setup-dialog-title" className="text-xl font-semibold text-zinc-950">ตรวจทานการตั้งค่า</h3><p className="mt-1 text-sm text-zinc-600">{mainSessionName ?? "Main Session"} · #{state.wheel.mainSessionId}</p></div>
        <button type="button" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl hover:bg-zinc-100" aria-label="ปิด" disabled={busy} onClick={() => setOpen(false)}><IconX size={20} /></button>
      </div>
      <form className="space-y-4 p-5 sm:p-6" onSubmit={event => { event.preventDefault(); void submit(); }}>
        <p className="rounded-xl bg-zinc-50 p-4 text-sm leading-6 text-zinc-700">เปิดเช็คอินรายวัน และนำเข้าประวัติเดิมที่ตรวจสอบได้ {readiness?.counts.pendingLegacyImports ?? 0} รายการ โดยคงบัตร สิทธิ์ และประวัติเดิมทั้งหมด กิจกรรมและ QR จะไม่เปิดอัตโนมัติ</p>
        <label className="block text-sm font-medium text-zinc-700">เหตุผลการตั้งค่า<textarea className="input-field mt-1 min-h-24 resize-y" maxLength={500} required value={pendingRequest?.reason ?? reason} disabled={busy || Boolean(pendingRequest)} onChange={event => setReason(event.target.value)} /></label>
        <label className="flex items-start gap-3 text-sm leading-6 text-zinc-700"><input type="checkbox" className="mt-1 size-4 shrink-0 accent-emerald-700" checked={reviewed} disabled={busy || Boolean(pendingRequest)} onChange={event => setReviewed(event.target.checked)} />ตรวจสอบ Main Session และจำนวนประวัติที่จะนำเข้าแล้ว</label>
        {error && <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{error}</p>}
        <div className="grid grid-cols-2 gap-2 border-t border-zinc-100 pt-4 sm:flex sm:justify-end">
          <button type="button" className="btn-secondary min-h-11" disabled={busy} onClick={() => setOpen(false)}>ปิด</button>
          <button type="submit" className="btn-primary min-h-11 disabled:opacity-50" disabled={busy || (!pendingRequest && (!reason.trim() || !reviewed || !canSetup))}>
            {busy && <IconLoader2 size={17} className="animate-spin" />}{pendingRequest ? "ตรวจคำขอเดิม" : "ยืนยันตั้งค่า"}
          </button>
        </div>
      </form>
    </dialog>
  </section>;
}
