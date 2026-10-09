'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { IconUsers, IconUserCheck, IconMail, IconMinus, IconSearch, IconRefresh, IconHistory, IconExternalLink, IconLoader2 } from '@tabler/icons-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Pagination } from '@/components/common';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { emailLabels, invitationLabels, outcomeLabels, sessionGrantRetryDisabledReason } from '@/lib/session-grant-tracking';
import type { Session } from '@/types/api';
import type { GrantTrackingDto, GrantTrackingItemDto, SessionGrantEmailAttemptsDto } from '@/types/session-grants';

const queryKeys = ['eventId', 'sessionId', 'outcome', 'responseStatus', 'emailStatus', 'search', 'page', 'limit'] as const;
const thaiTime = (value?: string | null) => value ? new Date(value).toLocaleString('th-TH', {
  timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'short',
}) : '—';

const statusColors = {
  added: 'bg-emerald-50 text-emerald-700', invited: 'bg-blue-50 text-blue-700', skipped: 'bg-zinc-100 text-zinc-600',
  pending: 'bg-amber-50 text-amber-700', sending: 'bg-blue-50 text-blue-700', sent: 'bg-emerald-50 text-emerald-700',
  accepted: 'bg-emerald-50 text-emerald-700', declined: 'bg-red-50 text-red-700', failed: 'bg-red-50 text-red-700',
  unknown: 'bg-amber-50 text-amber-700', expired: 'bg-zinc-100 text-zinc-600', revoked: 'bg-zinc-100 text-zinc-600',
  not_applicable: 'bg-zinc-100 text-zinc-600', suppressed: 'bg-zinc-100 text-zinc-600',
};
const badgeClass = 'inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium';

function TrackingPage() {
  const { token, isAdmin, isLoading } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const urlQuery = params.toString();
  const [filters, setFilters] = useState(urlQuery);
  const filtersRef = useRef(urlQuery);
  const pendingFilters = useRef<string | null>(null);
  const query = new URLSearchParams();
  const currentFilters = new URLSearchParams(filters);
  for (const key of queryKeys) { const value = currentFilters.get(key); if (value) query.set(key, value); }
  const scope = query.toString();
  const page = Number(query.get('page') || '1');
  const limit = Number(query.get('limit') || '50');
  const eventId = query.get('eventId') || '';
  const [events, setEvents] = useState<Array<{ id: number; name: string }>>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [choicesError, setChoicesError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<{ scope: string; data: GrantTrackingDto } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [flagError, setFlagError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [historyRequest, setHistoryRequest] = useState<{ scope: string; item: GrantTrackingItemDto; page: number } | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState<{ id: string; page: number; data: SessionGrantEmailAttemptsDto } | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const listBusy = useRef(false);
  const retryBusy = useRef(false);
  const scopeRef = useRef(scope);
  scopeRef.current = scope;
  const data = loaded?.scope === scope ? loaded.data : null;
  const activeHistory = historyRequest?.scope === scope ? historyRequest : null;
  const history = historyLoaded?.id === activeHistory?.item.id && historyLoaded?.page === activeHistory?.page ? historyLoaded?.data : null;
  const refreshData = useCallback(() => { if (!listBusy.current) setRefresh(value => value + 1); }, []);

  useEffect(() => {
    // Ignore an older navigation while the latest typed filters are still pending.
    if (pendingFilters.current !== null && pendingFilters.current !== urlQuery) return;
    pendingFilters.current = null;
    filtersRef.current = urlQuery;
    setFilters(urlQuery);
  }, [urlQuery]);

  useEffect(() => {
    const onPopState = () => {
      const next = new URLSearchParams(window.location.search).toString();
      pendingFilters.current = null;
      filtersRef.current = next;
      setFilters(next);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    if (!isAdmin || !token) return;
    let current = true;
    setChoicesError(null);
    async function loadChoices() {
      const allEvents: Array<{ id: number; name: string }> = [];
      let eventPage = 1;
      let eventPages = 1;
      do {
        const result = await api.backofficeEvents.list(token!, `page=${eventPage}&limit=100`);
        for (const record of result.events) {
          if (typeof record.id !== 'number' || typeof record.eventName !== 'string') throw new Error('ข้อมูล Event ไม่ครบ');
          allEvents.push({ id: record.id, name: record.eventName });
        }
        eventPages = result.pagination.totalPages; eventPage++;
      } while (current && eventPage <= eventPages);
      if (!current) return;
      const allSessions: Session[] = [];
      let sessionPage = 1;
      let sessionPages = 1;
      do {
        const result = await api.sessions.list(token!, `page=${sessionPage}&limit=1000`);
        allSessions.push(...result.sessions);
        sessionPages = result.pagination.totalPages; sessionPage++;
      } while (current && sessionPage <= sessionPages);
      if (current) { setEvents(allEvents); setSessions(allSessions); }
    }
    void loadChoices().catch(err => { if (current) setChoicesError(err instanceof Error ? err.message : 'โหลดตัวเลือกไม่สำเร็จ'); });
    return () => { current = false; };
  }, [isAdmin, token]);

  useEffect(() => {
    if (!isAdmin || !token) { listBusy.current = false; return; }
    let current = true;
    listBusy.current = true; setLoading(true); setError(null);
    api.sessionGrants.tracking(token, scope)
      .then(result => { if (current) setLoaded({ scope, data: result }); })
      .catch(err => { if (current) setError(err instanceof Error ? err.message : 'โหลดรายการไม่สำเร็จ'); })
      .finally(() => { if (current) { listBusy.current = false; setLoading(false); } });
    return () => { current = false; };
  }, [isAdmin, token, scope, refresh]);

  useEffect(() => {
    if (!isAdmin || !token) { setEnabled(null); return; }
    let current = true;
    api.sessionGrants.status(token).then(result => {
      if (current) { setEnabled(result.enabled); setFlagError(null); }
    }).catch(() => {
      if (current) { setEnabled(false); setFlagError('โหลดสถานะระบบไม่สำเร็จ จึงปิดปุ่มส่งซ้ำไว้ชั่วคราว'); }
    });
    return () => { current = false; };
  }, [isAdmin, token, refresh]);

  useEffect(() => {
    const onFocus = () => { if (document.visibilityState === 'visible') refreshData(); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refreshData]);

  const shouldPoll = !!data && data.summary.emailCounts.pending + data.summary.emailCounts.sending > 0;
  useEffect(() => {
    if (!shouldPoll) return;
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') refreshData(); }, 3000);
    return () => window.clearInterval(timer);
  }, [shouldPoll, refreshData]);

  useEffect(() => {
    const requested = historyRequest;
    if (!isAdmin || !token || !requested || requested.scope !== scope) return;
    let current = true;
    setHistoryLoading(true); setHistoryError(null);
    api.sessionGrants.emailAttempts(token, requested.item.batchId, requested.item.id, requested.page, 50)
      .then(result => { if (current) setHistoryLoaded({ id: requested.item.id, page: requested.page, data: result }); })
      .catch(err => { if (current) setHistoryError(err instanceof Error ? err.message : 'โหลดประวัติอีเมลไม่สำเร็จ'); })
      .finally(() => { if (current) setHistoryLoading(false); });
    return () => { current = false; };
  }, [isAdmin, token, historyRequest, scope, refresh]);

  const changeQuery = (key: typeof queryKeys[number], value: string) => {
    const next = new URLSearchParams(filtersRef.current);
    if (value) next.set(key, value); else next.delete(key);
    if (key !== 'page') next.set('page', '1');
    if (key === 'eventId') next.delete('sessionId');
    pendingFilters.current = next.toString();
    filtersRef.current = next.toString();
    setFilters(next.toString());
    setNotice(null); setHistoryRequest(null);
    router.replace(`/session-grants${next.size ? `?${next}` : ''}`, { scroll: false });
  };

  const retry = async (item: GrantTrackingItemDto) => {
    if (!token || !isAdmin || retryBusy.current || sessionGrantRetryDisabledReason(item, enabled === true)) return;
    const acknowledgeUnknown = item.emailStatus === 'unknown';
    if (acknowledgeUnknown && !window.confirm('อีเมลเดิมอาจส่งไปแล้ว การส่งซ้ำอาจทำให้ผู้รับได้รับอีเมลซ้ำ ต้องการส่งซ้ำหรือไม่?')) return;
    const requestedScope = scope;
    retryBusy.current = true; setRetrying(item.id); setNotice(null);
    try {
      const result = await api.sessionGrants.retry(token, item.batchId, [item.id], acknowledgeUnknown);
      if (scopeRef.current === requestedScope) {
        setNotice(result.queued.includes(item.id) ? 'เข้าคิวส่งอีเมลซ้ำแล้ว' : `ส่งซ้ำไม่ได้: ${result.skipped.find(row => row.itemId === item.id)?.reasonCode || 'ข้อมูลเปลี่ยนแล้ว'}`);
      }
      setRefresh(value => value + 1);
    } catch (err) {
      if (scopeRef.current === requestedScope) setError(err instanceof Error ? err.message : 'ส่งคำขอส่งซ้ำไม่สำเร็จ');
    } finally { retryBusy.current = false; setRetrying(null); }
  };

  return <AdminLayout title="ติดตามสิทธิ์ Session"><div className="space-y-6">
    {isLoading ? <p role="status">กำลังโหลดสิทธิ์…</p> : !isAdmin || !token ? <p role="alert">หน้านี้ใช้ได้เฉพาะ Admin</p> : <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'รายการทั้งหมด', value: data?.summary.total, icon: IconUsers, color: 'bg-zinc-100 text-zinc-600' },
          { label: 'เพิ่มสิทธิ์ทันที', value: data?.summary.outcomeCounts.added, icon: IconUserCheck, color: statusColors.added },
          { label: 'สร้างคำเชิญ', value: data?.summary.outcomeCounts.invited, icon: IconMail, color: statusColors.invited },
          { label: 'ข้ามรายการ', value: data?.summary.outcomeCounts.skipped, icon: IconMinus, color: statusColors.skipped },
        ].map(({ label, value, icon: Icon, color }) => <div key={label} className="card py-4">
          <div className="flex items-center gap-4">
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${color}`}><Icon size={24} stroke={1.5} aria-hidden="true" /></div>
            <div><p className="text-2xl font-bold tabular-nums text-zinc-800">{value?.toLocaleString('th-TH') ?? '—'}</p><p className="text-sm text-zinc-500">{label}</p></div>
          </div>
        </div>)}
      </div>
      <section className="card space-y-4" aria-label="ตัวกรองรายการ">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="font-semibold text-zinc-900">ค้นหารายการเพิ่มสิทธิ์</h2><p className="mt-1 text-xs text-zinc-500">ยอดสรุปนับรายการตามตัวกรอง ครอบคลุมทุกหน้า</p></div>
          <button type="button" className="btn-secondary flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50" disabled={loading} onClick={refreshData}><IconRefresh size={17} className={loading ? 'animate-spin' : ''} aria-hidden="true" />รีเฟรช</button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <label className="space-y-1.5 text-xs font-medium text-zinc-500">Event<select className="input-field w-full" value={eventId} onChange={event => changeQuery('eventId', event.target.value)}>
            <option value="">ทุก Event</option>{events.map(event => <option key={event.id} value={event.id}>{event.name}</option>)}
          </select></label>
          <label className="space-y-1.5 text-xs font-medium text-zinc-500">Session<select className="input-field w-full" value={query.get('sessionId') || ''} onChange={event => changeQuery('sessionId', event.target.value)}>
            <option value="">ทุก Session</option>{sessions.filter(session => !eventId || session.eventId === Number(eventId)).map(session => <option key={session.id} value={session.id}>{session.sessionName}</option>)}
          </select></label>
          <label className="space-y-1.5 text-xs font-medium text-zinc-500">ผลการเพิ่มสิทธิ์<select className="input-field w-full" value={query.get('outcome') || ''} onChange={event => changeQuery('outcome', event.target.value)}>
            <option value="">ทุกผล</option>{Object.entries(outcomeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select></label>
          <label className="space-y-1.5 text-xs font-medium text-zinc-500">คำตอบ<select className="input-field w-full" value={query.get('responseStatus') || ''} onChange={event => changeQuery('responseStatus', event.target.value)}>
            <option value="">ทุกคำตอบ</option><option value="not_required">ไม่ต้องตอบรับ</option>{Object.entries(invitationLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select></label>
          <label className="space-y-1.5 text-xs font-medium text-zinc-500">สถานะอีเมล<select className="input-field w-full" value={query.get('emailStatus') || ''} onChange={event => changeQuery('emailStatus', event.target.value)}>
            <option value="">ทุกสถานะ</option>{Object.entries(emailLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select></label>
          <label className="space-y-1.5 text-xs font-medium text-zinc-500">ค้นหาชื่อ / อีเมล / รหัสลงทะเบียน<div className="relative"><IconSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} aria-hidden="true" /><input className="input-field-search" placeholder="ชื่อ อีเมล หรือรหัสลงทะเบียน…" maxLength={200} value={query.get('search') || ''} onChange={event => changeQuery('search', event.target.value)} /></div></label>
        </div>
      </section>
      {choicesError && <p role="alert" className="text-red-700">{choicesError}</p>}
      {flagError && <p role="alert" className="text-amber-800">{flagError}</p>}
      {enabled === false && !flagError && <p role="status">ระบบปิดการส่งอีเมลซ้ำ สามารถดูประวัติได้</p>}
      {notice && <p role="status" className="rounded-lg bg-amber-50 p-3 text-amber-900">{notice}</p>}
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">{error}{data ? ' · ข้อมูลที่แสดงอาจไม่ใช่ข้อมูลล่าสุด' : ''}</p>}
      {loading && <p role="status" className="flex items-center gap-2 text-sm text-zinc-500"><IconLoader2 size={18} className="animate-spin text-emerald-600" aria-hidden="true" />กำลังโหลดรายการ…</p>}
      {data && <>
        <div className="space-y-3 text-xs text-zinc-500">
          <div className="flex flex-wrap items-center gap-2"><span className="w-12 font-medium">คำตอบ</span>{Object.entries(invitationLabels).map(([key, label]) => <span key={key} className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5">{label}<span className="font-semibold tabular-nums text-zinc-800">{data.summary.invitationCounts[key as keyof typeof invitationLabels]}</span></span>)}</div>
          <div className="flex flex-wrap items-center gap-2"><span className="w-12 font-medium">อีเมล</span>{Object.entries(emailLabels).map(([key, label]) => <span key={key} className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5">{label}<span className="font-semibold tabular-nums text-zinc-800">{data.summary.emailCounts[key as keyof typeof emailLabels]}</span></span>)}</div>
        </div>
        <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm" aria-label="รายการเพิ่มสิทธิ์">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 px-4 py-4 sm:px-6"><h2 className="font-semibold text-zinc-900">รายการเพิ่มสิทธิ์ <span className="ml-2 text-sm font-normal text-zinc-500">{data.pagination.total.toLocaleString('th-TH')} รายการ</span></h2><span className="text-xs text-zinc-500">แสดงเวลาไทย · ผลการเพิ่มเป็นประวัติของครั้งนั้น</span></div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1250px] text-sm table-sticky-actions">
              <thead><tr className="border-b border-zinc-200 bg-zinc-50 text-left">
                {['ผู้รับ', 'Session', 'ผลการเพิ่มสิทธิ์', 'คำตอบ', 'อีเมล', 'เพิ่มเมื่อ / โดย', 'การจัดการ'].map(label => <th key={label} scope="col" className="whitespace-nowrap px-4 py-3 text-xs font-semibold tracking-wide text-zinc-500">{label}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-zinc-100">
                {data.items.length === 0 && <tr><td colSpan={7} className="px-4 py-12 text-center text-zinc-400"><IconSearch size={32} stroke={1.5} className="mx-auto mb-3 opacity-40" aria-hidden="true" /><p className="font-medium">ไม่พบรายการตามตัวกรอง</p><p className="mt-1 text-xs">ลองเปลี่ยนคำค้นหาหรือตัวกรอง</p></td></tr>}
                {data.items.map(item => {
                  const reason = sessionGrantRetryDisabledReason(item, enabled === true);
                  return <tr key={item.id} className="align-top transition-colors hover:bg-zinc-50">
                    <td className="min-w-56 max-w-72 px-4 py-4"><Link className="font-medium text-zinc-900 transition-colors hover:text-emerald-700 hover:underline" href={`/registrations/${item.registrationId}`}>{item.name || '—'}</Link><div className="mt-1.5"><span className="rounded bg-zinc-100 px-2 py-1 font-mono text-xs text-zinc-500">{item.regCode || item.registrationId}</span></div><div className="mt-2 break-all text-xs text-zinc-400">{item.recipientEmail || '—'}</div></td>
                    <td className="min-w-48 max-w-64 px-4 py-4"><p className="font-medium text-zinc-800">{item.sessionName}</p><div className="mt-1 text-xs text-zinc-400">{events.find(event => event.id === item.eventId)?.name || `Event ${item.eventId}`}</div></td>
                    <td className="px-4 py-4"><span className={`${badgeClass} ${statusColors[item.outcome]}`}>{outcomeLabels[item.outcome]}</span>{item.reasonCode && <div className="mt-2 max-w-40 break-words text-xs text-zinc-500">{item.reasonCode}</div>}</td>
                    <td className="min-w-48 px-4 py-4">{item.outcome === 'added' ? <span className={`${badgeClass} bg-zinc-100 text-zinc-600`}>ไม่ต้องตอบรับ</span> : item.outcome === 'skipped' ? <span className="text-zinc-400">ไม่เกี่ยวข้อง</span> : item.invitation ? <>
                      <span className={`${badgeClass} ${statusColors[item.invitation.invitationStatus]}`}>{invitationLabels[item.invitation.invitationStatus]}</span>
                      <div className="mt-2 text-xs text-zinc-500">ก่อน {thaiTime(item.invitation.effectiveDeadline)}</div>
                      {item.invitation.respondedAt && <div className="mt-1 text-xs text-zinc-500">ตอบเมื่อ {thaiTime(item.invitation.respondedAt)}</div>}
                    </> : 'ไม่มีข้อมูลคำเชิญ'}</td>
                    <td className="min-w-52 px-4 py-4"><span className={`${badgeClass} ${statusColors[item.emailStatus]}`}>{emailLabels[item.emailStatus]}</span><div className="mt-2 text-xs text-zinc-500">ส่งเมื่อ {thaiTime(item.sentAt)}</div><div className="mt-1 text-xs text-zinc-500">ลองส่งล่าสุด {thaiTime(item.lastAttemptAt)}</div>{item.lastErrorCode && <div className="mt-1 max-w-48 break-all text-xs text-red-700">{item.lastErrorCode}</div>}
                      <button type="button" className="mt-2 inline-flex items-center gap-1.5 rounded text-xs font-medium text-emerald-700 hover:text-emerald-900 hover:underline focus-visible:outline-2 focus-visible:outline-emerald-600" aria-expanded={activeHistory?.item.id === item.id} aria-controls="session-grant-email-history" onClick={() => setHistoryRequest(activeHistory?.item.id === item.id ? null : { scope, item, page: 1 })}><IconHistory size={14} aria-hidden="true" />ประวัติอีเมล {item.attemptCount} ครั้ง</button>
                    </td>
                    <td className="min-w-40 px-4 py-4"><p className="text-xs text-zinc-600">{thaiTime(item.createdAt)}</p><div className="mt-1 text-xs text-zinc-400">{item.actorName}</div></td>
                    <td className="w-44 px-4 py-4"><Link className="inline-flex items-center gap-1.5 rounded text-xs font-medium text-emerald-700 hover:text-emerald-900 hover:underline" href={`/registrations?grantBatchId=${encodeURIComponent(item.batchId)}`}><IconExternalLink size={14} aria-hidden="true" />ผลการเพิ่มครั้งนี้</Link>
                      {(item.emailStatus === 'failed' || item.emailStatus === 'unknown') && <div className="mt-2">
                        <button type="button" className="btn-secondary inline-flex items-center gap-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-40" disabled={!!reason || retrying !== null} aria-describedby={reason ? `retry-reason-${item.id}` : undefined} onClick={() => void retry(item)}><IconRefresh size={14} className={retrying === item.id ? 'animate-spin' : ''} aria-hidden="true" />{retrying === item.id ? 'กำลังเข้าคิว…' : 'ส่งอีเมลซ้ำ'}</button>
                        {reason && <p id={`retry-reason-${item.id}`} className="mt-2 max-w-36 whitespace-normal text-xs leading-relaxed text-zinc-500">{reason}</p>}
                      </div>}
                    </td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
          <Pagination currentPage={page} totalPages={data.pagination.totalPages} totalCount={data.pagination.total} pageSize={limit} itemName="รายการ" onPageChange={value => changeQuery('page', String(value))} onPageSizeChange={value => changeQuery('limit', String(value))} />
        </section>
      </>}
      <div className="space-y-1 text-xs leading-relaxed text-zinc-500"><p>แสดงเฉพาะรายการเพิ่มสิทธิ์ที่มีประวัติในระบบ ไม่รวมสิทธิ์เก่าที่ไม่มีประวัติ</p><p>ส่งแล้วหมายถึงผู้ให้บริการรับคำขอส่งสำเร็จ ยังไม่ยืนยันว่าอีเมลถึงกล่องขาเข้าหรือถูกเปิดอ่าน</p></div>
      {activeHistory && <section id="session-grant-email-history" className="card space-y-3" aria-label="ประวัติอีเมล" aria-busy={historyLoading}>
        <div className="flex items-center justify-between gap-3"><h2 className="font-semibold">ประวัติอีเมล · {activeHistory.item.name || activeHistory.item.registrationId}</h2><button type="button" className="btn-secondary" onClick={() => setHistoryRequest(null)}>ปิดประวัติ</button></div>
        {historyLoading && <p role="status">กำลังโหลดประวัติ…</p>}
        {historyError && <p role="alert" className="text-red-700">{historyError}</p>}
        {history && <>
          {history.attempts.length === 0 ? <p>ยังไม่มีประวัติการส่ง</p> : <ol className="space-y-2">{history.attempts.map(attempt => <li key={attempt.id} className="rounded-lg border border-zinc-200 p-3">
            <div className="flex flex-wrap items-center gap-2"><span className="font-mono text-xs text-zinc-400">#{attempt.attemptNo}</span><span className={`${badgeClass} ${statusColors[attempt.result]}`}>{emailLabels[attempt.result]}</span><span className="break-all text-sm text-zinc-600">{attempt.recipientEmail}</span></div>
            <p className="mt-2 text-xs text-zinc-500">เริ่ม {thaiTime(attempt.startedAt)} · สิ้นสุด {thaiTime(attempt.finishedAt)}</p>
            {attempt.errorCode && <p className="text-xs text-red-700">{attempt.errorCode}</p>}{attempt.errorMessage && <p className="text-xs text-red-700">{attempt.errorMessage}</p>}
          </li>)}</ol>}
          <Pagination currentPage={activeHistory.page} totalPages={history.pagination.totalPages} totalCount={history.pagination.total} pageSize={50} itemName="ครั้ง" onPageChange={value => setHistoryRequest({ ...activeHistory, page: value })} />
        </>}
      </section>}
    </>}
  </div></AdminLayout>;
}

export default function SessionGrantTrackingPage() {
  return <Suspense fallback={<p role="status">กำลังโหลด…</p>}><TrackingPage /></Suspense>;
}
