'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { useAuth, type AssignedEvent } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { selectablePosterIds } from '@/lib/posterUi';
import type { PosterBatchDto, PosterListDto, PosterListRow, PosterSettingsHistoryDto } from '@/types/posters';
import { PosterTable, progressLabels, matchLabels, mailLabels, thaiTime } from '@/components/posters/PosterTable';
import { PosterEmailDialog } from '@/components/posters/PosterEmailDialog';
import { PosterManagementDialog } from '@/components/posters/PosterManagementDialog';
import { PosterSnapshot } from '@/components/posters/PosterDialog';

export default function PostersPage() {
  const { user, token, isAdmin, currentEvent, isLoading } = useAuth();
  const [events, setEvents] = useState<AssignedEvent[]>([]);
  const [eventError, setEventError] = useState<string | null>(null);
  const [eventChoice, setEventChoice] = useState<number | null>(null);
  const [loaded, setLoaded] = useState<{ scope: string; data: PosterListDto } | null>(null);
  const [history, setHistory] = useState<PosterSettingsHistoryDto | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<'verify' | 'notifications' | 'received'>('verify');
  const [search, setSearch] = useState('');
  const [round, setRound] = useState('');
  const [presentationType, setPresentationType] = useState('');
  const [status, setStatus] = useState('');
  const [matchState, setMatchState] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [verifyRow, setVerifyRow] = useState<PosterListRow | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [emailKind, setEmailKind] = useState<'initial' | 'reminder' | null>(null);
  const [batch, setBatch] = useState<{ eventId: number; id: string; queued: number; result?: PosterBatchDto } | null>(null);
  const [batchBusy, setBatchBusy] = useState(false);
  const [rechecking, setRechecking] = useState(false);
  const recheckKey = useRef<string | null>(null);
  const recheckLock = useRef(false);
  const readable = !!user && ['admin', 'organizer', 'reviewer'].includes(user.role);
  useEffect(() => {
    let current = true;
    setEvents([]); setEventError(null);
    if (!readable || !token) return;
    if (isAdmin) api.events.list().then(result => { if (current) setEvents(result.events.filter(event => event.eventCode === 'PRIS-2026').map(event => ({ id: event.id, code: event.eventCode, name: event.eventName }))); })
      .catch(error => { if (current) setEventError(error instanceof Error ? error.message : 'โหลด Event ไม่สำเร็จ'); });
    else setEvents(user!.assignedEvents.filter(event => event.code === 'PRIS-2026'));
    return () => { current = false; };
  }, [isAdmin, user, token, readable]);
  const eventId = events.find(event => event.id === eventChoice)?.id ?? events.find(event => event.id === currentEvent?.id)?.id ?? events[0]?.id;
  const scope = `${eventId}:${page}:${tab}:${search}:${round}:${presentationType}:${status}:${matchState}`;
  const selectionScope = useRef(scope);
  // Clear synchronously for rendering/handlers as well as after the scope changes.
  const visibleSelected = useMemo(() => selectionScope.current === scope ? selected : new Set<number>(), [scope, selected]);
  const abstractIds = useMemo(() => Array.from(visibleSelected), [visibleSelected]);
  const data = loaded?.scope === scope ? loaded.data : null;
  useEffect(() => {
    selectionScope.current = scope; setSelected(new Set()); setEmailKind(null); setVerifyRow(null); setSettingsOpen(false);
  }, [scope]);
  useEffect(() => { setBatch(null); setPage(1); recheckKey.current = null; }, [eventId]);
  useEffect(() => {
    let current = true;
    setLoaded(null); setHistory(null); setError(null);
    if (!eventId || !token || !readable) return;
    const query = new URLSearchParams({ page: String(page), pageSize: '25', search });
    for (const [key, value] of Object.entries({ round, presentationType, status, matchState })) if (value) query.set(key, value);
    api.posters.list(eventId, query, token).then(result => { if (current) setLoaded({ scope, data: result.data }); }).catch(error => { if (current) setError(error instanceof Error ? error.message : 'โหลดรายชื่อไม่สำเร็จ'); });
    api.posters.getSettings(eventId, token).then(result => { if (current) setHistory(result.data); }).catch(error => { if (current) setError(error instanceof Error ? error.message : 'โหลดประวัติไม่สำเร็จ'); });
    return () => { current = false; };
  }, [eventId, token, readable, page, search, round, presentationType, status, matchState, refresh, scope]);
  const manage = isAdmin && data?.capabilities.manage === true;
  const reload = () => { setSelected(new Set()); setRefresh(value => value + 1); };
  const toggle = (id: number) => {
    if (!manage || selectionScope.current !== scope || !data?.items.some(row => row.abstractId === id && row.canNotify)) return;
    setSelected(old => { const next = new Set(old); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };
  const recheck = async () => {
    if (!manage || !eventId || !token || recheckLock.current) return;
    recheckLock.current = true; setRechecking(true);
    recheckKey.current ??= crypto.randomUUID();
    try { await api.posters.recheck(eventId, recheckKey.current, token); recheckKey.current = null; reload(); }
    catch (error) { setError(error instanceof Error ? error.message : 'ตรวจซ้ำไม่สำเร็จ'); }
    finally { recheckLock.current = false; setRechecking(false); }
  };
  const refreshBatch = async () => {
    if (!batch || !token || batchBusy) return;
    const requested = batch; setBatchBusy(true);
    try { const result = await api.posters.batchResult(requested.eventId, requested.id, token); setBatch(current => current?.id === requested.id && current.eventId === requested.eventId ? { ...current, result: result.data } : current); }
    catch (error) { setError(error instanceof Error ? error.message : 'โหลดผลส่งไม่สำเร็จ'); }
    finally { setBatchBusy(false); }
  };
  const filter = (setter: (value: string) => void, value: string) => { setter(value); setPage(1); };
  return <AdminLayout title="Poster · PRIS 2026"><div className="space-y-6">
    <div><h1 className="text-3xl font-semibold tracking-tight">Poster · PRIS 2026</h1><p className="mt-2 text-zinc-500">ตรวจรายชื่อ ติดตามการส่ง และอีเมลรายผลงาน</p></div>
    {isLoading ? <p role="status">กำลังโหลดสิทธิ์…</p> : !readable ? <p role="alert">ไม่มีสิทธิ์เข้าถึง Poster</p> : <>
      {eventError && <p role="alert" className="text-red-700">{eventError}</p>}
      {events.length === 0 ? <p role="status">ไม่พบ Event PRIS-2026 ที่มีสิทธิ์เข้าถึง</p> : <>
        <label className="block max-w-md">Event<select className="input-field mt-2" value={eventId ?? ''} onChange={event => setEventChoice(Number(event.target.value))}>{events.map(event => <option key={event.id} value={event.id}>{event.code} · {event.name}</option>)}</select></label>
        <nav aria-label="มุมมอง Poster" className="flex flex-wrap gap-2 border-b border-zinc-200 pb-4">{([['verify', 'ตรวจรายชื่อ'], ['notifications', 'ติดตามและอีเมล'], ['received', 'Poster ที่ได้รับ']] as const).map(([value, label]) => <button key={value} className={tab === value ? 'btn-primary' : 'btn-secondary'} aria-current={tab === value ? 'page' : undefined} onClick={() => { setTab(value); setPage(1); }}>{label}</button>)}</nav>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6"><label>ค้นหา<input className="input-field mt-1" maxLength={500} value={search} placeholder="รหัส / ชื่อ / อีเมล" onChange={event => filter(setSearch, event.target.value)} /></label><label>Round<select className="input-field mt-1" value={round} onChange={event => filter(setRound, event.target.value)}><option value="">ทุก Round</option><option value="1">Round 1</option><option value="2">Round 2</option></select></label><label>ประเภทประกาศ<select className="input-field mt-1" value={presentationType} onChange={event => filter(setPresentationType, event.target.value)}><option value="">ทุกประเภท</option><option value="poster">Poster</option><option value="highlighted-poster">Highlighted Poster</option></select></label><label>ผลตรวจ<select className="input-field mt-1" value={matchState} onChange={event => filter(setMatchState, event.target.value)}><option value="">ทุกผลตรวจ</option>{Object.entries(matchLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>สถานะ Poster<select className="input-field mt-1" value={status} onChange={event => filter(setStatus, event.target.value)}><option value="">ทุกสถานะ</option>{Object.entries(progressLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><button className="btn-secondary self-end" onClick={reload}>โหลดข้อมูลใหม่</button></div>
        {error && <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-700">{error}</p>}
        {notice && <p role="status" className="rounded-lg bg-amber-50 p-4 text-amber-800">{notice}</p>}
        {data ? <>
          <div className="flex flex-wrap gap-4 text-sm text-zinc-600">{Object.entries(data.counts).map(([value, count]) => <span key={value}>{progressLabels[value as keyof typeof progressLabels]} <strong className="text-zinc-900">{count}</strong></span>)}</div>
          {manage && tab === 'verify' && <button className="btn-secondary" disabled={rechecking} onClick={recheck}>{rechecking ? 'กำลังตรวจ…' : 'ตรวจรายชื่อซ้ำ'}</button>}
          {manage && tab === 'notifications' && <div className="flex flex-wrap items-center gap-3"><button className="btn-secondary" onClick={() => setSelected(new Set(selectablePosterIds(data.items)))}>เลือกที่แจ้งได้ในหน้านี้</button><button className="btn-secondary" onClick={() => setSelected(new Set())}>ล้างที่เลือก</button><span>{abstractIds.length} ผลงาน / {abstractIds.length} อีเมล</span><button className="btn-primary" disabled={!abstractIds.length} onClick={() => setEmailKind('initial')}>ตัวอย่างแจ้งส่ง</button><button className="btn-secondary" disabled={!abstractIds.length} onClick={() => setEmailKind('reminder')}>ตัวอย่างเตือนส่ง</button></div>}
          <PosterTable rows={data.items} manage={manage} selected={visibleSelected} onSelect={toggle} onVerify={setVerifyRow} eventId={eventId!} view={tab} closesAt={data.settings.closesAt} />
          <div className="flex items-center justify-between"><p className="text-sm text-zinc-500">{data.total} รายการ · หน้า {page} / {Math.max(1, Math.ceil(data.total / data.pageSize))}</p><div className="flex gap-2"><button className="btn-secondary" disabled={page === 1} onClick={() => setPage(value => value - 1)}>ก่อนหน้า</button><button className="btn-secondary" disabled={page * data.pageSize >= data.total} onClick={() => setPage(value => value + 1)}>ถัดไป</button></div></div>
        </> : <p role="status">กำลังโหลดรายชื่อ…</p>}
        {batch && <section className="card"><h2 className="font-semibold">สร้างงานอีเมลแล้ว {batch.queued} งาน</h2><p className="my-2 text-sm text-zinc-500">รอผู้ให้บริการรับงาน ไม่ใช่การยืนยันว่าอีเมลถึงผู้รับ · {batch.id}</p><button className="btn-secondary" disabled={batchBusy} onClick={refreshBatch}>โหลดผลส่งล่าสุด</button><ul className="mt-3 space-y-2">{batch.result?.jobs.map(job => <li key={job.id}>{job.abstractId} · {job.recipient} · {mailLabels[job.state]} {job.errorCode}</li>)}</ul></section>}
        {history && <section className="card space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">กำหนดส่งและประวัติ (Asia/Bangkok)</h2>{manage && history.capabilities.manage && <button className="btn-secondary" onClick={() => setSettingsOpen(true)}>เปลี่ยนกำหนดส่ง</button>}</div><p>วันสุดท้าย: {thaiTime(new Date(Date.parse(history.settings.closesAt) - 1000).toISOString())} · รุ่น {history.settings.version}</p><details><summary className="cursor-pointer text-emerald-700">ประวัติการเปลี่ยนกำหนดส่ง ({history.history.length})</summary><ul className="mt-4 space-y-4">{history.history.map(item => <li key={item.id} className="border-t border-zinc-200 pt-3"><p>{thaiTime(item.createdAt)} · ผู้เปลี่ยน {item.actorId ?? 'ระบบ'} · {item.reason ?? '—'}</p><div className="mt-3 grid gap-4 sm:grid-cols-2"><div><h3>เดิม</h3><PosterSnapshot value={item.before} /></div><div><h3>ใหม่</h3><PosterSnapshot value={item.after} /></div></div></li>)}</ul></details></section>}
        {manage && eventId && token && emailKind && <PosterEmailDialog eventId={eventId} token={token} kind={emailKind} abstractIds={abstractIds} onClose={() => setEmailKind(null)} onQueued={(id, queued) => { setBatch({ eventId, id, queued }); reload(); }} />}
        {manage && eventId && token && data && (verifyRow || settingsOpen) && <PosterManagementDialog eventId={eventId} token={token} row={verifyRow ?? undefined} settings={history?.settings ?? data.settings} onClose={() => { setVerifyRow(null); setSettingsOpen(false); }} onSaved={stale => { if (stale) setNotice('ข้อมูลเปลี่ยนแล้ว โหลดข้อมูลล่าสุด กรุณาตรวจและเปิดแบบฟอร์มใหม่'); reload(); }} />}
      </>}
    </>}
  </div></AdminLayout>;
}
