'use client';

import { useRef, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { deadlineInputToClose } from '@/lib/presentationUi';
import type { PresentationPreviewDto, RevisionDto } from '@/types/presentations';
import { PresentationDialog } from './PresentationDialog';
import { thaiTime } from './PresentationTable';

export function PresentationRevisionDialog({ eventId, abstractId, token, request, onClose, onCreated, onConflict }: {
  eventId: number; abstractId: number; token: string; request?: RevisionDto; onClose: () => void;
  onCreated: (request: RevisionDto) => void; onConflict: (message: string) => void;
}) {
  const [details, setDetails] = useState('');
  const [deadline, setDeadline] = useState('');
  const [preview, setPreview] = useState<PresentationPreviewDto | null>(null);
  const [busy, setBusy] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const key = useRef(crypto.randomUUID());
  const lock = useRef(false);
  const changed = (setter: (value: string) => void, value: string) => {
    if (busy || attempted) return;
    setter(value); setPreview(null); key.current = crypto.randomUUID();
  };
  const fetchPreview = async () => {
    const result = await api.presentations.preview(eventId, { kind: 'revision', abstractId, details, closesAt: deadlineInputToClose(deadline) }, token);
    if (!result.data.requestId || !result.data.closesAt) throw new Error('ตัวอย่างไม่มีข้อมูลคำขอ กรุณาโหลดใหม่');
    setPreview(result.data);
  };
  const review = async (event: React.FormEvent) => {
    event.preventDefault();
    if (lock.current || attempted || request || !details.trim()) return;
    lock.current = true; setBusy(true); setFailure(null); setPreview(null); key.current = crypto.randomUUID();
    try { await fetchPreview(); }
    catch (error) {
      if (error instanceof ApiError && error.code === 'PRESENTATION_ACTIVE_REQUEST_EXISTS') { onConflict('มีคำขอแก้ไขที่เปิดอยู่แล้ว โหลดข้อมูลล่าสุด'); onClose(); }
      else setFailure(error instanceof Error ? error.message : 'โหลดตัวอย่างไม่สำเร็จ');
    } finally { lock.current = false; setBusy(false); }
  };
  const confirm = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (lock.current || !details.trim() || (request ? request.status !== 'open' : !preview?.requestId || !preview.closesAt)) return;
    lock.current = true; setBusy(true); setFailure(null); setAttempted(true);
    try {
      const result = request
        ? await api.presentations.cancelRevision(eventId, request.id, details, key.current, token)
        : await api.presentations.createRevision(eventId, abstractId, { requestId: preview!.requestId!, details, closesAt: preview!.closesAt!, previewFingerprint: preview!.fingerprint }, key.current, token);
      onCreated('request' in result.data ? result.data.request : result.data); onClose();
    } catch (error) {
      if (error instanceof ApiError && error.code === 'PRESENTATION_PREVIEW_STALE' && !request) {
        setPreview(null); setAttempted(false); key.current = crypto.randomUUID();
        setFailure('ข้อมูลเปลี่ยนแล้ว กรุณาตรวจตัวอย่างใหม่และยืนยันอีกครั้ง');
        try { await fetchPreview(); } catch (previewError) { setFailure(previewError instanceof Error ? previewError.message : 'โหลดตัวอย่างใหม่ไม่สำเร็จ'); }
      } else if (error instanceof ApiError && error.status === 409) {
        onConflict(error.message); onClose();
      } else {
        setFailure(error instanceof Error ? error.message : 'ไม่ทราบผลคำขอ กดยืนยันอีกครั้งด้วยคำขอเดิม');
        if (error instanceof ApiError && error.status < 500) { setAttempted(false); key.current = crypto.randomUUID(); }
      }
    } finally { lock.current = false; setBusy(false); }
  };
  return <PresentationDialog title={request ? 'ยกเลิกคำขอแก้ไข' : 'ขอแก้ไขไฟล์นำเสนอ'} busy={busy || attempted} onClose={onClose}>
    <p className="mb-4">ผลงาน abstractId {abstractId}</p>
    {request && <section className="mb-5 rounded-lg bg-zinc-50 p-4"><p>คำขอ {request.id} · {request.status}</p><p className="my-2 whitespace-pre-wrap">{request.details}</p><p>วันสุดท้ายเวลาไทย {thaiTime(new Date(Date.parse(request.closesAt) - 1000).toISOString())}</p><p className="mt-2 text-sm text-zinc-500">ยกเลิกสิทธิ์เดิม เก็บประวัติและไฟล์ที่รับสำเร็จไว้</p></section>}
    <form onSubmit={request ? confirm : review} className="space-y-4">
      <label className="block">{request ? 'เหตุผลยกเลิก (จำเป็น)' : 'รายละเอียดที่ต้องแก้ไข (จำเป็น)'}<textarea className="input-field mt-2" rows={4} required maxLength={10000} value={details} disabled={busy || attempted} onChange={event => changed(setDetails, event.target.value)} /></label>
      {!request && <label className="block">วันสุดท้ายเวลาไทย (Asia/Bangkok)<input className="input-field mt-2" type="datetime-local" step="1" required value={deadline} disabled={busy || attempted} onChange={event => changed(setDeadline, event.target.value)} /></label>}
      {failure && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">{failure}{attempted ? ' · กดยืนยันอีกครั้งเพื่อตรวจคำขอเดิม' : ''}</p>}
      {request ? <button className="btn-danger" disabled={busy || !details.trim()}>{busy ? 'กำลังยกเลิก…' : 'ยืนยันยกเลิกคำขอ'}</button>
        : <><button className="btn-secondary" disabled={busy || attempted || !details.trim() || !deadline}>ตรวจตัวอย่างอีเมล</button><p className="text-sm text-zinc-500">คำขอสร้างแล้วเปลี่ยนรายละเอียดหรือวันสุดท้ายไม่ได้ ต้องยกเลิกพร้อมเหตุผลแล้วสร้างใหม่</p></>}
    </form>
    {!request && preview && <section className="mt-5 space-y-4 border-t border-zinc-200 pt-5"><p>วันสุดท้ายเวลาไทย {thaiTime(new Date(Date.parse(preview.closesAt!) - 1000).toISOString())}</p>{preview.messages.map(message => <section key={message.abstractId}><p>{message.recipient}</p><h3 className="my-2 font-semibold">{message.subject}</h3><iframe title={`ตัวอย่างอีเมลขอแก้ไข ${message.abstractId}`} sandbox="" referrerPolicy="no-referrer" srcDoc={message.html} className="h-96 w-full rounded-lg border border-zinc-200" /></section>)}<button className="btn-primary" disabled={busy} onClick={() => confirm()}>{busy ? 'กำลังสร้างคำขอ…' : 'ยืนยันสร้างคำขอและงานอีเมล'}</button><p className="text-xs text-zinc-500">ผลอีเมลแสดงแยกจากสิทธิ์แก้ไข อีเมลล้มเหลวไม่ยกเลิกคำขอ</p></section>}
  </PresentationDialog>;
}
