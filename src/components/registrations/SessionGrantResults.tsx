'use client';

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IconLoader2, IconRefresh, IconSend } from '@tabler/icons-react';
import { api } from '@/lib/api';
import type {
  GrantBatchDto,
  SessionGrantEmailAttemptDto,
  SessionGrantItemDto,
} from '@/types/session-grants';

interface SessionGrantResultsProps {
  batchId: string;
  onEntitlementsChanged: () => void;
}

const getBackofficeToken = () =>
  localStorage.getItem('backoffice_token') ||
  sessionStorage.getItem('backoffice_token') ||
  '';

export function SessionGrantResults({ batchId, onEntitlementsChanged }: SessionGrantResultsProps) {
  const [batch, setBatch] = useState<GrantBatchDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [selectedRetryIds, setSelectedRetryIds] = useState<Set<string>>(new Set());
  const [attemptsByItem, setAttemptsByItem] = useState<Record<string, SessionGrantEmailAttemptDto[]>>({});
  const onEntitlementsChangedRef = useRef(onEntitlementsChanged);
  onEntitlementsChangedRef.current = onEntitlementsChanged;

  const load = useCallback(async () => {
    try {
      const response = await api.sessionGrants.get(getBackofficeToken(), batchId, 1, 100);
      setBatch(response);
      setError(null);
      return response;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ไม่สามารถโหลดผลการเพิ่มสิทธิ์ได้');
      return null;
    } finally {
      setLoading(false);
    }
  }, [batchId]);

  useEffect(() => {
    setLoading(true);
    void load();
    onEntitlementsChangedRef.current();
  }, [batchId, load]);

  const shouldPoll = !!batch && (batch.emailCounts.pending + batch.emailCounts.sending > 0);
  useEffect(() => {
    if (!shouldPoll) return;
    let cancelled = false;
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible' || cancelled) return;
      void load();
    }, 3000);
    const onFocus = () => { if (!cancelled) void load(); };
    window.addEventListener('focus', onFocus);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [load, shouldPoll]);

  const retryable = useMemo(
    () => batch?.results.filter((item) => item.emailStatus === 'failed' || item.emailStatus === 'unknown') || [],
    [batch],
  );

  const retrySelected = async () => {
    if (!batch || selectedRetryIds.size === 0) return;
    const selected = batch.results.filter((item) => selectedRetryIds.has(item.id));
    const hasUnknown = selected.some((item) => item.emailStatus === 'unknown');
    if (hasUnknown && !window.confirm('บางรายการมีสถานะไม่ทราบผลและอาจส่งอีเมลไปแล้ว ต้องการยืนยันการส่งซ้ำหรือไม่?')) {
      return;
    }
    setRetrying(true);
    try {
      await api.sessionGrants.retry(
        getBackofficeToken(),
        batchId,
        selected.map((item) => item.id),
        hasUnknown,
      );
      setSelectedRetryIds(new Set());
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ส่งคำขอส่งอีเมลซ้ำไม่สำเร็จ');
    } finally {
      setRetrying(false);
    }
  };

  const loadAttempts = async (item: SessionGrantItemDto) => {
    if (attemptsByItem[item.id]) {
      setAttemptsByItem((current) => {
        const next = { ...current };
        delete next[item.id];
        return next;
      });
      return;
    }
    try {
      const response = await api.sessionGrants.emailAttempts(getBackofficeToken(), batchId, item.id, 1, 100);
      setAttemptsByItem((current) => ({ ...current, [item.id]: response.attempts }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'โหลดประวัติอีเมลไม่สำเร็จ');
    }
  };

  if (loading) {
    return <div className="flex justify-center py-8"><IconLoader2 className="animate-spin" /></div>;
  }
  if (error && !batch) {
    return <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</p>;
  }
  if (!batch) return null;

  return (
    <section className="space-y-4" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-zinc-900">ผลการเพิ่มสิทธิ์ Session</h3>
          <p className="text-sm text-zinc-500">
            เพิ่มสำเร็จ {batch.addedCount} · ข้าม {batch.skippedCount} · เลือกทั้งหมด {batch.requestedCount}
          </p>
        </div>
        <button type="button" onClick={() => void load()} className="btn-secondary flex items-center gap-2">
          <IconRefresh size={16} /> รีเฟรช
        </button>
      </div>

      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <div className="rounded-lg bg-zinc-50 p-3">รอส่ง {batch.emailCounts.pending}</div>
        <div className="rounded-lg bg-blue-50 p-3">กำลังส่ง {batch.emailCounts.sending}</div>
        <div className="rounded-lg bg-green-50 p-3">ส่งแล้ว {batch.emailCounts.sent}</div>
        <div className="rounded-lg bg-amber-50 p-3">ผิดพลาด/ไม่ทราบผล {batch.emailCounts.failed + batch.emailCounts.unknown}</div>
      </div>

      {retryable.length > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm text-amber-900">เลือกเฉพาะรายการ failed/unknown ที่ต้องการส่งอีเมลซ้ำ</p>
          <button
            type="button"
            disabled={selectedRetryIds.size === 0 || retrying}
            onClick={() => void retrySelected()}
            className="btn-secondary flex items-center gap-2 disabled:opacity-50"
          >
            {retrying ? <IconLoader2 size={16} className="animate-spin" /> : <IconSend size={16} />}
            ส่งซ้ำ ({selectedRetryIds.size})
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-zinc-200">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-3 py-2">เลือก</th>
              <th className="px-3 py-2">Registration</th>
              <th className="px-3 py-2">ผลสิทธิ์</th>
              <th className="px-3 py-2">เหตุผล</th>
              <th className="px-3 py-2">อีเมล</th>
              <th className="px-3 py-2">Attempts</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {batch.results.map((item) => {
              const canRetry = item.emailStatus === 'failed' || item.emailStatus === 'unknown';
              return (
                <Fragment key={item.id}>
                  <tr>
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        disabled={!canRetry}
                        checked={selectedRetryIds.has(item.id)}
                        aria-label={`เลือกส่งซ้ำ ${item.regCode || item.registrationId}`}
                        onChange={(event) => setSelectedRetryIds((current) => {
                          const next = new Set(current);
                          if (event.target.checked) next.add(item.id); else next.delete(item.id);
                          return next;
                        })}
                      />
                    </td>
                    <td className="px-3 py-3">{item.name || '-'}<div className="font-mono text-xs text-zinc-500">{item.regCode || item.registrationId}</div></td>
                    <td className="px-3 py-3">{item.outcome === 'added' ? 'เพิ่มแล้ว' : 'ข้าม'}</td>
                    <td className="px-3 py-3">{item.reasonCode || '-'}</td>
                    <td className="px-3 py-3">{item.emailStatus}</td>
                    <td className="px-3 py-3">
                      <button type="button" className="text-emerald-700 underline" onClick={() => void loadAttempts(item)}>
                        {item.attemptCount} ครั้ง
                      </button>
                    </td>
                  </tr>
                  {attemptsByItem[item.id] && (
                    <tr key={`${item.id}-attempts`} className="bg-zinc-50">
                      <td colSpan={6} className="px-4 py-3">
                        {attemptsByItem[item.id].length === 0 ? (
                          <p className="text-zinc-500">ยังไม่มีประวัติการส่ง</p>
                        ) : (
                          <ol className="space-y-2">
                            {attemptsByItem[item.id].map((attempt) => (
                              <li key={attempt.id} className="rounded border border-zinc-200 bg-white p-2">
                                #{attempt.attemptNo} · {attempt.result} · {new Date(attempt.startedAt).toLocaleString('th-TH')}
                                {attempt.errorCode ? ` · ${attempt.errorCode}` : ''}
                                {attempt.errorMessage ? <div className="text-xs text-red-600">{attempt.errorMessage}</div> : null}
                              </li>
                            ))}
                          </ol>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
