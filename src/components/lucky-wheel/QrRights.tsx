"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { IconAlertTriangle, IconLoader2, IconRefresh } from "@tabler/icons-react";
import toast from "react-hot-toast";
import { api, ApiError } from "@/lib/api";
import type { AdminWheelState, WheelCreditClaim, WheelDayChange, WheelDayWindow, WheelPage, WheelQrListItem } from "@/types/lucky-wheel";
import { QrProjection } from "./QrProjection";

type Props = { token: string; eventId: number; wheelState: AdminWheelState | null };
type PendingBatch = { names: string[]; idempotencyKey: string };
type PendingStatus = { qrId: string; status: "open" | "closed"; reason: string; idempotencyKey: string };
type PendingRevocation = { claimId: string; reason: string; idempotencyKey: string };

function toBangkokInput(value: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(value));
  const part = Object.fromEntries(parts.map((item) => [item.type, item.value]));
  return `${part.year}-${part.month}-${part.day}T${part.hour}:${part.minute}`;
}

function toIso(value: string): string {
  return new Date(`${value}:00+07:00`).toISOString();
}

function isWithinBangkokDate(date: string, startInput: string, endInput: string): boolean {
  const followingDate = new Date(Date.parse(`${date}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  return startInput.startsWith(`${date}T`) &&
    (endInput.startsWith(`${date}T`) || endInput === `${followingDate}T00:00`);
}

function formatBangkok(value: string): string {
  return new Date(value).toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok", dateStyle: "medium", timeStyle: "short",
  });
}

export function QrRights({ token, eventId, wheelState }: Props) {
  const [date, setDate] = useState("");
  const [day, setDay] = useState<WheelDayWindow | null>(null);
  const [startInput, setStartInput] = useState("");
  const [endInput, setEndInput] = useState("");
  const [editReason, setEditReason] = useState("");
  const [dayChanges, setDayChanges] = useState<WheelPage<WheelDayChange> | null>(null);
  const [changePage, setChangePage] = useState(1);
  const [qrPage, setQrPage] = useState(1);
  const [qrList, setQrList] = useState<WheelPage<WheelQrListItem> | null>(null);
  const [names, setNames] = useState("");
  const [reasonByQr, setReasonByQr] = useState<Record<string, string>>({});
  const [projectionId, setProjectionId] = useState<string | null>(null);
  const [selectedQrId, setSelectedQrId] = useState<string | null>(null);
  const [claimPage, setClaimPage] = useState(1);
  const [claims, setClaims] = useState<WheelPage<WheelCreditClaim> | null>(null);
  const [claimLoading, setClaimLoading] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [revocationReasons, setRevocationReasons] = useState<Record<string, string>>({});
  const [confirmClaimId, setConfirmClaimId] = useState<string | null>(null);
  const [pendingRevocation, setPendingRevocation] = useState<PendingRevocation | null>(null);
  const [revocationBusy, setRevocationBusy] = useState(false);
  const [displayNow, setDisplayNow] = useState(() => Date.now());
  const [pendingBatch, setPendingBatch] = useState<PendingBatch | null>(null);
  const [pendingStatus, setPendingStatus] = useState<PendingStatus | null>(null);
  const [confirmCloseQrId, setConfirmCloseQrId] = useState<string | null>(null);
  const [mainSessionWindow, setMainSessionWindow] = useState<{ startAt: string; endAt: string } | null>(null);
  const [scanWindowUnknown, setScanWindowUnknown] = useState(false);
  const [busy, setBusy] = useState<"day" | "batch" | "status" | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sequence = useRef(0);
  const claimSequence = useRef(0);

  useEffect(() => {
    const timer = window.setInterval(() => setDisplayNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const mainSessionId = wheelState?.wheel.mainSessionId;
    if (!mainSessionId) return;
    let active = true;
    void api.backofficeEvents.getSessions(token, eventId).then((response) => {
      if (!active) return;
      const session = response.sessions.find((item) => item.id === mainSessionId);
      if (session && typeof session.startTime === "string" && typeof session.endTime === "string") {
        setMainSessionWindow({ startAt: session.startTime, endAt: session.endTime });
        setScanWindowUnknown(false);
      } else { setMainSessionWindow(null); setScanWindowUnknown(true); }
    }).catch(() => { if (active) { setMainSessionWindow(null); setScanWindowUnknown(true); } });
    return () => { active = false; };
  }, [token, eventId, wheelState?.wheel.mainSessionId]);

  const load = useCallback(async () => {
    if (!date) return;
    const current = ++sequence.current;
    setLoading(true);
    setError(null);
    try {
      const [dayResponse, changes, qrs] = await Promise.all([
        api.luckyWheel.getDay(token, eventId, date),
        api.luckyWheel.listDayChanges(token, eventId, date, changePage),
        api.luckyWheel.listQrCodes(token, eventId, date, qrPage),
      ]);
      if (current !== sequence.current) return;
      setDay(dayResponse.day);
      setStartInput(dayResponse.day ? toBangkokInput(dayResponse.day.startAt) : `${date}T09:00`);
      setEndInput(dayResponse.day ? toBangkokInput(dayResponse.day.endAt) : `${date}T19:00`);
      setEditReason("");
      setDayChanges(changes);
      setQrList(qrs);
    } catch (cause) {
      if (current === sequence.current) setError(cause instanceof Error ? cause.message : "โหลดข้อมูลวันและ QR ไม่สำเร็จ");
    } finally {
      if (current === sequence.current) setLoading(false);
    }
  }, [token, eventId, date, changePage, qrPage]);

  const loadClaims = useCallback(async () => {
    if (!selectedQrId) return;
    const current = ++claimSequence.current;
    setClaimLoading(true);
    setClaimError(null);
    try {
      const response = await api.luckyWheel.listQrClaims(token, eventId, selectedQrId, claimPage);
      if (current === claimSequence.current) setClaims(response);
    } catch (cause) {
      if (current === claimSequence.current) setClaimError(cause instanceof Error ? cause.message : "โหลดผู้รับสิทธิ์ไม่สำเร็จ");
    } finally {
      if (current === claimSequence.current) setClaimLoading(false);
    }
  }, [token, eventId, selectedQrId, claimPage]);

  useEffect(() => { void load(); return () => { sequence.current += 1; }; }, [load]);
  useEffect(() => { void loadClaims(); return () => { claimSequence.current += 1; }; }, [loadClaims]);
  useEffect(() => {
    setDate(""); setDay(null); setQrList(null); setDayChanges(null);
    setQrPage(1); setChangePage(1); setPendingBatch(null); setPendingStatus(null); setConfirmCloseQrId(null);
    setSelectedQrId(null); setClaims(null); setClaimPage(1); setPendingRevocation(null);
  }, [eventId]);

  const selectedQr = qrList?.items.find((qr) => qr.id === selectedQrId) ?? null;
  const unspentCount = selectedQr ? Math.max(0, selectedQr.claimCount - selectedQr.spentCount - selectedQr.revokedCount) : 0;
  const bangkokDate = toBangkokInput(new Date(displayNow).toISOString()).slice(0, 10);
  const hasRealStock = wheelState?.segments.some((segment) => segment.kind === "prize" && segment.enabled && (segment.remaining ?? 0) > 0) ?? false;
  const globalUnavailableReason = !day || !wheelState ? "รอโหลดสถานะกิจกรรม"
    : date !== bangkokDate ? "สิทธิ์ใช้ได้เฉพาะวันไทยของ QR"
    : displayNow < new Date(day.startAt).getTime() || displayNow >= new Date(day.endAt).getTime() ? "อยู่นอกช่วงเวลาที่กำหนดขณะนี้"
    : wheelState.wheel.paused || !wheelState.wheel.enabled ? "วงล้อพักอยู่ขณะนี้"
    : !hasRealStock ? "ของรางวัลจริงหมดขณะนี้" : null;
  const proposedStart = Date.parse(`${startInput}:00+07:00`);
  const proposedEnd = Date.parse(`${endInput}:00+07:00`);
  const scanWindowWarning = mainSessionWindow && Number.isFinite(proposedStart) && Number.isFinite(proposedEnd)
    ? proposedEnd <= Date.parse(mainSessionWindow.startAt) || proposedStart >= Date.parse(mainSessionWindow.endAt)
      ? "ช่วงเวลาวงล้อไม่ทับช่วงสแกน Main Session ผู้ที่ยังไม่ได้เช็คอินจะรับสิทธิ์ไม่ได้"
      : proposedStart < Date.parse(mainSessionWindow.startAt)
        ? "วงล้อเริ่มก่อนช่วงสแกน Main Session ผู้ที่ยังไม่ได้เช็คอินจะรับสิทธิ์ในช่วงแรกไม่ได้"
        : null
    : scanWindowUnknown ? "ยังตรวจช่วงเวลาสแกน Main Session ไม่ได้ กรุณาตรวจเองก่อนเปิด QR" : null;

  const selectQr = (qrId: string) => {
    setSelectedQrId(qrId);
    setClaimPage(1);
    setClaims(null);
    setClaimError(null);
    setConfirmClaimId(null);
    setPendingRevocation(null);
  };

  const revokeClaim = async (claim: WheelCreditClaim) => {
    if (revocationBusy || claim.spentAt || claim.revokedAt) return;
    const reason = revocationReasons[claim.id]?.trim() ?? "";
    if (!pendingRevocation && !reason) { setClaimError("กรอกเหตุผลก่อนยกเลิกสิทธิ์รายบุคคล"); return; }
    if (!pendingRevocation && confirmClaimId !== claim.id) { setConfirmClaimId(claim.id); return; }
    const request = pendingRevocation ?? { claimId: claim.id, reason, idempotencyKey: crypto.randomUUID() };
    if (request.claimId !== claim.id) return;
    setPendingRevocation(request); setRevocationBusy(true); setClaimError(null);
    try {
      const result = await api.luckyWheel.revokeCreditClaim(token, eventId, claim.id, {
        reason: request.reason, idempotencyKey: request.idempotencyKey,
      });
      setPendingRevocation(null); setConfirmClaimId(null);
      setRevocationReasons((current) => ({ ...current, [claim.id]: "" }));
      toast.success(result.replayed ? "คำขอเดิมบันทึกไว้แล้ว" : "ยกเลิกสิทธิ์รายการนี้แล้ว");
      await Promise.all([loadClaims(), load()]);
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 409) {
        setPendingRevocation(null); setConfirmClaimId(null);
        await Promise.all([loadClaims(), load()]);
        setClaimError("สิทธิ์รายการนี้ถูกใช้หรือเปลี่ยนสถานะแล้ว กรุณาตรวจรายการล่าสุด");
      } else {
        if (cause instanceof ApiError && cause.status >= 400 && cause.status < 500 && cause.status !== 429) setPendingRevocation(null);
        setClaimError(cause instanceof Error ? cause.message : "ยกเลิกสิทธิ์ไม่สำเร็จ กรุณาตรวจสถานะก่อนลองใหม่");
      }
    } finally { setRevocationBusy(false); }
  };

  const saveDay = async () => {
    if (!date || busy) return;
    if (!startInput || !endInput || (day && !editReason.trim())) {
      setError("กรอกเวลาเริ่ม–จบ และเหตุผลเมื่อแก้ช่วงเวลา");
      return;
    }
    if (!isWithinBangkokDate(date, startInput, endInput)) {
      setError("ช่วงเวลาต้องอยู่ในวันที่ไทยที่เลือก โดยเวลาจบเป็นเที่ยงคืนวันถัดไปได้");
      return;
    }
    const startAt = toIso(startInput);
    const endAt = toIso(endInput);
    if (startAt >= endAt) { setError("เวลาเริ่มต้องก่อนเวลาจบ"); return; }
    setBusy("day"); setError(null);
    try {
      await api.luckyWheel.saveDay(token, eventId, date, {
        startAt, endAt, expectedVersion: day?.version ?? null,
        reason: day ? editReason.trim() : null,
      });
      toast.success("บันทึกช่วงเวลารับสิทธิ์และหมุนพร้อมกันแล้ว");
      await load();
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 409) await load();
      setError(cause instanceof Error ? cause.message : "บันทึกเวลาไม่สำเร็จ");
    } finally { setBusy(null); }
  };

  const createBatch = async () => {
    if (!date || !day || busy) return;
    const entered = names.split("\n").map((name) => name.trim()).filter(Boolean);
    if (!pendingBatch && (entered.length < 1 || entered.length > 20 || new Set(entered.map((name) => name.toLocaleLowerCase())).size !== entered.length || entered.some((name) => name.length > 160))) {
      setError("กรอกชื่อ QR ไม่ซ้ำกัน 1–20 ชื่อ ชื่อละไม่เกิน 160 ตัวอักษร");
      return;
    }
    const request = pendingBatch ?? { names: entered, idempotencyKey: crypto.randomUUID() };
    setPendingBatch(request); setBusy("batch"); setError(null);
    try {
      const created = await api.luckyWheel.createQrBatch(token, eventId, { date, ...request });
      setPendingBatch(null); setNames("");
      toast.success(created.replayed ? "พบ QR ชุดเดิมแล้ว" : `สร้าง QR ปิดไว้ ${created.qrCodes.length} ใบ`);
      await load();
    } catch (cause) {
      if (cause instanceof ApiError && cause.status >= 400 && cause.status < 500 && cause.status !== 429) setPendingBatch(null);
      setError(cause instanceof Error ? cause.message : "สร้าง QR ไม่สำเร็จ");
    } finally { setBusy(null); }
  };

  const changeStatus = async (qr: WheelQrListItem) => {
    if (busy) return;
    const reason = reasonByQr[qr.id]?.trim() ?? "";
    if (!pendingStatus && !reason) { setError("กรอกเหตุผลก่อนเปิดหรือปิด QR"); return; }
    if (!pendingStatus && qr.status === "open" && confirmCloseQrId !== qr.id) { setConfirmCloseQrId(qr.id); return; }
    const request = pendingStatus ?? {
      qrId: qr.id, status: qr.status === "open" ? "closed" as const : "open" as const,
      reason, idempotencyKey: crypto.randomUUID(),
    };
    setPendingStatus(request); setBusy("status"); setError(null);
    try {
      await api.luckyWheel.setQrStatus(token, eventId, request.qrId, {
        status: request.status, reason: request.reason, idempotencyKey: request.idempotencyKey,
      });
      setPendingStatus(null);
      setConfirmCloseQrId(null);
      setReasonByQr((current) => ({ ...current, [qr.id]: "" }));
      toast.success(request.status === "open" ? "เปิดรับสิทธิ์ QR แล้ว" : "ปิดรับสิทธิ์ QR แล้ว");
      await load();
    } catch (cause) {
      if (cause instanceof ApiError && cause.status >= 400 && cause.status < 500 && cause.status !== 429) { setPendingStatus(null); setConfirmCloseQrId(null); }
      setError(cause instanceof Error ? cause.message : "เปลี่ยนสถานะ QR ไม่สำเร็จ");
    } finally { setBusy(null); }
  };

  return <div className="space-y-5">
    <section className="card" aria-labelledby="wheel-day-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 id="wheel-day-heading" className="text-lg font-semibold text-zinc-900">วันและช่วงเวลากิจกรรม</h2><p className="mt-1 text-sm text-zinc-600">ใช้ช่วงเวลาเดียวกันสำหรับรับ QR และหมุนวงล้อ ตามเวลาไทย</p></div>
        <button type="button" className="btn btn-secondary" disabled={!date || loading} onClick={() => void load()}><IconRefresh size={17} /> รีโหลด</button>
      </div>
      <label className="mt-5 block max-w-xs text-sm font-medium text-zinc-700">วันที่ไทย
        <input type="date" className="input mt-1" value={date} onChange={(event) => { setDate(event.target.value); setQrPage(1); setChangePage(1); setPendingBatch(null); setSelectedQrId(null); setClaims(null); setClaimPage(1); }} />
      </label>
      {!date ? <p className="mt-5 text-sm text-zinc-600">เลือกวันที่ก่อนกำหนดเวลาและสร้าง QR</p> : loading && !day && !qrList ? <p role="status" className="mt-5 text-sm text-zinc-600">กำลังโหลดข้อมูล…</p> : <>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-zinc-700">เวลาเริ่มรับสิทธิ์และหมุน<input type="datetime-local" className="input mt-1" value={startInput} onChange={(event) => setStartInput(event.target.value)} /></label>
          <label className="text-sm font-medium text-zinc-700">เวลาสิ้นสุดรับสิทธิ์และหมุน<input type="datetime-local" className="input mt-1" value={endInput} onChange={(event) => setEndInput(event.target.value)} /></label>
        </div>
        {scanWindowWarning && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900" role="status">{scanWindowWarning}</p>}
        {day && <label className="mt-4 block text-sm font-medium text-zinc-700">เหตุผลที่แก้เวลา<textarea className="input mt-1 min-h-20" maxLength={500} value={editReason} onChange={(event) => setEditReason(event.target.value)} /></label>}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" className="btn btn-primary" disabled={Boolean(busy) || !startInput || !endInput || Boolean(day && !editReason.trim())} onClick={() => void saveDay()}>{busy === "day" && <IconLoader2 size={17} className="animate-spin" />} {day ? "บันทึกเวลาใหม่" : "สร้างช่วงเวลาวันนี้"}</button>
          {day && <span className="text-xs text-zinc-600">เวอร์ชัน {day.version} · ปรับได้แม้เปิด QR แล้ว</span>}
        </div>
      </>}
      {error && <p role="alert" className="mt-4 flex gap-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-700"><IconAlertTriangle size={18} className="shrink-0" />{error}</p>}
    </section>

    {date && day && <>
      <section className="card" aria-labelledby="qr-batch-heading">
        <h2 id="qr-batch-heading" className="text-lg font-semibold text-zinc-900">เตรียม QR รับสิทธิ์</h2>
        <p className="mt-1 text-sm text-zinc-600">หนึ่งบรรทัดต่อ QR สร้างแล้วจะยังปิดรับจนกว่า Admin เปิดทีละใบ</p>
        <textarea className="input mt-4 min-h-28 w-full" value={names} onChange={(event) => setNames(event.target.value)} disabled={Boolean(pendingBatch)} placeholder={"หลังจบกิจกรรมช่วงเช้า\nหลังจบกิจกรรมช่วงบ่าย"} />
        <button type="button" className="btn btn-primary mt-3" disabled={Boolean(busy)} onClick={() => void createBatch()}>{busy === "batch" && <IconLoader2 size={17} className="animate-spin" />}{pendingBatch ? "ตรวจ QR ชุดเดิมอีกครั้ง" : "สร้าง QR แบบปิดรับ"}</button>
      </section>

      <section className="card" aria-labelledby="qr-list-heading">
        <h2 id="qr-list-heading" className="text-lg font-semibold text-zinc-900">QR ของวันที่ {date}</h2>
        <p className="mt-1 text-sm text-zinc-600">เปิด QR ใบใหม่แล้ว ใบที่เปิดก่อนยังรับได้จนถึงเวลาปิดหรือจน Admin ปิดเอง</p>
        <div className="mt-4 space-y-3">
          {(qrList?.items ?? []).map((qr) => <div key={qr.id} className="rounded-xl border border-zinc-200 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0"><p className="break-words font-semibold text-zinc-900">{qr.name}</p><p className="mt-1 text-xs text-zinc-600">{qr.status === "open" ? "เปิดรับ" : "ปิดรับ"} · รับแล้ว {qr.claimCount} · ใช้แล้ว {qr.spentCount} · ยกเลิก {qr.revokedCount}</p></div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn btn-secondary" onClick={() => selectQr(qr.id)} aria-pressed={selectedQrId === qr.id}>ดูผู้รับสิทธิ์</button>
                <button type="button" className="btn btn-secondary" onClick={() => setProjectionId(qr.id)}>แสดงบนจอ</button>
              </div>
            </div>
            <p className="mt-2 text-xs text-zinc-600">เวลาปิดล่าสุด {formatBangkok(qr.currentDeadline)} น.</p>
            <div className="mt-2 space-y-1 text-xs text-zinc-600">
              <p>สร้าง {formatBangkok(qr.createdAt)} น. โดย Admin #{qr.createdBy}</p>
              {qr.openedAt && <p>เปิดครั้งล่าสุด {formatBangkok(qr.openedAt)} น. โดย Admin #{qr.openedBy} · {qr.openedReason}</p>}
              {qr.closedAt && <p>ปิดครั้งล่าสุด {formatBangkok(qr.closedAt)} น. โดย Admin #{qr.closedBy} · {qr.closedReason}</p>}
            </div>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
              <label className="min-w-0 flex-1 text-sm text-zinc-700">เหตุผลเปิด/ปิด QR<input className="input mt-1" maxLength={500} value={reasonByQr[qr.id] ?? ""} onChange={(event) => { setReasonByQr((current) => ({ ...current, [qr.id]: event.target.value })); setConfirmCloseQrId(null); }} disabled={Boolean(pendingStatus)} /></label>
              <button type="button" className="btn btn-secondary" disabled={Boolean(busy) || Boolean(pendingStatus && pendingStatus.qrId !== qr.id)} onClick={() => void changeStatus(qr)}>{pendingStatus?.qrId === qr.id ? "ตรวจคำขอเดิม" : confirmCloseQrId === qr.id ? "ยืนยันปิด QR" : qr.status === "open" ? "ปิด QR" : "เปิด QR"}</button>
              {confirmCloseQrId === qr.id && !pendingStatus && <button type="button" className="btn btn-secondary" onClick={() => setConfirmCloseQrId(null)}>ไม่ปิด</button>}
            </div>
          </div>)}
          {qrList?.items.length === 0 && <p className="py-6 text-center text-sm text-zinc-600">ยังไม่มี QR ของวันนี้</p>}
        </div>
        {qrList && qrList.pagination.totalPages > 1 && <div className="mt-4 flex items-center gap-3 text-sm"><button className="btn btn-secondary" disabled={qrPage <= 1} onClick={() => { setQrPage(qrPage - 1); setSelectedQrId(null); setClaims(null); }}>ก่อนหน้า</button><span>หน้า {qrPage} / {qrList.pagination.totalPages}</span><button className="btn btn-secondary" disabled={qrPage >= qrList.pagination.totalPages} onClick={() => { setQrPage(qrPage + 1); setSelectedQrId(null); setClaims(null); }}>ถัดไป</button></div>}
      </section>

      {selectedQr && <section className="card" aria-labelledby="qr-claims-heading">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0"><h2 id="qr-claims-heading" className="break-words text-lg font-semibold text-zinc-900">ผู้รับสิทธิ์ · {selectedQr.name}</h2><p className="mt-1 text-sm text-zinc-600">วันที่ไทย {date} · ปิด QR หยุดรับใหม่เท่านั้น ไม่ยกเลิกสิทธิ์ที่รับแล้ว</p></div>
          <button type="button" className="btn btn-secondary" disabled={claimLoading} onClick={() => void Promise.all([loadClaims(), load()])}><IconRefresh size={17} /> รีโหลด</button>
        </div>
        <div className="mt-4 grid gap-2 text-sm sm:grid-cols-4">
          <div className="rounded-lg bg-emerald-50 p-3 text-emerald-900">รับแล้ว <strong className="block text-xl">{selectedQr.claimCount}</strong></div>
          <div className="rounded-lg bg-sky-50 p-3 text-sky-900">ใช้หมุนแล้ว <strong className="block text-xl">{selectedQr.spentCount}</strong></div>
          <div className="rounded-lg bg-rose-50 p-3 text-rose-900">Admin ยกเลิก <strong className="block text-xl">{selectedQr.revokedCount}</strong></div>
          <div className="rounded-lg bg-amber-50 p-3 text-amber-900">ใช้ไม่ได้ขณะนี้จากเงื่อนไขส่วนกลาง <strong className="block text-xl">{globalUnavailableReason ? unspentCount : 0}</strong></div>
        </div>
        <p className="mt-2 text-xs text-zinc-600">ยังไม่ใช้ {unspentCount} · {globalUnavailableReason ?? "ช่วงเวลาและสถานะส่วนกลางเปิดอยู่"} · จำนวนใช้ไม่ได้ขณะนี้เป็นข้อมูลหน้าจอตามเวลาเครื่องและสถานะล่าสุดที่โหลด; server ตรวจเวลาจริงและ check-in ของแต่ละคนเมื่อหมุน</p>
        {claimError && <p role="alert" className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{claimError}</p>}
        {claimLoading && <p role="status" className="mt-4 text-sm text-zinc-600">กำลังโหลดรายการผู้รับ…</p>}
        <div className="mt-4 space-y-3">
          {(claims?.items ?? []).map((claim) => <div key={claim.id} className="min-w-0 rounded-xl border border-zinc-200 p-4 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0"><p className="break-words font-semibold text-zinc-900">{claim.recipient.firstName} {claim.recipient.lastName}</p><p className="break-all text-xs text-zinc-600">{claim.recipient.email}</p><p className="mt-1 text-xs text-zinc-600">รับสิทธิ์ {formatBangkok(claim.claimedAt)} น. · บัญชี #{claim.userId}</p></div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${claim.spentAt ? "bg-sky-50 text-sky-800" : claim.revokedAt ? "bg-rose-50 text-rose-800" : "bg-emerald-50 text-emerald-800"}`}>{claim.spentAt ? "ใช้หมุนแล้ว" : claim.revokedAt ? "ยกเลิกแล้ว" : globalUnavailableReason ? "ยังไม่ใช้ · ใช้ไม่ได้ขณะนี้" : "ยังไม่ใช้"}</span>
            </div>
            {claim.spentAt && <p className="mt-2 text-xs text-zinc-600">ใช้หมุน {formatBangkok(claim.spentAt)} น. · ไม่สามารถยกเลิกสิทธิ์นี้</p>}
            {claim.revokedAt && <p className="mt-2 text-xs text-zinc-700">ยกเลิก {formatBangkok(claim.revokedAt)} น. โดย Admin #{claim.revokedBy} · เหตุผล: {claim.revocationReason}</p>}
            {!claim.spentAt && !claim.revokedAt && <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
              <label className="min-w-0 flex-1 text-xs font-medium text-zinc-700">เหตุผลยกเลิกเฉพาะรายการนี้<input className="input mt-1" maxLength={500} value={revocationReasons[claim.id] ?? ""} onChange={(event) => { setRevocationReasons((current) => ({ ...current, [claim.id]: event.target.value })); setConfirmClaimId(null); }} disabled={Boolean(pendingRevocation)} /></label>
              <button type="button" className="btn btn-secondary" disabled={revocationBusy || Boolean(pendingRevocation && pendingRevocation.claimId !== claim.id)} onClick={() => void revokeClaim(claim)}>{pendingRevocation?.claimId === claim.id ? "ตรวจคำขอเดิม" : confirmClaimId === claim.id ? "ยืนยันยกเลิกสิทธิ์" : "ยกเลิกสิทธิ์"}</button>
              {confirmClaimId === claim.id && !pendingRevocation && <button type="button" className="btn btn-secondary" onClick={() => setConfirmClaimId(null)}>ไม่ยกเลิก</button>}
            </div>}
          </div>)}
          {!claimLoading && claims?.items.length === 0 && <p className="py-6 text-center text-sm text-zinc-600">ยังไม่มีผู้รับสิทธิ์จาก QR ใบนี้</p>}
        </div>
        {claims && claims.pagination.totalPages > 1 && <div className="mt-4 flex flex-wrap items-center gap-3 text-sm"><button className="btn btn-secondary" disabled={claimPage <= 1 || claimLoading} onClick={() => setClaimPage(claimPage - 1)}>ก่อนหน้า</button><span>หน้า {claimPage} / {claims.pagination.totalPages} · ทั้งหมด {claims.pagination.total}</span><button className="btn btn-secondary" disabled={claimPage >= claims.pagination.totalPages || claimLoading} onClick={() => setClaimPage(claimPage + 1)}>ถัดไป</button></div>}
      </section>}

      <section className="card" aria-labelledby="day-audit-heading">
        <h2 id="day-audit-heading" className="text-lg font-semibold text-zinc-900">ประวัติแก้ช่วงเวลา</h2>
        <div className="mt-3 space-y-2">{(dayChanges?.items ?? []).map((change) => <div key={change.id} className="rounded-lg bg-zinc-50 p-3 text-sm"><p className="font-semibold">{formatBangkok(change.createdAt)} · Admin #{change.actorId}</p><p className="mt-1">{change.before ? `${formatBangkok(change.before.startAt)}–${formatBangkok(change.before.endAt)} → ` : "สร้าง → "}{formatBangkok(change.after.startAt)}–{formatBangkok(change.after.endAt)}</p><p className="mt-1 text-zinc-600">{change.reason || "สร้างช่วงเวลา"}</p></div>)}{dayChanges?.items.length === 0 && <p className="text-sm text-zinc-600">ยังไม่มีประวัติ</p>}</div>
        {dayChanges && dayChanges.pagination.totalPages > 1 && <div className="mt-4 flex items-center gap-3 text-sm"><button className="btn btn-secondary" disabled={changePage <= 1} onClick={() => setChangePage(changePage - 1)}>ก่อนหน้า</button><span>หน้า {changePage} / {dayChanges.pagination.totalPages}</span><button className="btn btn-secondary" disabled={changePage >= dayChanges.pagination.totalPages} onClick={() => setChangePage(changePage + 1)}>ถัดไป</button></div>}
      </section>
    </>}
    {projectionId && <QrProjection token={token} eventId={eventId} qrId={projectionId} onClose={() => setProjectionId(null)} />}
  </div>;
}
