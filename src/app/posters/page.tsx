'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { IconFileText, IconCheck, IconPencil, IconCircleCheck, IconSearch, IconRefresh, IconLoader2 } from '@tabler/icons-react';
import { Pagination } from '@/components/common';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { useAuth, type AssignedEvent } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { selectablePosterIds } from '@/lib/posterUi';
import type { PosterBatchDto, PosterListDto, PosterListRow, PosterSettingsHistoryDto } from '@/types/posters';
import { PosterTable, progressLabels, matchLabels, mailLabels, thaiTime } from '@/components/posters/PosterTable';
import { PosterEmailDialog } from '@/components/posters/PosterEmailDialog';
import { PosterManagementDialog } from '@/components/posters/PosterManagementDialog';
import { PosterDeadlineHistory } from '@/components/posters/PosterHistoryViews';

export default function PostersPage() {
  const { user, token, isAdmin, currentEvent, isLoading } = useAuth();
  const [events, setEvents] = useState<AssignedEvent[]>([]);
  const [eventError, setEventError] = useState<string | null>(null);
  const [eventChoice, setEventChoice] = useState<number | null>(null);
  const [loaded, setLoaded] = useState<{ scope: string; data: PosterListDto } | null>(null);
  const [history, setHistory] = useState<PosterSettingsHistoryDto | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [page, setPage] = useState(1);
  const [adminTab, setTab] = useState<'verify' | 'notifications' | 'received'>('verify');
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
  const tab = isAdmin ? adminTab : 'received';
  const scope = `${isAdmin}:${eventId}:${page}:${tab}:${search}:${round}:${presentationType}:${status}:${matchState}`;
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
    if (tab === 'received') query.set('received', 'true');
    for (const [key, value] of Object.entries({ round, presentationType, status, matchState: isAdmin ? matchState : '' })) if (value) query.set(key, value);
    api.posters.list(eventId, query, token).then(result => { if (current) setLoaded({ scope, data: result.data }); }).catch(error => { if (current) setError(error instanceof Error ? error.message : 'โหลดรายชื่อไม่สำเร็จ'); });
    if (isAdmin) api.posters.getSettings(eventId, token).then(result => { if (current) setHistory(result.data); }).catch(error => { if (current) setError(error instanceof Error ? error.message : 'โหลดประวัติไม่สำเร็จ'); });
    return () => { current = false; };
  }, [eventId, token, readable, isAdmin, tab, page, search, round, presentationType, status, matchState, refresh, scope]);
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
    if (!isAdmin || !batch || !token || batchBusy) return;
    const requested = batch; setBatchBusy(true);
    try { const result = await api.posters.batchResult(requested.eventId, requested.id, token); setBatch(current => current?.id === requested.id && current.eventId === requested.eventId ? { ...current, result: result.data } : current); }
    catch (error) { setError(error instanceof Error ? error.message : 'โหลดผลส่งไม่สำเร็จ'); }
    finally { setBatchBusy(false); }
  };
  const filter = (setter: (value: string) => void, value: string) => { setter(value); setPage(1); };
  return <AdminLayout title="Poster · PRIS 2026"><div className="space-y-6">
    <p className="text-sm text-zinc-500">{isAdmin ? 'ตรวจรายชื่อ ติดตามการส่ง และอีเมลรายผลงาน' : 'ดู Poster ที่ได้รับและประวัติคำขอแก้ไข'}</p>
    {isLoading ? <p role="status">กำลังโหลดสิทธิ์…</p> : !readable ? <p role="alert">ไม่มีสิทธิ์เข้าถึง Poster</p> : <>
      {eventError && <p role="alert" className="text-red-700">{eventError}</p>}
      {events.length === 0 ? <p role="status">ไม่พบ Event PRIS-2026 ที่มีสิทธิ์เข้าถึง</p> : <>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'ผลงานตามตัวกรอง', value: data?.total, icon: IconFileText, color: 'bg-emerald-50 text-emerald-600' },
            { label: 'Poster ที่ได้รับ', value: data ? data.total - data.counts.not_submitted : undefined, icon: IconCheck, color: 'bg-cyan-50 text-cyan-600' },
            { label: 'รอแก้ไข', value: data?.counts.revision_pending, icon: IconPencil, color: 'bg-amber-50 text-amber-600' },
            { label: 'แก้ไขแล้ว', value: data?.counts.revised, icon: IconCircleCheck, color: 'bg-blue-50 text-blue-600' },
          ].map(stat => <div key={stat.label} className="card py-4"><div className="flex items-center gap-4"><div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${stat.color}`}><stat.icon size={24} stroke={1.5} /></div><div><p className="text-2xl font-bold text-zinc-800">{stat.value ?? '—'}</p><p className="text-sm text-zinc-400">{stat.label}</p></div></div></div>)}
        </div>
        <section className="card">
          <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <h2 className="text-lg font-semibold text-zinc-800">{tab === 'received' ? 'Poster ที่ได้รับ' : tab === 'notifications' ? 'ติดตามและอีเมล' : 'รายชื่อ Poster'}</h2>
            <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto lg:min-w-[480px]">
              <div className="relative flex-1"><IconSearch size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" /><input aria-label="ค้นหา Poster" className="input-field-search w-full" maxLength={500} value={search} placeholder="ค้นหารหัส / ชื่อผลงาน / ผู้ส่ง / อีเมล" onChange={event => filter(setSearch, event.target.value)} /></div>
              <button className="btn-secondary flex items-center justify-center gap-2 whitespace-nowrap" onClick={reload}><IconRefresh size={18} />โหลดข้อมูลใหม่</button>
            </div>
          </div>
          <nav aria-label="มุมมอง Poster" className="mb-6 flex flex-wrap gap-2 border-b border-zinc-200 pb-4">{([['verify', 'ตรวจรายชื่อ'], ['notifications', 'ติดตามและอีเมล'], ['received', 'Poster ที่ได้รับ']] as const).filter(([value]) => isAdmin || value === 'received').map(([value, label]) => <button key={value} className={tab === value ? 'btn-primary' : 'btn-secondary'} aria-current={tab === value ? 'page' : undefined} onClick={() => { setTab(value); setPage(1); }}>{label}</button>)}</nav>
          <div className={`mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 ${isAdmin ? 'lg:grid-cols-5' : 'lg:grid-cols-4'}`}>
            <select aria-label="Event" className="input-field w-full" value={eventId ?? ''} onChange={event => setEventChoice(Number(event.target.value))}>{events.map(event => <option key={event.id} value={event.id}>{event.code} · {event.name}</option>)}</select>
            <select aria-label="Round" className="input-field w-full" value={round} onChange={event => filter(setRound, event.target.value)}><option value="">ทุก Round</option><option value="1">Round 1</option><option value="2">Round 2</option></select>
            <select aria-label="ประเภท Poster" className="input-field w-full" value={presentationType} onChange={event => filter(setPresentationType, event.target.value)}><option value="">ทุกประเภท</option><option value="poster">Poster</option><option value="highlighted-poster">Highlighted Poster</option></select>
            <select aria-label="สถานะ Poster" className="input-field w-full" value={status} onChange={event => filter(setStatus, event.target.value)}><option value="">ทุกสถานะ</option>{Object.entries(progressLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
            {isAdmin && <select aria-label="ผลตรวจ" className="input-field w-full" value={matchState} onChange={event => filter(setMatchState, event.target.value)}><option value="">ทุกผลตรวจ</option>{Object.entries(matchLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>}
          </div>
        {error && <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-700">{error}</p>}
        {notice && <p role="status" className="rounded-lg bg-amber-50 p-4 text-amber-800">{notice}</p>}
        {data ? <>
          {manage && tab === 'verify' && <button className="btn-secondary mb-4" disabled={rechecking} onClick={recheck}>{rechecking ? 'กำลังตรวจ…' : 'ตรวจรายชื่อซ้ำ'}</button>}
          {manage && tab === 'notifications' && <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4"><button className="btn-secondary" onClick={() => setSelected(new Set(selectablePosterIds(data.items)))}>เลือกที่แจ้งได้ในหน้านี้</button><button className="btn-secondary" onClick={() => setSelected(new Set())}>ล้างที่เลือก</button><span>{abstractIds.length} ผลงาน / {abstractIds.length} อีเมล</span><button className="btn-primary" disabled={!abstractIds.length} onClick={() => setEmailKind('initial')}>ตัวอย่างแจ้งส่ง</button><button className="btn-secondary" disabled={!abstractIds.length} onClick={() => setEmailKind('reminder')}>ตัวอย่างเตือนส่ง</button></div>}
          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
            <PosterTable rows={data.items} manage={manage} showAdminDetails={isAdmin} selected={visibleSelected} onSelect={toggle} onVerify={setVerifyRow} eventId={eventId!} view={tab} closesAt={data.settings.closesAt} />
            <Pagination currentPage={page} totalPages={Math.max(1, Math.ceil(data.total / data.pageSize))} totalCount={data.total} pageSize={data.pageSize} onPageChange={setPage} itemName="posters" hideIfSinglePage={false} className="flex-wrap gap-3" />
          </div>
        </> : <div role="status" className="flex items-center justify-center gap-3 py-16 text-zinc-400"><IconLoader2 size={32} className="animate-spin text-emerald-600" /><span>กำลังโหลดรายชื่อ…</span></div>}
        </section>
        {isAdmin && batch && <section className="card"><h2 className="font-semibold">สร้างงานอีเมลแล้ว {batch.queued} งาน</h2><p className="my-2 text-sm text-zinc-500">รอผู้ให้บริการรับงาน ไม่ใช่การยืนยันว่าอีเมลถึงผู้รับ · {batch.id}</p><button className="btn-secondary" disabled={batchBusy} onClick={refreshBatch}>โหลดผลส่งล่าสุด</button><ul className="mt-3 space-y-2">{batch.result?.jobs.map(job => <li key={job.id}>{job.abstractId} · {job.recipient} · {mailLabels[job.state]} {job.errorCode}</li>)}</ul></section>}
        {isAdmin && history && <section className="card space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">กำหนดส่งและประวัติ (Asia/Bangkok)</h2>{manage && history.capabilities.manage && <button className="btn-secondary" onClick={() => setSettingsOpen(true)}>เปลี่ยนกำหนดส่ง</button>}</div><p>วันสุดท้าย: {thaiTime(new Date(Date.parse(history.settings.closesAt) - 1000).toISOString())} · รุ่น {history.settings.version}</p><details><summary className="cursor-pointer text-emerald-700">ประวัติการเปลี่ยนกำหนดส่ง ({history.history.length})</summary><ul className="mt-4 space-y-4">{history.history.map(item => <li key={item.id} className="border-t border-zinc-200 pt-3"><p>{thaiTime(item.createdAt)} · ผู้เปลี่ยน {item.actorId ?? 'ระบบ'} · {item.reason ?? '—'}</p><div className="mt-3 grid gap-4 sm:grid-cols-2"><div><h3>เดิม</h3><PosterDeadlineHistory value={item.before} /></div><div><h3>ใหม่</h3><PosterDeadlineHistory value={item.after} /></div></div></li>)}</ul></details></section>}
        {manage && eventId && token && emailKind && <PosterEmailDialog eventId={eventId} token={token} kind={emailKind} abstractIds={abstractIds} onClose={() => setEmailKind(null)} onQueued={(id, queued) => { setBatch({ eventId, id, queued }); reload(); }} />}
        {manage && eventId && token && data && (verifyRow || settingsOpen) && <PosterManagementDialog eventId={eventId} token={token} row={verifyRow ?? undefined} settings={history?.settings ?? data.settings} onClose={() => { setVerifyRow(null); setSettingsOpen(false); }} onSaved={stale => { if (stale) setNotice('ข้อมูลเปลี่ยนแล้ว โหลดข้อมูลล่าสุด กรุณาตรวจและเปิดแบบฟอร์มใหม่'); reload(); }} />}
      </>}
    </>}
  </div></AdminLayout>;
}
