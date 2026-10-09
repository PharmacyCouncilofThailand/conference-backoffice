'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
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
      <p className="text-sm text-zinc-500">แสดงเฉพาะรายการเพิ่มสิทธิ์ที่มีประวัติในระบบ ไม่มีข้อมูลสถานะอีเมลของสิทธิ์เก่าที่ไม่มีประวัติ</p>
      <section className="card space-y-4" aria-label="ตัวกรองรายการ">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <label>Event<select className="input-field w-full" value={eventId} onChange={event => changeQuery('eventId', event.target.value)}>
            <option value="">ทุก Event</option>{events.map(event => <option key={event.id} value={event.id}>{event.name}</option>)}
          </select></label>
          <label>Session<select className="input-field w-full" value={query.get('sessionId') || ''} onChange={event => changeQuery('sessionId', event.target.value)}>
            <option value="">ทุก Session</option>{sessions.filter(session => !eventId || session.eventId === Number(eventId)).map(session => <option key={session.id} value={session.id}>{session.sessionName}</option>)}
          </select></label>
          <label>ผลการเพิ่มสิทธิ์<select className="input-field w-full" value={query.get('outcome') || ''} onChange={event => changeQuery('outcome', event.target.value)}>
            <option value="">ทุกผล</option>{Object.entries(outcomeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select></label>
          <label>คำตอบ<select className="input-field w-full" value={query.get('responseStatus') || ''} onChange={event => changeQuery('responseStatus', event.target.value)}>
            <option value="">ทุกคำตอบ</option><option value="not_required">ไม่ต้องตอบรับ</option>{Object.entries(invitationLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select></label>
          <label>สถานะอีเมล<select className="input-field w-full" value={query.get('emailStatus') || ''} onChange={event => changeQuery('emailStatus', event.target.value)}>
            <option value="">ทุกสถานะ</option>{Object.entries(emailLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select></label>
          <label>ค้นหาชื่อ / อีเมล / รหัสลงทะเบียน<input className="input-field w-full" maxLength={200} value={query.get('search') || ''} onChange={event => changeQuery('search', event.target.value)} /></label>
        </div>
        <button type="button" className="btn-secondary" disabled={loading} onClick={refreshData}>รีเฟรช</button>
      </section>
      {choicesError && <p role="alert" className="text-red-700">{choicesError}</p>}
      {flagError && <p role="alert" className="text-amber-800">{flagError}</p>}
      {enabled === false && !flagError && <p role="status">ระบบปิดการส่งอีเมลซ้ำ สามารถดูประวัติได้</p>}
      {notice && <p role="status" className="rounded-lg bg-amber-50 p-3 text-amber-900">{notice}</p>}
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">{error}{data ? ' · ข้อมูลที่แสดงอาจไม่ใช่ข้อมูลล่าสุด' : ''}</p>}
      {loading && <p role="status">กำลังโหลดรายการ…</p>}
      {data && <>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[['จำนวนรายการ', data.summary.total], ['เพิ่มสิทธิ์ทันที', data.summary.outcomeCounts.added], ['สร้างคำเชิญ', data.summary.outcomeCounts.invited], ['ข้าม', data.summary.outcomeCounts.skipped]].map(([label, value]) =>
            <div key={label} className="card"><p className="text-sm text-zinc-500">{label}</p><p className="text-2xl font-semibold">{value}</p></div>)}
        </div>
        <div className="space-y-2 text-sm">
          <p>คำตอบ: {Object.entries(invitationLabels).map(([key, label]) => `${label} ${data.summary.invitationCounts[key as keyof typeof invitationLabels]}`).join(' · ')}</p>
          <p>อีเมล: {Object.entries(emailLabels).map(([key, label]) => `${label} ${data.summary.emailCounts[key as keyof typeof emailLabels]}`).join(' · ')}</p>
          <p className="text-zinc-500">ส่งแล้วหมายถึงผู้ให้บริการรับคำขอส่งสำเร็จ ยังไม่ยืนยันว่าอีเมลถึงกล่องขาเข้าหรือถูกเปิดอ่าน</p>
          <p className="text-zinc-500">ยอดสรุปนับรายการตามตัวกรอง ครอบคลุมทุกหน้า ผลการเพิ่มสิทธิ์เป็นประวัติของครั้งนั้น</p>
        </div>
        <section className="card overflow-hidden p-0" aria-label="รายการเพิ่มสิทธิ์">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-left text-zinc-500"><tr>
                {['ผู้รับ', 'Session', 'ผลการเพิ่มสิทธิ์', 'คำตอบ', 'อีเมล', 'เพิ่มเมื่อ / โดย', 'การจัดการ'].map(label => <th key={label} scope="col" className="px-4 py-3">{label}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-zinc-100">
                {data.items.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-zinc-500">ไม่พบรายการตามตัวกรอง</td></tr>}
                {data.items.map(item => {
                  const reason = sessionGrantRetryDisabledReason(item, enabled === true);
                  return <tr key={item.id}>
                    <td className="px-4 py-3"><Link className="text-emerald-700 underline" href={`/registrations/${item.registrationId}`}>{item.name || '—'}</Link><div>{item.regCode || item.registrationId}</div><div className="text-xs text-zinc-500">{item.recipientEmail || '—'}</div></td>
                    <td className="px-4 py-3">{item.sessionName}<div className="text-xs text-zinc-500">{events.find(event => event.id === item.eventId)?.name || `Event ${item.eventId}`}</div></td>
                    <td className="px-4 py-3">{outcomeLabels[item.outcome]}{item.reasonCode && <div className="text-xs text-zinc-500">{item.reasonCode}</div>}</td>
                    <td className="px-4 py-3">{item.outcome === 'added' ? 'ไม่ต้องตอบรับ' : item.outcome === 'skipped' ? 'ไม่เกี่ยวข้อง' : item.invitation ? <>
                      <div>{invitationLabels[item.invitation.invitationStatus]}</div>
                      <div className="text-xs text-zinc-500">ก่อน {thaiTime(item.invitation.effectiveDeadline)} เวลาไทย</div>
                      {item.invitation.respondedAt && <div className="text-xs text-zinc-500">ตอบเมื่อ {thaiTime(item.invitation.respondedAt)}</div>}
                    </> : 'ไม่มีข้อมูลคำเชิญ'}</td>
                    <td className="px-4 py-3">{emailLabels[item.emailStatus]}<div className="text-xs text-zinc-500">ส่งเมื่อ {thaiTime(item.sentAt)}</div><div className="text-xs text-zinc-500">ลองส่งล่าสุด {thaiTime(item.lastAttemptAt)}</div>{item.lastErrorCode && <div className="text-xs text-red-700">{item.lastErrorCode}</div>}
                      <button type="button" className="text-emerald-700 underline" aria-expanded={activeHistory?.item.id === item.id} aria-controls="session-grant-email-history" onClick={() => setHistoryRequest(activeHistory?.item.id === item.id ? null : { scope, item, page: 1 })}>ประวัติอีเมล {item.attemptCount} ครั้ง</button>
                    </td>
                    <td className="px-4 py-3">{thaiTime(item.createdAt)}<div className="text-xs text-zinc-500">{item.actorName}</div></td>
                    <td className="px-4 py-3"><Link className="text-emerald-700 underline" href={`/registrations?grantBatchId=${encodeURIComponent(item.batchId)}`}>ผลการเพิ่มครั้งนี้</Link>
                      {(item.emailStatus === 'failed' || item.emailStatus === 'unknown') && <div className="mt-2">
                        <button type="button" className="btn-secondary" disabled={!!reason || retrying !== null} aria-describedby={reason ? `retry-reason-${item.id}` : undefined} onClick={() => void retry(item)}>{retrying === item.id ? 'กำลังเข้าคิว…' : 'ส่งอีเมลซ้ำ'}</button>
                        {reason && <p id={`retry-reason-${item.id}`} className="mt-1 text-xs text-zinc-500">{reason}</p>}
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
      {activeHistory && <section id="session-grant-email-history" className="card space-y-3" aria-label="ประวัติอีเมล" aria-busy={historyLoading}>
        <div className="flex items-center justify-between gap-3"><h2 className="font-semibold">ประวัติอีเมล · {activeHistory.item.name || activeHistory.item.registrationId}</h2><button type="button" className="btn-secondary" onClick={() => setHistoryRequest(null)}>ปิดประวัติ</button></div>
        {historyLoading && <p role="status">กำลังโหลดประวัติ…</p>}
        {historyError && <p role="alert" className="text-red-700">{historyError}</p>}
        {history && <>
          {history.attempts.length === 0 ? <p>ยังไม่มีประวัติการส่ง</p> : <ol className="space-y-2">{history.attempts.map(attempt => <li key={attempt.id} className="rounded-lg border border-zinc-200 p-3">
            <p>#{attempt.attemptNo} · {emailLabels[attempt.result]} · {attempt.recipientEmail}</p>
            <p className="text-xs text-zinc-500">เริ่ม {thaiTime(attempt.startedAt)} · สิ้นสุด {thaiTime(attempt.finishedAt)}</p>
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
