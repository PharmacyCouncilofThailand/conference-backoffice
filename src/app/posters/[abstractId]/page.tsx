'use client';
/* eslint-disable react-hooks/set-state-in-effect -- clear scoped data and dialogs before the next staff API read */

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { activePosterRequest, canResendPosterJob, posterRouteId } from '@/lib/posterUi';
import type { PosterDetailDto, RevisionDto } from '@/types/posters';
import { PosterDialog, PosterSnapshot } from '@/components/posters/PosterDialog';
import { PosterEmailDialog } from '@/components/posters/PosterEmailDialog';
import { PosterRevisionDialog } from '@/components/posters/PosterRevisionDialog';
import { mailLabels, matchLabels, progressLabels, thaiTime } from '@/components/posters/PosterTable';

// Audit/attempt records retain their API shape while timestamps read in staff's Thai timezone.
function thaiHistory(value: unknown): unknown {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value)) return `${thaiTime(value)} (ไทย; ${value})`;
  if (Array.isArray(value)) return value.map(thaiHistory);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, thaiHistory(item)]));
  return value;
}

function PosterDetailContent() {
  const params = useParams();
  const query = useSearchParams();
  const { user, token, isAdmin, isLoading } = useAuth();
  const abstractId = posterRouteId(params.abstractId);
  const eventId = query.getAll('eventId').length === 1 ? posterRouteId(query.get('eventId')) : null;
  const readable = !!user && ['admin', 'organizer', 'reviewer'].includes(user.role);
  const allowed = readable && !!eventId && (isAdmin || !!user?.assignedEvents.some(event => event.id === eventId && event.code === 'PRIS-2026'));
  const scope = `${eventId}:${abstractId}:${token}`;
  const [loaded, setLoaded] = useState<{ scope: string; detail: PosterDetailDto } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [revisionOpen, setRevisionOpen] = useState(false);
  const [cancelRequest, setCancelRequest] = useState<RevisionDto | null>(null);
  const [email, setEmail] = useState<{ kind: 'stored' | 'resend'; job: PosterDetailDto['emailJobs'][number] } | null>(null);
  const [attemptJob, setAttemptJob] = useState<PosterDetailDto['emailJobs'][number] | null>(null);
  useEffect(() => {
    let current = true;
    setLoaded(null); setError(null); setRevisionOpen(false); setCancelRequest(null); setEmail(null); setAttemptJob(null);
    if (!token || !eventId || !abstractId || !allowed) return;
    api.posters.detail(eventId, abstractId, token).then(result => { if (current) setLoaded({ scope, detail: result.data }); })
      .catch(error => { if (current) setError(error instanceof Error ? error.message : 'โหลดรายละเอียดไม่สำเร็จ'); });
    return () => { current = false; };
  }, [eventId, abstractId, token, allowed, scope, refresh]);
  const detail = loaded?.scope === scope && allowed ? loaded.detail : null;
  const manage = isAdmin && detail?.capabilities.manage === true;
  const active = detail ? activePosterRequest(detail.requests) : null;
  const reload = (message?: string) => { if (message) setNotice(message); setRefresh(value => value + 1); };
  return <AdminLayout title="รายละเอียด Poster"><div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><Link className="text-sm text-emerald-700 underline" href="/posters">กลับรายชื่อ Poster</Link><button className="btn-secondary" onClick={() => reload()}>โหลดข้อมูลล่าสุด</button></div>
    {!eventId || !abstractId ? <p role="alert">รหัส Event หรือผลงานไม่ถูกต้อง ต้องเป็นจำนวนเต็มบวก</p> : isLoading ? <p role="status">กำลังโหลดสิทธิ์…</p> : !allowed ? <p role="alert">ไม่มีสิทธิ์ดู Poster ของ Event นี้</p> : error ? <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-700">{error}</p> : !detail ? <p role="status">กำลังโหลดรายละเอียด…</p> : <>
      {notice && <p role="status" className="rounded-lg bg-emerald-50 p-4 text-emerald-800">{notice}</p>}
      <section className="card space-y-3"><p className="text-sm text-zinc-500">Round {detail.row.announcement.round} · {detail.row.announcement.presentationType} · abstractId {abstractId}</p><h1 className="text-2xl font-semibold">{detail.row.announcement.trackingId ?? 'ข้อมูลรหัสไม่ครบ'}</h1><p className="text-lg">{detail.row.announcement.title}</p><p>{detail.row.announcement.submitterName} · {detail.row.submitterEmail ?? 'ไม่พบอีเมลผู้ส่ง'}</p><p>{progressLabels[detail.row.progress]} · {matchLabels[detail.row.matchState]}</p><ul className="space-y-1 text-sm text-amber-800">{detail.row.problems.map(problem => <li key={problem}>{problem}</li>)}</ul><details><summary className="cursor-pointer text-emerald-700">ประกาศ / ฐานข้อมูล / ผลตรวจ</summary><div className="mt-4"><PosterSnapshot value={detail.row.snapshot} /></div></details><p className="text-sm text-zinc-500">รับรองโดย {detail.row.verifiedBy ?? '—'} · {detail.row.verifiedAt ? thaiTime(detail.row.verifiedAt) : 'ยังไม่รับรอง'} · {detail.row.verificationReason ?? '—'}</p></section>
      <section className="card space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">Poster ฉบับปัจจุบัน</h2>{manage && <button className="btn-primary" disabled={!detail.row.currentUpload || !!active} onClick={() => setRevisionOpen(true)}>ขอแก้ไข Poster</button>}</div>
        {active && <p className="rounded-lg bg-amber-50 p-3 text-amber-800">มีคำขอแก้ไขที่เปิดอยู่ · {active.id} · ไฟล์ฉบับปัจจุบันยังคงเป็นไฟล์ที่รับสำเร็จ</p>}
        {detail.row.currentUpload ? <><p>ฉบับ {detail.row.currentUpload.version} · {detail.row.currentUpload.fileName} · รับ {thaiTime(detail.row.currentUpload.receivedAt)}</p>
          {detail.row.currentUpload.mimeType === 'image/png'
            // Original public PNG stays unchanged; next/image remote transforms are intentionally unused.
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={detail.row.currentUpload.publicUrl} alt={`Poster ${detail.row.announcement.title} ฉบับ ${detail.row.currentUpload.version}`} loading="lazy" className="max-h-[650px] max-w-full rounded-lg border border-zinc-200 object-contain" />
            : <iframe src={detail.row.currentUpload.publicUrl} title={`Poster PDF ฉบับ ${detail.row.currentUpload.version}`} loading="lazy" referrerPolicy="no-referrer" className="h-[600px] w-full rounded-lg border border-zinc-200" />}
          <a className="block text-emerald-700 underline" href={detail.row.currentUpload.publicUrl} target="_blank" rel="noopener noreferrer">เปิดไฟล์สาธารณะในแท็บใหม่ (หากแสดงตัวอย่างไม่ได้)</a></> : <p className="text-zinc-500">ยังไม่มีไฟล์ Poster ที่รับสำเร็จ</p>}
      </section>
      <section className="card"><h2 className="mb-4 text-xl font-semibold">ไฟล์ทุกฉบับ ({detail.uploads.length})</h2>{detail.uploads.map(file => <article id={`poster-file-${file.id}`} key={file.id} className="space-y-2 border-t border-zinc-200 py-4"><h3 className="font-semibold">ฉบับที่ {file.version}{detail.row.currentUpload?.id === file.id ? ' · ฉบับปัจจุบัน' : ''}</h3><a className="break-words text-emerald-700 underline" href={file.publicUrl} target="_blank" rel="noopener noreferrer">{file.fileName} · ไฟล์สาธารณะ</a><p className="text-sm text-zinc-500">{file.mimeType} · {(file.sizeBytes / 1024 / 1024).toFixed(2)} MB · รับ {thaiTime(file.receivedAt)}</p>{file.revisionRequestId ? <a className="text-sm text-emerald-700 underline" href={`#poster-request-${file.revisionRequestId}`}>ตอบคำขอแก้ไข {file.revisionRequestId}</a> : <p className="text-sm">ไฟล์ครั้งแรก</p>}</article>)}</section>
      <section className="card"><h2 className="mb-4 text-xl font-semibold">คำขอแก้ไข ({detail.requests.length})</h2><p className="mb-4 text-sm text-zinc-500">รายละเอียดและกำหนดส่งของคำขอเดิมเปลี่ยนไม่ได้ ต้องยกเลิกพร้อมเหตุผลแล้วสร้างใหม่</p>{detail.requests.map(request => <article id={`poster-request-${request.id}`} key={request.id} className="space-y-2 border-t border-zinc-200 py-4"><h3 className="font-semibold">{request.status} · {request.id}</h3><p className="text-sm text-zinc-500">ผู้ขอ {request.requestedBy} · {thaiTime(request.createdAt)}</p><p className="whitespace-pre-wrap">{request.details}</p><p>วันสุดท้ายเวลาไทย {thaiTime(new Date(Date.parse(request.closesAt) - 1000).toISOString())}</p>{request.cancelledAt && <p>ยกเลิกโดย {request.cancelledBy} · {thaiTime(request.cancelledAt)} · {request.cancellationReason}</p>}{request.submittedAt && <p>รับฉบับแก้ไข {thaiTime(request.submittedAt)}</p>}{detail.uploads.filter(file => file.revisionRequestId === request.id).map(file => <a key={file.id} className="block text-sm text-emerald-700 underline" href={`#poster-file-${file.id}`}>ไฟล์ตอบคำขอนี้ · ฉบับ {file.version}</a>)}{manage && request.status === 'open' && <button className="btn-danger" onClick={() => setCancelRequest(request)}>ยกเลิกคำขอ</button>}</article>)}</section>
      <section className="card"><h2 className="mb-4 text-xl font-semibold">ประวัติอีเมล ({detail.emailJobs.length})</h2><p className="mb-4 text-sm text-zinc-500">ผลอีเมลไม่เปลี่ยนสิทธิ์แก้ไขหรือไฟล์ที่รับสำเร็จ ไม่มีการส่งซ้ำอัตโนมัติเมื่อไม่ทราบผล</p>{detail.emailJobs.map(job => <article id={`poster-mail-${job.id}`} key={job.id} className="space-y-2 border-t border-zinc-200 py-4"><h3 className="font-semibold">{job.kind} · {mailLabels[job.state]}</h3><p>{job.recipient}</p><p>{job.subject}</p><p className="text-sm text-zinc-500">ผู้สั่ง {job.triggeredBy ?? 'ระบบ'} · สร้าง {thaiTime(job.createdAt)}{job.finishedAt ? ` · จบ ${thaiTime(job.finishedAt)}` : ''}</p>{job.errorCode && <p className="text-sm text-red-700">{job.errorCode}</p>}<div className="flex flex-wrap gap-3 text-sm">{job.requestId && <a className="text-emerald-700 underline" href={`#poster-request-${job.requestId}`}>คำขอ {job.requestId}</a>}{job.uploadId && <a className="text-emerald-700 underline" href={`#poster-file-${job.uploadId}`}>ไฟล์ {job.uploadId}</a>}{job.parentJobId && <a className="text-emerald-700 underline" href={`#poster-mail-${job.parentJobId}`}>งานอีเมลเดิม {job.parentJobId}</a>}</div>{job.state === 'unknown' && <p className="text-sm text-amber-800">ผลส่งไม่แน่ชัด การส่งซ้ำอาจได้รับอีเมลซ้ำ</p>}<div className="flex flex-wrap gap-2"><button className="btn-secondary" onClick={() => setEmail({ kind: 'stored', job })}>ดูอีเมลที่บันทึกไว้</button><button className="btn-secondary" onClick={() => setAttemptJob(job)}>ดูประวัติความพยายาม ({job.attempts.length})</button>{manage && <button className="btn-secondary" disabled={!canResendPosterJob(job, detail)} onClick={() => setEmail({ kind: 'resend', job })}>ตรวจและส่งซ้ำ</button>}</div></article>)}</section>
      <section className="card"><h2 className="mb-4 text-xl font-semibold">ประวัติการจัดการ ({detail.audit.length})</h2>{detail.audit.map((item, index) => <article key={index} className="border-t border-zinc-200 py-4"><PosterSnapshot value={thaiHistory(item)} /></article>)}</section>
      {eventId && abstractId && token && email && (email.kind === 'stored' || manage) && <PosterEmailDialog key={`${email.kind}:${email.job.id}`} eventId={eventId} abstractId={abstractId} token={token} kind={email.kind} job={email.job} onClose={() => setEmail(null)} onResent={jobId => reload(`สร้างงานอีเมลส่งซ้ำแล้ว ${jobId} · รอผลจากผู้ให้บริการ`)} onConflict={message => reload(`ข้อมูลเปลี่ยนแล้ว: ${message} · กรุณาตรวจข้อมูลล่าสุด`)} />}
      {manage && eventId && abstractId && token && (revisionOpen || cancelRequest) && <PosterRevisionDialog eventId={eventId} abstractId={abstractId} token={token} request={cancelRequest ?? undefined} onClose={() => { setRevisionOpen(false); setCancelRequest(null); }} onCreated={request => reload(request.status === 'cancelled' ? 'ยกเลิกคำขอแล้ว เก็บประวัติและไฟล์ที่รับสำเร็จไว้' : 'สร้างสิทธิ์แก้ไขและงานอีเมลแล้ว ผลส่งอีเมลแสดงแยกในประวัติ')} onConflict={message => reload(`ข้อมูลเปลี่ยนแล้ว: ${message} · กรุณาตรวจข้อมูลล่าสุด`)} />}
      {attemptJob && <PosterDialog title="ประวัติความพยายามส่งอีเมล" onClose={() => setAttemptJob(null)}><PosterSnapshot value={thaiHistory(attemptJob.attempts)} /></PosterDialog>}
    </>}
  </div></AdminLayout>;
}

export default function PosterDetailPage() {
  return <Suspense fallback={<p role="status">กำลังโหลดรายละเอียด…</p>}><PosterDetailContent /></Suspense>;
}
