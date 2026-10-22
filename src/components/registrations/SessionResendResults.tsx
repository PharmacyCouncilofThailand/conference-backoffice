'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Pagination } from '@/components/common';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import type {
  ResendOperationDto,
  ResendOperationEntry,
} from '@/types/session-grants';

const labels = {
  waiting: 'เข้าคิวแล้ว',
  sending: 'กำลังส่ง',
  sent: 'ส่งแล้ว',
  failed: 'ส่งไม่สำเร็จ',
  unknown: 'ไม่ทราบผล',
  suppressed: 'ระงับการส่ง',
};
export function SessionResendResults({
  requestId,
  onSettled,
}: {
  requestId: string;
  onSettled: () => void;
}) {
  const { token } = useAuth();
  const [page, setPage] = useState(1);
  const [loaded, setLoaded] = useState<{
    id: string;
    page: number;
    data: ResendOperationDto;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const retryBusy = useRef(false);
  const [retrying, setRetrying] = useState<string | null>(null);
  const settled = useRef<string | null>(null);
  const settledCallback = useRef(onSettled);
  settledCallback.current = onSettled;
  const data =
    loaded?.id === requestId && loaded.page === page ? loaded.data : null;
  useEffect(() => {
    if (!token) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let busy = false;
    let polling = true;
    async function load() {
      if (!active || busy) return;
      busy = true;
      try {
        const result = await api.sessionGrants.resendOperation(
          token!,
          requestId,
          page,
          100,
        );
        if (!active) return;
        setLoaded({ id: requestId, page, data: result });
        setError(null);
        polling = result.summary.waiting + result.summary.sending > 0;
        if (polling) {
          timer = setTimeout(() => {
            if (document.visibilityState === 'visible') void load();
          }, 3000);
        } else if (settled.current !== requestId) {
          settled.current = requestId;
          settledCallback.current();
        }
      } catch (err) {
        if (active)
          setError(err instanceof Error ? err.message : 'โหลดผลไม่สำเร็จ');
      } finally {
        busy = false;
      }
    }
    const visible = () => {
      if (polling && document.visibilityState === 'visible') {
        clearTimeout(timer);
        void load();
      }
    };
    void load();
    document.addEventListener('visibilitychange', visible);
    return () => {
      active = false;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [token, requestId, page, reload]);
  const retry = async (entry: ResendOperationEntry) => {
    if (
      !token ||
      retryBusy.current ||
      (entry.state !== 'failed' && entry.state !== 'unknown')
    )
      return;
    const acknowledge = entry.state === 'unknown';
    if (
      acknowledge &&
      !window.confirm(
        'อีเมลเดิมอาจส่งไปแล้ว การลองส่งใหม่อาจทำให้ได้รับอีเมลซ้ำ ยืนยันหรือไม่?',
      )
    )
      return;
    retryBusy.current = true;
    setRetrying(entry.itemId);
    try {
      const result = await api.sessionGrants.retry(
        token,
        entry.batchId,
        [entry.itemId],
        acknowledge,
      );
      if (!result.queued.includes(entry.itemId))
        throw new Error(
          result.skipped.find((item) => item.itemId === entry.itemId)
            ?.reasonCode || 'ข้อมูลเปลี่ยนแล้ว',
        );
      settled.current = null;
      setReload((value) => value + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ลองส่งใหม่ไม่สำเร็จ');
    } finally {
      retryBusy.current = false;
      setRetrying(null);
    }
  };

  return (
    <section className="card space-y-3" aria-label="ผลส่งคำเชิญซ้ำ">
      <h2 className="font-semibold">ผลส่งคำเชิญซ้ำ</h2>
      <p className="break-all text-xs text-zinc-500">คำขอ {requestId}</p>
      {error && <p role="alert">{error}</p>}
      <button
        type="button"
        className="btn-secondary"
        onClick={() => setReload((value) => value + 1)}
      >
        รีเฟรชผล
      </button>
      {!data && !error && <p role="status">กำลังโหลดผล…</p>}
      {data && (
        <>
          <p>
            เข้าคิวแล้ว {data.result.queued.length} · ข้าม{' '}
            {data.result.skipped.length} · เลือกทั้งหมด{' '}
            {data.result.requestedCount}
          </p>
          <p className="text-xs text-zinc-500">
            ผู้ดำเนินการ #{data.actorId} ·{' '}
            {new Date(data.createdAt).toLocaleString('th-TH', {
              timeZone: 'Asia/Bangkok',
            })}
          </p>
          <p>
            {Object.entries(data.summary)
              .map(
                ([state, count]) =>
                  `${labels[state as keyof typeof labels]} ${count}`,
              )
              .join(' · ')}
          </p>
          <ul className="divide-y divide-zinc-100">
            {data.entries.map((entry) => (
              <li key={entry.invitationId} className="py-2 text-sm">
                {entry.name || entry.invitationId} · {entry.recipient} ·{' '}
                {labels[entry.state]}
                {entry.attemptNo !== null && <> · ครั้งที่ {entry.attemptNo}</>}
                {entry.finishedAt && (
                  <>
                    {' '}
                    ·{' '}
                    {new Date(entry.finishedAt).toLocaleString('th-TH', {
                      timeZone: 'Asia/Bangkok',
                    })}
                  </>
                )}
                {entry.errorCode && <> · {entry.errorCode}</>}
                {(entry.state === 'failed' || entry.state === 'unknown') && (
                  <>
                    <button
                      type="button"
                      className="btn-secondary ml-2"
                      disabled={retrying !== null}
                      onClick={() => void retry(entry)}
                    >
                      ลองส่งใหม่หลังล้มเหลว
                    </button>
                    <Link
                      className="ml-2 underline"
                      href={`/registrations?grantBatchId=${encodeURIComponent(entry.batchId)}`}
                    >
                      ประวัติเดิม
                    </Link>
                  </>
                )}
              </li>
            ))}
          </ul>
          <Pagination
            currentPage={page}
            totalPages={data.pagination.totalPages}
            totalCount={data.pagination.total}
            pageSize={100}
            itemName="รายการ"
            onPageChange={setPage}
          />
          {data.result.skipped.length > 0 && (
            <details>
              <summary>รายการที่ข้าม ({data.result.skipped.length})</summary>
              <ul>
                {data.result.skipped.map((skip) => (
                  <li key={skip.invitationId} className="break-all text-sm">
                    {skip.invitationId} · {skip.reasonCode}
                    {skip.retryAfter && (
                      <>
                        {' '}
                        · ส่งได้หลัง{' '}
                        {new Date(skip.retryAfter).toLocaleString('th-TH', {
                          timeZone: 'Asia/Bangkok',
                        })}
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </details>
          )}
          <p className="text-xs text-zinc-500">
            ส่งแล้วหมายถึงผู้ให้บริการรับคำขอสำเร็จ
            ยังไม่ยืนยันกล่องขาเข้าหรือการเปิดอ่าน
          </p>
        </>
      )}
    </section>
  );
}
