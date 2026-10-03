"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  IconAlertTriangle,
  IconLoader2,
  IconPlayerPause,
  IconPlayerPlay,
  IconRefresh,
} from "@tabler/icons-react";
import toast from "react-hot-toast";
import { AdminLayout } from "@/components/layout";
import { Pagination } from "@/components/common";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import type {
  AdminWheelSpinsResponse,
  AdminWheelState,
  WheelSegmentState,
} from "@/types/lucky-wheel";
import { WheelConfiguration } from "@/components/lucky-wheel/WheelConfiguration";
import { StockAdjustmentDialog } from "@/components/lucky-wheel/StockAdjustmentDialog";
import { RewardCollection } from "@/components/lucky-wheel/RewardCollection";
import { QrRights } from "@/components/lucky-wheel/QrRights";

type EventOption = { id: number; name: string };
type Tab = "configuration" | "rights" | "stock" | "results";

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
          return [{ id: event.id, name: event.eventName }];
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
    try {
      const next = await api.luckyWheel.getState(token, eventId);
      setState(next);
    } catch (error) {
      setState(null);
      setStateError(error instanceof Error ? error.message : "โหลดสถานะวงล้อไม่สำเร็จ");
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
    setPage(1);
    if (eventId) void loadState();
  }, [eventId, loadState]);

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
      <div className="space-y-6">
        <div className="card">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 flex-1">
              <label className="text-sm font-medium text-zinc-700">
                Event
                <select
                  className="input mt-1 max-w-xl"
                  value={eventId ?? ""}
                  onChange={(event) => setEventId(event.target.value ? Number(event.target.value) : null)}
                >
                  <option value="">เลือก Event</option>
                  {events.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}
                </select>
              </label>
            </div>
            {state && (
              <div className="flex flex-wrap items-end gap-2">
                <label className="text-sm font-medium text-zinc-700">
                  เหตุผล {state.wheel.paused ? "เปิด" : "พัก"}วงล้อ
                  <input className="input mt-1 w-64" value={pauseReason} onChange={(event) => setPauseReason(event.target.value)} />
                </label>
                <button type="button" className="btn btn-secondary" disabled={pauseBusy || !pauseReason.trim()} onClick={() => void togglePause()}>
                  {pauseBusy ? <IconLoader2 size={17} className="animate-spin" /> : state.wheel.paused ? <IconPlayerPlay size={17} /> : <IconPlayerPause size={17} />}
                  {state.wheel.paused ? "เปิดวงล้อ" : "พักวงล้อ"}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => void loadState()}>
                  <IconRefresh size={17} /> รีโหลด
                </button>
              </div>
            )}
          </div>
          {state && (
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <span className={`rounded-full px-2.5 py-1 font-medium ${state.wheel.paused ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>
                {state.wheel.paused ? "Paused" : state.wheel.enabled ? "Active" : "Not active"}
              </span>
              <span className="rounded-full bg-zinc-100 px-2.5 py-1 font-medium text-zinc-700">Version {state.wheel.version}</span>
              <span className="rounded-full bg-zinc-100 px-2.5 py-1 font-medium text-zinc-700">Pool {state.wheel.poolRevision}</span>
            </div>
          )}
        </div>

        {!eventId ? (
          <div className="card py-14 text-center text-zinc-500">เลือก Event เพื่อจัดการ Lucky Wheel</div>
        ) : loading && !state ? (
          <div className="card flex justify-center py-16"><IconLoader2 className="animate-spin text-emerald-600" /></div>
        ) : stateError ? (
          <div className="card flex gap-3 text-amber-800" role="alert">
            <IconAlertTriangle className="shrink-0" />
            <div><p className="font-semibold">ยังโหลดวงล้อไม่ได้</p><p className="mt-1 text-sm">{stateError}</p></div>
          </div>
        ) : state ? (
          <>
            <div className="flex gap-1 overflow-x-auto border-b border-zinc-200">
              {([
                ["configuration", "การตั้งค่า"],
                ["rights", "วันและ QR สิทธิ์"],
                ["stock", "สต็อกและ Audit"],
                ["results", "ผลและรับของ"],
              ] as Array<[Tab, string]>).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-current={tab === value ? "page" : undefined}
                  className={`min-h-11 whitespace-nowrap border-b-2 px-4 text-sm font-semibold transition ${tab === value ? "border-emerald-600 text-emerald-700" : "border-transparent text-zinc-500 hover:text-zinc-900"}`}
                  onClick={() => setTab(value)}
                >
                  {label}
                </button>
              ))}
            </div>

            {tab === "configuration" && (
              <div className="card">
                <WheelConfiguration eventId={eventId} token={token ?? ""} state={state} onReload={loadState} />
              </div>
            )}

            {tab === "rights" && <QrRights token={token ?? ""} eventId={eventId} wheelState={state} />}

            {tab === "stock" && (
              <div className="space-y-5">
                <div className="card">
                  <div className="mb-4">
                    <h2 className="text-lg font-semibold text-zinc-900">สต็อกของรางวัล</h2>
                    <p className="mt-1 text-sm text-zinc-500">
                      Available = ของที่ยังสุ่มได้ · Allocated = รางวัลที่ถูกจัดสรรแล้ว · Collected = รางวัลที่ยืนยันส่งมอบแล้ว
                    </p>
                  </div>
                  <div className="overflow-x-auto">
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
                                <button className="btn btn-secondary" onClick={() => setStockTarget({ segment, mode: "add" })}>เพิ่ม</button>
                                <button className="btn btn-secondary" disabled={(segment.remaining ?? 0) === 0} onClick={() => setStockTarget({ segment, mode: "reduce" })}>ลด</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
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
                <div className="card">
                  <div className="grid gap-3 md:grid-cols-3">
                    <label className="text-sm font-medium text-zinc-700">
                      วันที่เล่น
                      <input type="date" className="input mt-1" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} />
                    </label>
                    <label className="text-sm font-medium text-zinc-700">
                      รางวัล
                      <select className="input mt-1" value={segmentFilter} onChange={(event) => setSegmentFilter(event.target.value)}>
                        <option value="">ทั้งหมด</option>
                        {state.segments.map((segment) => <option key={segment.id} value={segment.id}>{segment.name.th}</option>)}
                      </select>
                    </label>
                    <label className="text-sm font-medium text-zinc-700">
                      สถานะรับของ
                      <select className="input mt-1" value={claimFilter} onChange={(event) => setClaimFilter(event.target.value)}>
                        <option value="">ทั้งหมด</option>
                        <option value="open">ยังไม่รับของ</option>
                        <option value="redeemed">รับของแล้ว</option>
                        <option value="none">ไม่มี claim</option>
                      </select>
                    </label>
                  </div>
                  <div className="mt-4 overflow-x-auto">
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
                    {spins && spins.spins.length === 0 && <p className="py-12 text-center text-sm text-zinc-500">ไม่พบผลตามตัวกรอง</p>}
                  </div>
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
