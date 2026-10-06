'use client';

import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import type { PosterDetailDto, PosterPreviewDto } from '@/types/posters';
import { PosterDialog } from './PosterDialog';

type Job = PosterDetailDto['emailJobs'][number];
type Props = { eventId: number; token: string; onClose: () => void } & (
  { kind: 'initial' | 'reminder'; abstractIds: number[]; onQueued: (batchId: string, queued: number) => void }
  | { kind: 'stored'; job: Job; abstractId: number }
  | { kind: 'resend'; job: Job; abstractId: number; onResent: (jobId: string) => void; onConflict: (message: string) => void }
);
const emptyIds: number[] = [];

export function PosterEmailDialog(props: Props) {
  const { eventId, token, kind, onClose } = props;
  const abstractIds = 'abstractIds' in props ? props.abstractIds : emptyIds;
  const job = 'job' in props ? props.job : null;
  const abstractId = 'abstractId' in props ? props.abstractId : null;
  const [preview, setPreview] = useState<PosterPreviewDto | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingResend, setPendingResend] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const key = useRef(crypto.randomUUID());
  const lock = useRef(false);
  useEffect(() => {
    let current = true;
    setPreview(null);
    if (kind === 'stored' && job && abstractId) {
      setPreview({ fingerprint: '', messages: [{ abstractId, recipient: job.recipient, subject: job.subject, html: job.html, templateVersion: 'stored' }] });
      return;
    }
    const input = kind === 'resend' ? { kind, jobId: job!.id } as const : { kind, abstractIds } as { kind: 'initial' | 'reminder'; abstractIds: number[] };
    api.posters.preview(eventId, input, token).then(result => { if (current) setPreview(result.data); })
      .catch(error => { if (current) setFailure(error instanceof Error ? error.message : 'โหลดตัวอย่างไม่สำเร็จ'); });
    return () => { current = false; };
  }, [eventId, token, kind, abstractIds, refresh, job, abstractId]);
  const send = async () => {
    if (!preview || kind === 'stored' || lock.current) return;
    lock.current = true; setBusy(true); setFailure(null);
    if (kind === 'resend') setPendingResend(true);
    try {
      if (props.kind === 'resend') {
        const result = await api.posters.resend(eventId, props.job.id, preview.fingerprint, key.current, token);
        props.onResent(result.data.jobId);
      } else if (props.kind === 'initial' || props.kind === 'reminder') {
        const result = await api.posters.batch(eventId, { kind: props.kind, abstractIds, previewFingerprint: preview.fingerprint }, key.current, token);
        props.onQueued(result.data.batchId, result.data.queued);
      }
      onClose();
    } catch (error) {
      if (error instanceof ApiError && error.code === 'POSTER_PREVIEW_STALE') {
        setPreview(null); setPendingResend(false); key.current = crypto.randomUUID(); setRefresh(value => value + 1);
        setFailure('ข้อมูลเปลี่ยนแล้ว กรุณาตรวจตัวอย่างใหม่ก่อนกดส่ง');
      } else if (props.kind === 'resend' && error instanceof ApiError && error.status === 409) {
        props.onConflict(error.message); onClose();
      } else {
        if (error instanceof ApiError && error.status < 500) setPendingResend(false);
        setFailure(error instanceof Error ? error.message : 'ไม่ทราบผลคำขอ กดส่งอีกครั้งเพื่อตรวจคำขอเดิม');
      }
    } finally { lock.current = false; setBusy(false); }
  };
  return <PosterDialog title={kind === 'stored' ? 'อีเมลที่บันทึกไว้' : kind === 'resend' ? 'ตรวจอีเมลก่อนส่งซ้ำ' : kind === 'initial' ? 'ตรวจอีเมลแจ้งส่ง Poster' : 'ตรวจอีเมลเตือนส่ง Poster'} busy={busy || pendingResend} onClose={onClose}>
    <p className="mb-4 text-zinc-600">{kind === 'stored' ? 'เนื้อหาที่บันทึกในประวัติ ไม่ใช่ร่างสำหรับส่งซ้ำ' : `${kind === 'resend' ? 1 : abstractIds.length} ผลงาน · หนึ่งผลงานหนึ่งอีเมล แม้ใช้อีเมลผู้ส่งเดียวกัน`}</p>
    {kind === 'resend' && job?.state === 'unknown' && <p role="alert" className="mb-4 rounded-lg bg-amber-50 p-3 text-amber-800">ผลส่งไม่แน่ชัด การส่งซ้ำอาจได้รับอีเมลซ้ำ</p>}
    {pendingResend && !busy && <p className="mb-4 text-sm text-amber-800">ยังไม่ทราบผลคำขอ กรุณากดยืนยันอีกครั้งเพื่อตรวจคำขอเดิมก่อนปิด</p>}
    {failure && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-red-700">{failure}</p>}
    {!preview && <p role="status">กำลังโหลดตัวอย่าง{failure ? ' / โหลดไม่สำเร็จ' : ''}</p>}
    {preview?.messages.map(message => <section key={message.abstractId} className="mb-6 border-t border-zinc-200 pt-4"><p>abstractId {message.abstractId} · {message.recipient}</p><h3 className="my-2 font-semibold">{message.subject}</h3><iframe title={`ตัวอย่างอีเมล ${message.abstractId}`} sandbox="" referrerPolicy="no-referrer" srcDoc={message.html} className="h-96 w-full rounded-lg border border-zinc-200" /></section>)}
    {!preview && failure && <button className="btn-secondary mr-3" onClick={() => { setFailure(null); setRefresh(value => value + 1); }}>โหลดตัวอย่างใหม่</button>}
    {kind !== 'stored' && <button className="btn-primary" disabled={!preview || busy} onClick={send}>{busy ? 'กำลังสร้างงานอีเมล…' : kind === 'resend' ? 'ยืนยันส่งซ้ำ 1 อีเมล' : `ส่ง ${preview?.messages.length ?? 0} อีเมล`}</button>}
  </PosterDialog>;
}
