"use client";

import { useEffect, useState } from "react";
import { IconGift, IconLoader2, IconRefresh } from "@tabler/icons-react";
import { AdminLayout } from "@/components/layout";
import { RewardCollection } from "@/components/lucky-wheel/RewardCollection";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";

type EventOption = { id: number; name: string };

export default function RewardCollectionPage() {
  const { token, user } = useAuth();
  const allowedRole = user?.role === "admin" || user?.role === "staff";
  const [events, setEvents] = useState<EventOption[]>([]);
  const [eventId, setEventId] = useState<number | null>(null);
  const [access, setAccess] = useState<{ eventId: number; role: "admin" | "staff"; token: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!token || !allowedRole) return;
    let active = true;
    void api.backofficeEvents.list(token, "limit=100").then(({ events: rows }) => {
      if (!active) return;
      const options = rows.flatMap((event) => typeof event.id === "number" && typeof event.eventName === "string"
        ? [{ id: event.id, name: event.eventName }] : []);
      setEvents(options);
      const requested = new URLSearchParams(window.location.search).get("eventId");
      if (requested && !options.some((event) => event.id === Number(requested))) {
        setEventId(null);
        setError("ไม่พบ Event หรือคุณไม่มีสิทธิ์ส่งมอบรางวัลใน Event นี้");
        return;
      }
      setEventId((current) => current && options.some((event) => event.id === current)
        ? current : requested ? Number(requested) : options[0]?.id ?? null);
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : "โหลด Event ไม่สำเร็จ");
    }).finally(() => {
      if (active) setLoadingEvents(false);
    });
    return () => { active = false; };
  }, [token, allowedRole, attempt]);

  useEffect(() => {
    if (!token || !eventId || !allowedRole) return;
    let active = true;
    void api.luckyWheel.collectionAccess(token, eventId).then((result) => {
      if (active) setAccess({ ...result, token });
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : "ไม่สามารถตรวจสอบสิทธิ์ได้");
    });
    return () => { active = false; };
  }, [token, eventId, allowedRole, attempt]);

  const authorized = allowedRole && access?.eventId === eventId && access?.token === token;

  return (
    <AdminLayout title="ส่งมอบรางวัล">
      <div className="mx-auto max-w-[1320px] space-y-6 pb-12">
        <header className="card flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-start gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><IconGift size={25} stroke={1.5} /></span>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl">จุดส่งมอบรางวัล</h1>
              <p className="mt-2 text-sm leading-6 text-zinc-600">เลือก Event แล้วตรวจรางวัลกับผู้มารับก่อนยืนยันส่งมอบ</p>
            </div>
          </div>
          {allowedRole && <label className="block text-xs font-semibold text-zinc-600 sm:w-72">
            Event ที่กำลังส่งมอบ
            <select className="input-field mt-2 min-h-11" value={eventId ?? ""} disabled={loadingEvents} onChange={(event) => {
              setAccess(null);
              setError(null);
              setEventId(event.target.value ? Number(event.target.value) : null);
              window.history.replaceState(null, "", event.target.value ? `?eventId=${event.target.value}` : "/reward-collection");
            }}>
              <option value="">เลือก Event</option>
              {events.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}
            </select>
          </label>}
        </header>

        {!allowedRole ? <p role="alert" className="card text-sm text-rose-700">หน้านี้สำหรับ Admin และเจ้าหน้าที่ประจำ Event เท่านั้น</p>
          : error ? <div className="card space-y-4"><p role="alert" className="text-sm text-rose-700">{error}</p><button type="button" className="btn-secondary gap-2" onClick={() => { setAccess(null); setError(null); setLoadingEvents(true); setAttempt((value) => value + 1); }}><IconRefresh size={17} /> ลองอีกครั้ง</button></div>
          : authorized && token ? <div className="card"><RewardCollection key={eventId} eventId={access!.eventId} token={token} canCorrect={access!.role === "admin"} /></div>
          : loadingEvents || eventId ? <div role="status" className="card flex min-h-48 items-center justify-center gap-3 text-sm text-zinc-600"><IconLoader2 className="animate-spin" size={22} /> กำลังตรวจสอบสิทธิ์ส่งมอบรางวัล…</div>
          : <p className="card text-center text-sm text-zinc-600">{events.length ? "เลือก Event เพื่อเริ่มส่งมอบรางวัล" : "ไม่มี Event ที่ได้รับมอบหมาย"}</p>}
      </div>
    </AdminLayout>
  );
}
