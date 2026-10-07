'use client';
/* eslint-disable react-hooks/set-state-in-effect -- clear scoped data and dialogs before the next staff API read */

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { IconArrowLeft, IconRefresh, IconFileText, IconPencil, IconHistory, IconUser, IconMail, IconShieldCheck } from '@tabler/icons-react';
import { useParams, useSearchParams } from 'next/navigation';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { activePosterRequest, canResendPosterJob, isPosterActionAudit, posterAuditSummary, posterRouteId } from '@/lib/posterUi';
import type { PosterDetailDto, RevisionDto } from '@/types/posters';
import { PosterDialog } from '@/components/posters/PosterDialog';
import { PosterComparison, PosterEmailAttempts, posterProblemLabel } from '@/components/posters/PosterHistoryViews';
import { PosterEmailDialog } from '@/components/posters/PosterEmailDialog';
import { PosterRevisionDialog } from '@/components/posters/PosterRevisionDialog';
import { mailLabels, matchLabels, progressLabels, progressColors, thaiTime } from '@/components/posters/PosterTable';

function PosterDetailContent() {
  const params = useParams();
  const query = useSearchParams();
  const { user, token, isAdmin, isLoading } = useAuth();
  const abstractId = posterRouteId(params.abstractId);
  const eventId = query.getAll('eventId').length === 1 ? posterRouteId(query.get('eventId')) : null;
  const readable = !!user && ['admin', 'organizer', 'reviewer'].includes(user.role);
  const allowed = readable && !!eventId && (isAdmin || !!user?.assignedEvents.some(event => event.id === eventId && event.code === 'PRIS-2026'));
  const scope = `${isAdmin}:${eventId}:${abstractId}:${token}`;
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
  const audit = detail ? isAdmin ? detail.audit : detail.audit.filter(isPosterActionAudit) : [];
  const active = detail ? activePosterRequest(detail.requests) : null;
  const reload = (message?: string) => { if (message) setNotice(message); setRefresh(value => value + 1); };
  return <AdminLayout title="รายละเอียด Poster"><div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><Link className="flex items-center gap-2 text-zinc-500 transition-colors hover:text-zinc-800" href="/posters"><IconArrowLeft size={20} />กลับรายชื่อ Poster</Link><button className="btn-secondary flex items-center gap-2" onClick={() => reload()}><IconRefresh size={18} />โหลดข้อมูลล่าสุด</button></div>
    {!eventId || !abstractId ? <p role="alert">รหัส Event หรือผลงานไม่ถูกต้อง ต้องเป็นจำนวนเต็มบวก</p> : isLoading ? <p role="status">กำลังโหลดสิทธิ์…</p> : !allowed ? <p role="alert">ไม่มีสิทธิ์ดู Poster ของ Event นี้</p> : error ? <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-700">{error}</p> : !detail ? <p role="status">กำลังโหลดรายละเอียด…</p> : <>
      {notice && <p role="status" className="rounded-lg bg-emerald-50 p-4 text-emerald-800">{notice}</p>}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <section className="card"><div className="mb-4 flex flex-wrap items-start justify-between gap-3"><span className="font-mono text-sm text-zinc-400">{detail.row.announcement.trackingId ?? 'ข้อมูลรหัสไม่ครบ'}</span><span className={`rounded-full px-3 py-1 text-sm font-medium ${progressColors[detail.row.progress]}`}>{progressLabels[detail.row.progress]}</span></div><h1 className="mb-4 text-2xl font-bold leading-relaxed text-zinc-800">{detail.row.announcement.title}</h1><div className="flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-cyan-100 px-2.5 py-1 font-medium text-cyan-800">{detail.row.announcement.presentationType === 'highlighted-poster' ? 'Highlighted Poster' : 'Poster'}</span><span className="rounded-full bg-zinc-100 px-2.5 py-1 text-zinc-600">Round {detail.row.announcement.round}</span></div></section>
      <section className="card space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-800"><IconFileText size={20} className="text-emerald-600" />Poster ฉบับปัจจุบัน</h2>{manage && <button className="btn-primary" disabled={!detail.row.currentUpload || !!active} onClick={() => setRevisionOpen(true)}>ขอแก้ไข Poster</button>}</div>
        {active && <p className="rounded-lg bg-amber-50 p-3 text-amber-800">มีคำขอแก้ไขที่เปิดอยู่ · {active.id} · ไฟล์ฉบับปัจจุบันยังคงเป็นไฟล์ที่รับสำเร็จ</p>}
        {detail.row.currentUpload ? <><p>ฉบับ {detail.row.currentUpload.version} · {detail.row.currentUpload.fileName} · รับ {thaiTime(detail.row.currentUpload.receivedAt)}</p>
          {detail.row.currentUpload.mimeType === 'image/png'
            // Original public PNG stays unchanged; next/image remote transforms are intentionally unused.
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={detail.row.currentUpload.publicUrl} alt={`Poster ${detail.row.announcement.title} ฉบับ ${detail.row.currentUpload.version}`} loading="lazy" className="max-h-[650px] max-w-full rounded-lg border border-zinc-200 object-contain" />
            : <iframe src={detail.row.currentUpload.publicUrl} title={`Poster PDF ฉบับ ${detail.row.currentUpload.version}`} loading="lazy" referrerPolicy="no-referrer" className="h-[600px] w-full rounded-lg border border-zinc-200" />}
          <a className="block text-emerald-700 underline" href={detail.row.currentUpload.publicUrl} target="_blank" rel="noopener noreferrer">เปิดไฟล์สาธารณะในแท็บใหม่ (หากแสดงตัวอย่างไม่ได้)</a></> : <p className="text-zinc-500">ยังไม่มีไฟล์ Poster ที่รับสำเร็จ</p>}
      </section>
      <section className="card"><h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-zinc-800"><IconFileText size={20} className="text-emerald-600" />ไฟล์ทุกฉบับ ({detail.uploads.length})</h2>{detail.uploads.map(file => <article id={`poster-file-${file.id}`} key={file.id} className="mb-3 space-y-2 rounded-lg border border-zinc-200 bg-zinc-50 p-4 last:mb-0"><h3 className="font-semibold text-zinc-800">ฉบับที่ {file.version}{detail.row.currentUpload?.id === file.id ? ' · ฉบับปัจจุบัน' : ''}</h3><a className="break-words text-emerald-700 underline" href={file.publicUrl} target="_blank" rel="noopener noreferrer">{file.fileName} · ไฟล์สาธารณะ</a><p className="text-sm text-zinc-500">{file.mimeType} · {(file.sizeBytes / 1024 / 1024).toFixed(2)} MB · รับ {thaiTime(file.receivedAt)}</p>{file.revisionRequestId ? <a className="text-sm text-emerald-700 underline" href={`#poster-request-${file.revisionRequestId}`}>ตอบคำขอแก้ไข {file.revisionRequestId}</a> : <p className="text-sm">ไฟล์ครั้งแรก</p>}</article>)}</section>
      <section className="card"><h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-zinc-800"><IconPencil size={20} className="text-amber-600" />คำขอแก้ไข ({detail.requests.length})</h2><p className="mb-4 text-sm text-zinc-500">รายละเอียดและกำหนดส่งของคำขอเดิมเปลี่ยนไม่ได้ ต้องยกเลิกพร้อมเหตุผลแล้วสร้างใหม่</p>{detail.requests.map(request => <article id={`poster-request-${request.id}`} key={request.id} className="mb-4 space-y-2 rounded-xl border border-amber-100 bg-amber-50/40 p-4 last:mb-0"><h3 className="font-semibold text-zinc-800">{request.status} · {request.id}</h3><p className="text-sm text-zinc-500">ผู้ขอ {request.requestedBy} · {thaiTime(request.createdAt)}</p><p className="whitespace-pre-wrap">{request.details}</p><p>วันสุดท้ายเวลาไทย {thaiTime(new Date(Date.parse(request.closesAt) - 1000).toISOString())}</p>{request.cancelledAt && <p>ยกเลิกโดย {request.cancelledBy} · {thaiTime(request.cancelledAt)} · {request.cancellationReason}</p>}{request.submittedAt && <p>รับฉบับแก้ไข {thaiTime(request.submittedAt)}</p>}{detail.uploads.filter(file => file.revisionRequestId === request.id).map(file => <a key={file.id} className="block text-sm text-emerald-700 underline" href={`#poster-file-${file.id}`}>ไฟล์ตอบคำขอนี้ · ฉบับ {file.version}</a>)}{manage && request.status === 'open' && <button className="btn-danger" onClick={() => setCancelRequest(request)}>ยกเลิกคำขอ</button>}</article>)}</section>
      </div>
      <aside className="space-y-6">
        <section className="card"><h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-zinc-800"><IconUser size={20} className="text-emerald-600" />ข้อมูลผู้ส่ง</h2><div className="space-y-3 text-sm"><p className="flex items-start gap-3 font-medium text-zinc-800"><IconUser size={16} className="mt-0.5 shrink-0 text-zinc-400" />{detail.row.announcement.submitterName}</p><p className="flex items-start gap-3 break-all text-zinc-500"><IconMail size={16} className="mt-0.5 shrink-0 text-zinc-400" />{detail.row.submitterEmail ?? 'ไม่พบอีเมลผู้ส่ง'}</p></div></section>
        <section className="card"><h2 className="mb-4 text-lg font-semibold text-zinc-800">ข้อมูลผลงาน</h2><dl className="space-y-3 text-sm"><div className="flex items-start justify-between gap-4 border-b border-zinc-100 py-2"><dt className="text-zinc-400">Event</dt><dd className="font-medium text-zinc-800">PRIS 2026</dd></div><div className="flex items-start justify-between gap-4 border-b border-zinc-100 py-2"><dt className="text-zinc-400">หมวด</dt><dd className="text-right font-medium text-zinc-800">{detail.row.announcement.categoryName ?? '—'}</dd></div><div className="flex items-start justify-between gap-4 py-2"><dt className="text-zinc-400">วันที่รับล่าสุด</dt><dd className="text-right font-medium text-zinc-800">{detail.row.currentUpload ? thaiTime(detail.row.currentUpload.receivedAt) : 'ยังไม่ได้รับไฟล์'}</dd></div></dl></section>
        {isAdmin && <section className="card space-y-3"><h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-800"><IconShieldCheck size={20} className="text-emerald-600" />ผลตรวจและการรับรอง</h2><p className="text-sm text-zinc-600">{detail.row.matchState ? matchLabels[detail.row.matchState] : '—'}</p><ul className="space-y-1 text-sm text-amber-800">{detail.row.problems.map(problem => <li key={problem}>{posterProblemLabel(problem)}</li>)}</ul><details><summary className="cursor-pointer text-sm font-medium text-emerald-600">ประกาศ / ฐานข้อมูล / ผลตรวจ</summary><div className="mt-4"><PosterComparison value={detail.row.snapshot} /></div></details><p className="text-xs leading-relaxed text-zinc-400">รับรองโดย {detail.row.verifiedBy ?? '—'} · {detail.row.verifiedAt ? thaiTime(detail.row.verifiedAt) : 'ยังไม่รับรอง'} · {detail.row.verificationReason ?? '—'}</p></section>}
      </aside>
      </div>
      {isAdmin && <section className="card"><h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-zinc-800"><IconMail size={20} className="text-emerald-600" />ประวัติอีเมล ({detail.emailJobs.length})</h2><p className="mb-4 text-sm text-zinc-500">ผลอีเมลไม่เปลี่ยนสิทธิ์แก้ไขหรือไฟล์ที่รับสำเร็จ ไม่มีการส่งซ้ำอัตโนมัติเมื่อไม่ทราบผล</p>{detail.emailJobs.map(job => <article id={`poster-mail-${job.id}`} key={job.id} className="mb-4 space-y-2 rounded-xl border border-zinc-200 bg-zinc-50 p-4 last:mb-0"><h3 className="font-semibold text-zinc-800">{job.kind} · {mailLabels[job.state]}</h3><p>{job.recipient}</p><p>{job.subject}</p><p className="text-sm text-zinc-500">ผู้สั่ง {job.triggeredBy ?? 'ระบบ'} · สร้าง {thaiTime(job.createdAt)}{job.finishedAt ? ` · จบ ${thaiTime(job.finishedAt)}` : ''}</p>{job.errorCode && <p className="text-sm text-red-700">{job.errorCode}</p>}<div className="flex flex-wrap gap-3 text-sm">{job.requestId && <a className="text-emerald-700 underline" href={`#poster-request-${job.requestId}`}>คำขอ {job.requestId}</a>}{job.uploadId && <a className="text-emerald-700 underline" href={`#poster-file-${job.uploadId}`}>ไฟล์ {job.uploadId}</a>}{job.parentJobId && <a className="text-emerald-700 underline" href={`#poster-mail-${job.parentJobId}`}>งานอีเมลเดิม {job.parentJobId}</a>}</div>{job.state === 'unknown' && <p className="text-sm text-amber-800">ผลส่งไม่แน่ชัด การส่งซ้ำอาจได้รับอีเมลซ้ำ</p>}<div className="flex flex-wrap gap-2"><button className="btn-secondary" onClick={() => setEmail({ kind: 'stored', job })}>ดูอีเมลที่บันทึกไว้</button><button className="btn-secondary" onClick={() => setAttemptJob(job)}>ดูประวัติความพยายาม ({job.attempts.length})</button>{manage && <button className="btn-secondary" disabled={!canResendPosterJob(job, detail)} onClick={() => setEmail({ kind: 'resend', job })}>ตรวจและส่งซ้ำ</button>}</div></article>)}</section>}
      <section className="card"><h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-zinc-800"><IconHistory size={20} className="text-emerald-600" />ประวัติการจัดการ ({audit.length})</h2>{!audit.length && <p className="text-zinc-500">ยังไม่มีประวัติการจัดการของผลงานนี้</p>}{audit.map((item, index) => {
        const entry = posterAuditSummary(item);
        return <article key={index} className="relative ml-2 space-y-3 border-l-2 border-emerald-100 py-5 pl-6"><span aria-hidden="true" className="absolute -left-[7px] top-6 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" /><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{entry.action}</h3><span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-800">{entry.actor}</span></div><p className="text-sm text-zinc-500">{entry.createdAt ? thaiTime(entry.createdAt) : 'ไม่ระบุเวลา'}</p>{entry.change && <p className="text-sm">{entry.change}</p>}{entry.closesAt && <p className="text-sm">ปิดรับฉบับแก้ไข {thaiTime(entry.closesAt)} (เวลาประเทศไทย)</p>}{entry.reason && <p className="whitespace-pre-wrap break-words text-sm">เหตุผล: {entry.reason}</p>}{entry.changes.length > 0 && <details><summary className="cursor-pointer text-sm font-medium text-emerald-700">ดูรายละเอียดการเปลี่ยนแปลง ({entry.changes.length})</summary><div className="mt-3 max-h-80 space-y-4 overflow-auto rounded-lg bg-zinc-50 p-4">{entry.changes.map(field => <div key={field.label}><h4 className="mb-1 text-xs font-semibold text-zinc-500">{field.label}</h4><div className="grid gap-2 text-sm sm:grid-cols-[1fr_auto_1fr]"><p className="whitespace-pre-wrap break-words text-zinc-500"><span className="mr-2 text-xs">เดิม</span>{field.before ? field.date ? thaiTime(field.before) : field.before : '—'}</p><span aria-hidden="true" className="text-emerald-600">→</span><p className="whitespace-pre-wrap break-words text-zinc-900"><span className="mr-2 text-xs text-emerald-700">ใหม่</span>{field.after ? field.date ? thaiTime(field.after) : field.after : '—'}</p></div></div>)}</div></details>}</article>;
      })}</section>
      {eventId && abstractId && token && email && isAdmin && (email.kind === 'stored' || manage) && <PosterEmailDialog key={`${email.kind}:${email.job.id}`} eventId={eventId} abstractId={abstractId} token={token} kind={email.kind} job={email.job} onClose={() => setEmail(null)} onResent={jobId => reload(`สร้างงานอีเมลส่งซ้ำแล้ว ${jobId} · รอผลจากผู้ให้บริการ`)} onConflict={message => reload(`ข้อมูลเปลี่ยนแล้ว: ${message} · กรุณาตรวจข้อมูลล่าสุด`)} />}
      {manage && eventId && abstractId && token && (revisionOpen || cancelRequest) && <PosterRevisionDialog eventId={eventId} abstractId={abstractId} token={token} request={cancelRequest ?? undefined} onClose={() => { setRevisionOpen(false); setCancelRequest(null); }} onCreated={request => reload(request.status === 'cancelled' ? 'ยกเลิกคำขอแล้ว เก็บประวัติและไฟล์ที่รับสำเร็จไว้' : 'สร้างสิทธิ์แก้ไขและงานอีเมลแล้ว ผลส่งอีเมลแสดงแยกในประวัติ')} onConflict={message => reload(`ข้อมูลเปลี่ยนแล้ว: ${message} · กรุณาตรวจข้อมูลล่าสุด`)} />}
      {isAdmin && attemptJob && <PosterDialog title="ประวัติความพยายามส่งอีเมล" onClose={() => setAttemptJob(null)}><PosterEmailAttempts value={attemptJob.attempts} /></PosterDialog>}
    </>}
  </div></AdminLayout>;
}

export default function PosterDetailPage() {
  return <Suspense fallback={<p role="status">กำลังโหลดรายละเอียด…</p>}><PosterDetailContent /></Suspense>;
}
