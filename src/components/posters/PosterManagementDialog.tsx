'use client';

import { useRef, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { deadlineInputToClose, thaiDeadlineInput } from '@/lib/posterUi';
import type { PosterListRow, PosterSettingsDto } from '@/types/posters';
import { PosterDialog, PosterSnapshot } from './PosterDialog';
import { thaiTime } from './PosterTable';

export function PosterManagementDialog({ eventId, token, row, settings, onClose, onSaved }: {
  eventId: number; token: string; row?: PosterListRow; settings: PosterSettingsDto; onClose: () => void; onSaved: (stale?: boolean) => void;
}) {
  const [reason, setReason] = useState('');
  const [deadline, setDeadline] = useState(() => thaiDeadlineInput(settings.closesAt));
  const [busy, setBusy] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const key = useRef(crypto.randomUUID());
  const lock = useRef(false);
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (lock.current || !reason.trim() || (row && row.matchState !== 'alias_pending')) return;
    lock.current = true; setBusy(true); setFailure(null); setAttempted(true);
    try {
      if (row) await api.posters.verify(eventId, { sourceKey: row.sourceKey, fingerprint: row.matchFingerprint, reason }, key.current, token);
      else await api.posters.settings(eventId, { closesAt: deadlineInputToClose(deadline), version: settings.version, reason }, key.current, token);
      onSaved(); onClose();
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        onSaved(true); onClose();
      } else {
        setFailure(error instanceof Error ? error.message : 'บันทึกไม่สำเร็จ');
        if (error instanceof ApiError && error.status < 500) { setAttempted(false); key.current = crypto.randomUUID(); }
      }
    } finally { lock.current = false; setBusy(false); }
  };
  return <PosterDialog title={row ? 'ตรวจและรับรองรหัสเดิม' : 'เปลี่ยนกำหนดส่ง Poster'} busy={busy} onClose={onClose}>
    {row ? <><p className="mb-4">รับรองเฉพาะรหัสเดิมที่ข้อมูลอื่นตรงกัน: {row.announcement.trackingId} · abstractId {row.abstractId}</p><PosterSnapshot value={row.snapshot} /></> : <p className="mb-4">วันสุดท้ายเดิม (เวลาไทย): {thaiTime(new Date(Date.parse(settings.closesAt) - 1000).toISOString())}</p>}
    <form onSubmit={save} className="mt-5 space-y-4">
      {!row && <><label className="block">วันสุดท้ายเวลาไทย (Asia/Bangkok)<input className="input-field mt-2" type="datetime-local" step="1" required value={deadline} disabled={busy || attempted} onChange={event => setDeadline(event.target.value)} /></label><p>วันสุดท้ายใหม่ (เวลาไทย): {deadline.replace('T', ' ')} · ค่าปิดรับเดิม UTC: {settings.closesAt}</p></>}
      <label className="block">เหตุผล (จำเป็น)<textarea className="input-field mt-2" required maxLength={10000} rows={3} value={reason} disabled={busy || attempted} onChange={event => setReason(event.target.value)} /></label>
      {failure && <p role="alert" className="text-red-700">{failure}{attempted ? ' · กดบันทึกอีกครั้งด้วยคำขอเดิมเพื่อตรวจผล' : ''}</p>}
      <button className="btn-primary" disabled={busy || !reason.trim()}>{busy ? 'กำลังบันทึก…' : row ? 'รับรองรหัสเดิม' : 'ยืนยันวันสุดท้ายใหม่'}</button>
      <p className="text-xs text-zinc-500">หากข้อมูลเปลี่ยนระหว่างบันทึก ระบบจะโหลดข้อมูลล่าสุด กรุณาตรวจและเปิดแบบฟอร์มใหม่</p>
    </form>
  </PosterDialog>;
}
