"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  IconAlertTriangle,
  IconAdjustmentsHorizontal,
  IconCalendarEvent,
  IconChartBar,
  IconGift,
  IconLoader2,
  IconPlayerPause,
  IconPlayerPlay,
  IconQrcode,
  IconRefresh,
} from "@tabler/icons-react";
import toast from "react-hot-toast";
import { AdminLayout } from "@/components/layout";
import { Pagination } from "@/components/common";
import { useAuth } from "@/contexts/AuthContext";
import { api, ApiError } from "@/lib/api";
import type {
  AdminWheelSpinsResponse,
  AdminWheelState,
  WheelSegmentState,
} from "@/types/lucky-wheel";
import { WheelConfiguration } from "@/components/lucky-wheel/WheelConfiguration";
import { StockAdjustmentDialog } from "@/components/lucky-wheel/StockAdjustmentDialog";
import { RewardCollection } from "@/components/lucky-wheel/RewardCollection";
import { QrRights } from "@/components/lucky-wheel/QrRights";

type EventOption = { id: number; name: string; code: string };
type MainSession = { id: number; name: string; startTime: string; endTime: string };
type Tab = "configuration" | "rights" | "stock" | "results";

const tabs = [
  { value: "configuration", label: "ตั้งค่าวงล้อ", hint: "รางวัลและจุดรับของ", Icon: IconAdjustmentsHorizontal },
  { value: "rights", label: "วันและ QR", hint: "เวลาและสิทธิ์หมุน", Icon: IconQrcode },
  { value: "stock", label: "สต็อก", hint: "ยอดคงเหลือและประวัติ", Icon: IconGift },
  { value: "results", label: "ผลและรับของ", hint: "ผลหมุนและส่งมอบ", Icon: IconChartBar },
] as const;

const formatBangkok = (value: string) =>
  new Date(value).toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok",
    dateStyle: "medium",
    timeStyle: "short",
  });

function snapshotNumber(value: unknown, key: string): number | null {
  if (!value || typeof value !== "object") return null;
  const current = (value as Record<string, unknown>)[key];
  return typeof current === "number" ? current : null;
}

export default function LuckyWheelAdminPage() {
  const { token, isAdmin } = useAuth();
  const [events, setEvents] = useState<EventOption[]>([]);
  const [eventId, setEventId] = useState<number | null>(null);
  const [state, setState] = useState<AdminWheelState | null>(null);
  const [spins, setSpins] = useState<AdminWheelSpinsResponse | null>(null);
  const [tab, setTab] = useState<Tab>("configuration");
  const [loading, setLoading] = useState(false);
  const [stateError, setStateError] = useState<string | null>(null);
  const [uninitialized, setUninitialized] = useState(false);
  const [mainSession, setMainSession] = useState<MainSession | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [setupBusy, setSetupBusy] = useState(false);
  const [pauseReason, setPauseReason] = useState("");
  const [pauseBusy, setPauseBusy] = useState(false);
  const [stockTarget, setStockTarget] = useState<{
    segment: WheelSegmentState;
    mode: "add" | "reduce";
  } | null>(null);

  const [dateFilter, setDateFilter] = useState("");
  const [segmentFilter, setSegmentFilter] = useState("");
  const [claimFilter, setClaimFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  useEffect(() => {
    if (!token || !isAdmin) return;
    void api.backofficeEvents
      .list(token, "limit=100")
      .then((response) => {
        const options = (response.events || []).flatMap((event) => {
          if (typeof event.id !== "number" || typeof event.eventName !== "string") return [];
          return [{ id: event.id, name: event.eventName, code: typeof event.eventCode === "string" ? event.eventCode : "" }];
        });
        setEvents(options);
        setEventId((current) => current ?? options[0]?.id ?? null);
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : "โหลด Event ไม่สำเร็จ"));
  }, [token, isAdmin]);

  const loadState = useCallback(async () => {
    if (!token || !eventId) return;
    setLoading(true);
    setStateError(null);
    setUninitialized(false);
    try {
      const next = await api.luckyWheel.getState(token, eventId);
      setState(next);
    } catch (error) {
      setState(null);
      if (error instanceof ApiError && error.code === "WHEEL_NOT_FOUND") {
        setUninitialized(true);
      } else {
        setStateError(error instanceof Error ? error.message : "โหลดสถานะวงล้อไม่สำเร็จ");
      }
    } finally {
      setLoading(false);
    }
  }, [token, eventId]);

  const loadSpins = useCallback(async () => {
    if (!token || !eventId) return;
    const query = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    if (dateFilter) query.set("date", dateFilter);
    if (segmentFilter) query.set("segmentId", segmentFilter);
    if (claimFilter) query.set("claimStatus", claimFilter);
    try {
      setSpins(await api.luckyWheel.listSpins(token, eventId, query));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "โหลดผลการหมุนไม่สำเร็จ");
    }
  }, [token, eventId, page, pageSize, dateFilter, segmentFilter, claimFilter]);

  useEffect(() => {
    setState(null);
    setSpins(null);
    setUninitialized(false);
    setMainSession(null);
    setSetupError(null);
    setPage(1);
    if (eventId) void loadState();
  }, [eventId, loadState]);

  const selectedEvent = events.find((event) => event.id === eventId);
  useEffect(() => {
    if (!token || !eventId || !uninitialized || selectedEvent?.code !== "PRIS-2026") return;
    let active = true;
    void api.backofficeEvents.getSessions(token, eventId)
      .then(({ sessions }) => {
        if (!active) return;
        const choices = sessions.flatMap((session) => {
          if (
            typeof session.id !== "number" ||
            typeof session.sessionName !== "string" ||
            typeof session.startTime !== "string" ||
            typeof session.endTime !== "string" ||
            !("isMainSession" in session && session.isMainSession === true) ||
            session.isActive !== true ||
            new Date(session.startTime).getTime() >= new Date(session.endTime).getTime()
          ) return [];
          return [{ id: session.id, name: session.sessionName, startTime: session.startTime, endTime: session.endTime }];
        });
        setMainSession(choices.length === 1 ? choices[0] : null);
        setSetupError(choices.length === 1 ? null : "ต้องมี Main Session ที่เปิดใช้งานเพียงรายการเดียวสำหรับ PRIS ก่อนสร้างวงล้อ");
      })
      .catch((error) => {
        if (active) setSetupError(error instanceof Error ? error.message : "โหลด Main Session ไม่สำเร็จ");
      });
    return () => { active = false; };
  }, [token, eventId, uninitialized, selectedEvent?.code]);

  const initialize = async () => {
    if (!token || !eventId || !mainSession || setupBusy) return;
    setSetupBusy(true);
    setSetupError(null);
    try {
      await api.luckyWheel.initialize(token, eventId, mainSession.id);
      toast.success("สร้างวงล้อแล้ว กิจกรรมยังปิดอยู่");
      await loadState();
    } catch (error) {
      if (error instanceof ApiError && error.code === "WHEEL_UPDATED") {
        await loadState();
      } else {
        setSetupError(error instanceof Error ? error.message : "สร้างวงล้อไม่สำเร็จ");
      }
    } finally {
      setSetupBusy(false);
    }
  };

  useEffect(() => {
    if (eventId) void loadSpins();
  }, [eventId, loadSpins]);

  useEffect(() => setPage(1), [dateFilter, segmentFilter, claimFilter]);

  const prizeSegments = useMemo(
    () => state?.segments.filter((segment) => segment.kind === "prize") ?? [],
    [state?.segments],
  );

  const togglePause = async () => {
    if (!token || !eventId || !state || !pauseReason.trim()) {
      toast.error("กรอกเหตุผลก่อนเปลี่ยนสถานะพักวงล้อ");
      return;
    }
    setPauseBusy(true);
    try {
      await api.luckyWheel.setPaused(token, eventId, {
        paused: !state.wheel.paused,
        reason: pauseReason.trim(),
        idempotencyKey: crypto.randomUUID(),
      });
      setPauseReason("");
      toast.success(state.wheel.paused ? "เปิดวงล้อแล้ว" : "พักวงล้อแล้ว");
      await loadState();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "เปลี่ยนสถานะวงล้อไม่สำเร็จ");
    } finally {
      setPauseBusy(false);
    }
  };

  if (!isAdmin) {
    return (
      <AdminLayout title="Lucky Wheel">
        <div className="card text-sm text-rose-700">หน้านี้สำหรับ Admin เท่านั้น</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Lucky Wheel">
      <div className="mx-auto max-w-[1320px] space-y-6 pb-12">
        <header className="card border border-zinc-200/80">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex max-w-2xl items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><IconGift size={25} stroke={1.5} /></span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">Event operations</p>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl">จัดการวงล้อกิจกรรม</h1>
                <p className="mt-2 text-sm leading-6 text-zinc-600">เตรียมรางวัล เปิด QR รับสิทธิ์ และติดตามผลการหมุนจากที่เดียว</p>
              </div>
            </div>
            <label className="block w-full text-xs font-semibold text-zinc-600 lg:w-72">
              Event ที่กำลังจัดการ
              <select
                className="input-field mt-2 min-h-11"
                value={eventId ?? ""}
                onChange={(event) => setEventId(event.target.value ? Number(event.target.value) : null)}
              >
                <option value="">เลือก Event</option>
                {events.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}
              </select>
            </label>
          </div>
        </header>

        {state && (
          <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)]" aria-label="สถานะกิจกรรม">
            <div className="card flex flex-col justify-between border border-zinc-200/80">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">สถานะวงล้อ</p>
                  <h2 className="mt-2 text-xl font-semibold text-zinc-950">
                    {!state.wheel.enabled ? "ยังไม่เผยแพร่" : state.wheel.paused ? "พักกิจกรรม" : "เปิดให้เล่นแล้ว"}
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-zinc-600">
                    {!state.wheel.enabled ? "ตั้งค่ารางวัลและกดบันทึกและเผยแพร่ก่อนเปิดเล่น" : state.wheel.paused ? "การรับสิทธิ์และการหมุนใหม่ถูกพักไว้" : "ผู้เข้าร่วมที่ผ่านเงื่อนไขรับสิทธิ์และหมุนได้"}
                  </p>
                </div>
                <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${!state.wheel.enabled ? "bg-zinc-100 text-zinc-700" : state.wheel.paused ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>
                  {!state.wheel.enabled ? "รอเผยแพร่" : state.wheel.paused ? "พักอยู่" : "กำลังเปิด"}
                </span>
              </div>
              <div className="mt-6 flex flex-wrap gap-2 border-t border-zinc-100 pt-4 text-xs font-semibold text-zinc-600">
                <span className="rounded-lg bg-zinc-100 px-3 py-2">Configuration v{state.wheel.version}</span>
                <span className="rounded-lg bg-zinc-100 px-3 py-2">Stock revision {state.wheel.poolRevision}</span>
                <span className="rounded-lg bg-zinc-100 px-3 py-2">{state.segments.length} ช่องในวงล้อ</span>
              </div>
            </div>
            <div className="card border border-zinc-200/80">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-zinc-950">ควบคุมการเปิดเล่น</h2>
                  <p className="mt-1 text-sm text-zinc-600">การเปลี่ยนสถานะต้องระบุเหตุผลทุกครั้ง</p>
                </div>
                <button type="button" className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-zinc-600 hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600" onClick={() => void loadState()}>
                  <IconRefresh size={17} /> รีโหลด
                </button>
              </div>
              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
                <label className="min-w-0 flex-1 text-sm font-medium text-zinc-700">
                  เหตุผล{state.wheel.paused ? "เปิดเล่นต่อ" : "พักกิจกรรม"}
                  <input className="input-field mt-1" value={pauseReason} onChange={(event) => setPauseReason(event.target.value)} placeholder="ระบุเหตุผลเพื่อบันทึกประวัติ" />
                </label>
                <button type="button" className="btn-secondary disabled:cursor-not-allowed disabled:opacity-50 min-h-11 shrink-0" disabled={pauseBusy || !pauseReason.trim() || (state.wheel.paused && !state.wheel.enabled)} onClick={() => void togglePause()}>
                  {pauseBusy ? <IconLoader2 size={17} className="animate-spin" /> : state.wheel.paused ? <IconPlayerPlay size={17} /> : <IconPlayerPause size={17} />}
                  {state.wheel.paused ? "เปิดเล่นต่อ" : "พักกิจกรรม"}
                </button>
              </div>
            </div>
          </section>
        )}

        {!eventId ? (
          <div className="card py-14 text-center text-zinc-500">เลือก Event เพื่อจัดการ Lucky Wheel</div>
        ) : loading && !state ? (
          <div className="card flex justify-center py-16"><IconLoader2 className="animate-spin text-emerald-600" /></div>
        ) : uninitialized ? (
          <div className="card overflow-hidden border border-zinc-200/80 p-0" role="status">
            <div className="grid md:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
              <div className="p-6 sm:p-8">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700"><IconCalendarEvent size={25} /></span>
                <p className="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">เริ่มต้นใช้งาน</p>
                <h2 className="mt-2 text-xl font-semibold text-zinc-950 sm:text-2xl">ยังไม่มีวงล้อสำหรับ {selectedEvent?.name ?? "Event นี้"}</h2>
                <p className="mt-2 max-w-lg text-sm leading-6 text-zinc-600">สร้างวงล้อเปล่าเพื่อเริ่มตั้งค่ารางวัล วงล้อจะยังปิดอยู่จนกว่าจะเผยแพร่และเปิดเล่นเอง</p>
                {setupError && <p className="mt-5 rounded-xl bg-rose-50 p-3 text-sm text-rose-700" role="alert">{setupError}</p>}
                {selectedEvent?.code === "PRIS-2026" ? <button type="button" className="btn-primary mt-6 min-h-11" disabled={!mainSession || setupBusy} onClick={() => void initialize()}>
                  {setupBusy ? <IconLoader2 size={17} className="animate-spin" /> : null}
                  สร้างวงล้อ (ยังไม่เปิดเล่น)
                </button> : <p className="mt-5 text-sm text-zinc-600">ขณะนี้สร้างวงล้อจากหน้านี้ได้เฉพาะ PRIS 2026</p>}
              </div>
              <div className="bg-zinc-50 p-6 sm:p-8">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-500">ข้อมูลที่จะผูกกับวงล้อ</p>
                <div className="mt-5 rounded-2xl border border-zinc-200 bg-white p-5">
                  <p className="text-xs font-semibold text-zinc-500">Main Session เดิม</p>
                  <p className="mt-2 font-semibold text-zinc-950">{mainSession?.name ?? "กำลังตรวจสอบ Main Session"}</p>
                  {mainSession && <p className="mt-2 text-sm leading-6 text-zinc-600">{formatBangkok(mainSession.startTime)} – {formatBangkok(mainSession.endTime)}</p>}
                </div>
                <p className="mt-4 text-sm leading-6 text-zinc-600">ขั้นถัดไป: เพิ่มช่องรางวัล ระบุจุดรับของ แล้วกด “บันทึกและเผยแพร่”</p>
              </div>
            </div>
          </div>
        ) : stateError ? (
          <div className="card flex gap-3 text-amber-800" role="alert">
            <IconAlertTriangle className="shrink-0" />
            <div><p className="font-semibold">ยังโหลดวงล้อไม่ได้</p><p className="mt-1 text-sm">{stateError}</p></div>
          </div>
        ) : state ? (
          <>
            <nav className="grid grid-cols-2 gap-2 rounded-2xl bg-zinc-100 p-2 lg:grid-cols-4" aria-label="ส่วนจัดการวงล้อ">
              {tabs.map(({ value, label, hint, Icon }) => (
                <button
                  key={value}
                  type="button"
                  aria-current={tab === value ? "page" : undefined}
                  className={`min-h-14 rounded-xl px-3 py-2 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 sm:px-4 ${tab === value ? "bg-white text-emerald-800 shadow-sm" : "text-zinc-600 hover:bg-white/70 hover:text-zinc-950"}`}
                  onClick={() => setTab(value)}
                >
                  <span className="flex items-center gap-2 text-sm font-semibold"><Icon size={18} />{label}</span>
                  <span className="mt-1 hidden pl-[26px] text-xs font-medium opacity-70 sm:block">{hint}</span>
                </button>
              ))}
            </nav>

            {tab === "configuration" && (
              <div className="card">
                <WheelConfiguration eventId={eventId} token={token ?? ""} state={state} onReload={loadState} />
              </div>
            )}

            {tab === "rights" && <QrRights token={token ?? ""} eventId={eventId} wheelState={state} />}

            {tab === "stock" && (
              <div className="space-y-5">
                <div className="card border border-zinc-200/80">
                  <div className="mb-5 flex flex-col gap-2 border-b border-zinc-100 pb-5">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">03 · Stock</p>
                    <h2 className="text-xl font-semibold tracking-tight text-zinc-950 sm:text-2xl">สต็อกของรางวัล</h2>
                    <p className="max-w-3xl text-sm leading-6 text-zinc-600">สต็อกคงเหลือแยกตามรางวัล การเพิ่มหรือลดทุกครั้งต้องมีเหตุผลและจะบันทึกประวัติ</p>
                  </div>
                  <div className="mb-5 grid gap-2 text-sm sm:grid-cols-3">
                    <div className="rounded-xl bg-emerald-50 p-3 text-emerald-950"><span className="block text-xs font-semibold">Available · สต็อกคงเหลือ</span><strong className="mt-1 block text-2xl tabular-nums">{prizeSegments.reduce((sum, segment) => sum + (segment.remaining ?? 0), 0)}</strong></div>
                    <div className="rounded-xl bg-sky-50 p-3 text-sky-950"><span className="block text-xs font-semibold">Allocated · จัดสรรแล้ว</span><strong className="mt-1 block text-2xl tabular-nums">{prizeSegments.reduce((sum, segment) => sum + segment.allocated, 0)}</strong></div>
                    <div className="rounded-xl bg-zinc-100 p-3 text-zinc-900"><span className="block text-xs font-semibold">Collected · ส่งมอบแล้ว</span><strong className="mt-1 block text-2xl tabular-nums">{prizeSegments.reduce((sum, segment) => sum + segment.collected, 0)}</strong></div>
                  </div>
                  <div className="space-y-3 md:hidden">
                    {prizeSegments.map((segment) => <article key={segment.id} className="rounded-2xl border border-zinc-200 p-4">
                      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="break-words font-semibold text-zinc-950">{segment.name.th}</h3><p className="text-xs text-zinc-500">{segment.name.en}</p></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${segment.enabled && (segment.remaining ?? 0) > 0 ? "bg-emerald-50 text-emerald-800" : "bg-zinc-100 text-zinc-600"}`}>{!segment.enabled ? "ปิดใช้งาน" : (segment.remaining ?? 0) > 0 ? "สุ่มได้" : "หมดแล้ว"}</span></div>
                      <div className="mt-4 grid grid-cols-3 gap-2 border-y border-zinc-100 py-3 text-center"><div><p className="text-xs text-zinc-500">คงเหลือ</p><p className="mt-1 text-lg font-bold tabular-nums text-zinc-950">{segment.remaining ?? 0}</p></div><div><p className="text-xs text-zinc-500">จัดสรร</p><p className="mt-1 text-lg font-bold tabular-nums text-zinc-950">{segment.allocated}</p></div><div><p className="text-xs text-zinc-500">ส่งมอบ</p><p className="mt-1 text-lg font-bold tabular-nums text-zinc-950">{segment.collected}</p></div></div>
                      <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" className="btn-secondary disabled:cursor-not-allowed disabled:opacity-50 min-h-11" onClick={() => setStockTarget({ segment, mode: "add" })}>เติมสต็อก</button><button type="button" className="btn-secondary disabled:cursor-not-allowed disabled:opacity-50 min-h-11" disabled={(segment.remaining ?? 0) === 0} onClick={() => setStockTarget({ segment, mode: "reduce" })}>ลดสต็อก</button></div>
                    </article>)}
                  </div>
                  <div className="hidden overflow-x-auto md:block">
                    <table className="w-full min-w-[760px] text-sm">
                      <thead>
                        <tr className="border-b border-zinc-200 text-left text-zinc-500">
                          <th className="py-3 pr-4">รางวัล</th>
                          <th className="py-3 pr-4">Available</th>
                          <th className="py-3 pr-4">Allocated</th>
                          <th className="py-3 pr-4">Collected</th>
                          <th className="py-3 text-right">ปรับสต็อก</th>
                        </tr>
                      </thead>
                      <tbody>
                        {prizeSegments.map((segment) => (
                          <tr key={segment.id} className="border-b border-zinc-100">
                            <td className="py-4 pr-4"><p className="font-medium text-zinc-900">{segment.name.th}</p><p className="text-xs text-zinc-500">{segment.name.en}</p></td>
                            <td className="py-4 pr-4 text-lg font-semibold tabular-nums">{segment.remaining ?? 0}</td>
                            <td className="py-4 pr-4 tabular-nums">{segment.allocated}</td>
                            <td className="py-4 pr-4 tabular-nums">{segment.collected}</td>
                            <td className="py-4 text-right">
                              <div className="flex justify-end gap-2">
                                <button type="button" className="btn-secondary disabled:cursor-not-allowed disabled:opacity-50" onClick={() => setStockTarget({ segment, mode: "add" })}>เติม</button>
                                <button type="button" className="btn-secondary disabled:cursor-not-allowed disabled:opacity-50" disabled={(segment.remaining ?? 0) === 0} onClick={() => setStockTarget({ segment, mode: "reduce" })}>ลด</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {prizeSegments.length === 0 && <p className="rounded-xl bg-zinc-50 py-10 text-center text-sm text-zinc-600">ยังไม่มีช่องของรางวัลในวงล้อ</p>}
                </div>

                <div className="card">
                  <h2 className="text-lg font-semibold text-zinc-900">Audit ล่าสุด</h2>
                  <div className="mt-4 space-y-2">
                    {state.audit.length === 0 ? (
                      <p className="py-8 text-center text-sm text-zinc-500">ยังไม่มี audit</p>
                    ) : state.audit.map((entry) => (
                      <div key={entry.id} className="grid gap-2 rounded-lg bg-zinc-50 p-3 text-sm md:grid-cols-[160px_1fr_180px]">
                        <div><p className="font-semibold text-zinc-800">{entry.operation}</p><p className="text-xs text-zinc-500">{formatBangkok(entry.createdAt)}</p></div>
                        <div>
                          <p className="text-zinc-700">{entry.reason || "-"}</p>
                          {entry.operation === "stock_adjust" && (
                            <p className="mt-1 text-xs text-zinc-500">
                              ก่อน {snapshotNumber(entry.before, "remaining") ?? "-"} → หลัง {snapshotNumber(entry.after, "remaining") ?? "-"}
                            </p>
                          )}
                        </div>
                        <p className="text-xs text-zinc-500 md:text-right">{entry.actorEmail || `Admin #${entry.actorId}`}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {tab === "results" && (
              <div className="space-y-5">
                <div className="card border border-zinc-200/80">
                  <div className="mb-5 border-b border-zinc-100 pb-5">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">04 · Results</p>
                    <h2 className="mt-2 text-xl font-semibold tracking-tight text-zinc-950 sm:text-2xl">ผลการหมุน</h2>
                    <p className="mt-2 text-sm leading-6 text-zinc-600">กรองผลตามวัน รางวัล และสถานะรับของ ก่อนตรวจรายการย้อนหลัง</p>
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    <label className="text-sm font-medium text-zinc-700">
                      วันที่เล่น
                      <input type="date" className="input-field mt-1" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} />
                    </label>
                    <label className="text-sm font-medium text-zinc-700">
                      รางวัล
                      <select className="input-field mt-1" value={segmentFilter} onChange={(event) => setSegmentFilter(event.target.value)}>
                        <option value="">ทั้งหมด</option>
                        {state.segments.map((segment) => <option key={segment.id} value={segment.id}>{segment.name.th}</option>)}
                      </select>
                    </label>
                    <label className="text-sm font-medium text-zinc-700">
                      สถานะรับของ
                      <select className="input-field mt-1" value={claimFilter} onChange={(event) => setClaimFilter(event.target.value)}>
                        <option value="">ทั้งหมด</option>
                        <option value="open">ยังไม่รับของ</option>
                        <option value="redeemed">รับของแล้ว</option>
                        <option value="none">ไม่มี claim</option>
                      </select>
                    </label>
                  </div>
                  <div className="mt-5 space-y-3 md:hidden">
                    {(spins?.spins ?? []).map((spin) => <article key={spin.id} className="rounded-2xl border border-zinc-200 p-4">
                      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="break-words font-semibold text-zinc-950">{spin.awardedName.th}</p><p className="mt-1 text-xs text-zinc-500">{formatBangkok(spin.createdAt)}</p></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${spin.claim?.status === "redeemed" ? "bg-zinc-100 text-zinc-700" : spin.claim ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>{spin.claim?.status === "redeemed" ? "รับแล้ว" : spin.claim ? "รอรับ" : "ไม่มีสิทธิ์รับของ"}</span></div>
                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-zinc-100 pt-3 text-xs text-zinc-600"><span>บัญชี #{spin.userId}</span><span>วันที่ {spin.playDate}</span><span>v{spin.configurationVersion} / p{spin.poolRevision}</span></div>
                    </article>)}
                  </div>
                  <div className="mt-4 hidden overflow-x-auto md:block">
                    <table className="w-full min-w-[920px] text-sm">
                      <thead><tr className="border-b border-zinc-200 text-left text-zinc-500"><th className="py-3 pr-4">เวลา</th><th className="py-3 pr-4">User</th><th className="py-3 pr-4">ผล</th><th className="py-3 pr-4">สถานะรับของ</th><th className="py-3">Version</th></tr></thead>
                      <tbody>
                        {(spins?.spins ?? []).map((spin) => (
                          <tr key={spin.id} className="border-b border-zinc-100">
                            <td className="py-4 pr-4">{formatBangkok(spin.createdAt)}<p className="text-xs text-zinc-500">{spin.playDate}</p></td>
                            <td className="py-4 pr-4">#{spin.userId}</td>
                            <td className="py-4 pr-4"><p className="font-medium text-zinc-900">{spin.awardedName.th}</p><p className="text-xs text-zinc-500">{spin.outcomeKind === "prize" ? "Prize" : "No prize"}</p></td>
                            <td className="py-4 pr-4">
                              {spin.claim ? (
                                <span className={`rounded-full px-2 py-1 text-xs font-medium ${spin.claim.status === "redeemed" ? "bg-zinc-100 text-zinc-700" : "bg-emerald-50 text-emerald-700"}`}>
                                  {spin.claim.status === "redeemed" ? "รับแล้ว" : "รอรับ"}
                                </span>
                              ) : <span className="text-zinc-400">—</span>}
                            </td>
                            <td className="py-4 text-xs text-zinc-500">v{spin.configurationVersion} / p{spin.poolRevision}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {spins && spins.spins.length === 0 && <p className="mt-4 rounded-xl bg-zinc-50 py-12 text-center text-sm text-zinc-600">ไม่พบผลตามตัวกรอง</p>}
                  {spins && spins.pagination.totalPages > 0 && (
                    <div className="mt-5">
                      <Pagination
                        currentPage={page}
                        totalPages={Math.max(1, spins.pagination.totalPages)}
                        totalCount={spins.pagination.total}
                        pageSize={pageSize}
                        onPageChange={setPage}
                        onPageSizeChange={(value) => { setPageSize(value); setPage(1); }}
                        itemName="spin results"
                      />
                    </div>
                  )}
                </div>

                <div className="card">
                  <RewardCollection
                    eventId={eventId}
                    token={token ?? ""}
                    onChanged={async () => {
                      await Promise.all([loadState(), loadSpins()]);
                    }}
                  />
                </div>
              </div>
            )}

            <StockAdjustmentDialog
              open={Boolean(stockTarget)}
              eventId={eventId}
              token={token ?? ""}
              segment={stockTarget?.segment ?? null}
              mode={stockTarget?.mode ?? "add"}
              onClose={() => setStockTarget(null)}
              onDone={async () => {
                await Promise.all([loadState(), loadSpins()]);
              }}
            />
          </>
        ) : null}
      </div>
    </AdminLayout>
  );
}
