'use client';

import { useEffect, useRef, useState } from 'react';
import { IconLoader2, IconX } from '@tabler/icons-react';
import { api } from '@/lib/api';
import type { GrantEmailPreview, GrantPreviewRequest } from '@/types/session-grants';

interface Props {
  request: GrantPreviewRequest;
  submitting: boolean;
  onClose: () => void;
  onConfirm: (request: GrantPreviewRequest) => Promise<void>;
}

export function SessionEmailPreviewDialog({ request, submitting, onClose, onConfirm }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [preview, setPreview] = useState<GrantEmailPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => {
      dialog?.close();
      previousFocus?.focus();
    };
  }, []);

  useEffect(() => {
    let active = true;
    const token = localStorage.getItem('backoffice_token') || sessionStorage.getItem('backoffice_token') || '';
    void api.sessionGrants.preview(token, { sessionId: request.sessionId, registrationIds: request.registrationIds })
      .then(result => { if (active) setPreview(result); })
      .catch(err => { if (active) setError(err instanceof Error ? err.message : 'โหลดตัวอย่างอีเมลไม่สำเร็จ'); });
    return () => { active = false; };
  }, [request, reload]);

  const email = preview?.emails[index];
  return (
    <dialog ref={dialogRef} aria-labelledby="session-email-preview-title"
      onCancel={event => { event.preventDefault(); if (!submitting) onClose(); }}
      className="fixed inset-0 m-auto w-[min(800px,calc(100vw-2rem))] max-h-[calc(100dvh-2rem)] rounded-2xl p-0 shadow-2xl backdrop:bg-black/40">
      <div className="flex items-center justify-between gap-4 border-b border-zinc-200 px-6 py-4">
        <div>
          <h2 id="session-email-preview-title" className="text-lg font-semibold text-zinc-900">ตัวอย่างอีเมลก่อนส่ง</h2>
          <p className="mt-1 text-sm text-zinc-600">ตรวจผู้รับและเนื้อหา แล้วกดยืนยันเพื่อเพิ่มสิทธิ์หรือสร้างคำเชิญและส่งอีเมล</p>
        </div>
        <button type="button" onClick={onClose} disabled={submitting} aria-label="ปิดตัวอย่างอีเมล" className="rounded-lg p-2 hover:bg-zinc-100 disabled:opacity-40"><IconX size={20} /></button>
      </div>
      <div className="max-h-[65dvh] overflow-y-auto px-6 py-4">
        {!preview && !error && <p role="status" className="flex items-center gap-2 py-8 text-zinc-600"><IconLoader2 className="animate-spin" size={20} />กำลังโหลดตัวอย่างอีเมล...</p>}
        {error && <div role="alert" className="space-y-3 text-sm text-red-700"><p>{error}</p><button type="button" className="btn-secondary" onClick={() => { setError(null); setReload(value => value + 1); }}>ลองโหลดอีกครั้ง</button></div>}
        {preview && preview.skipped.length > 0 && <p className="mb-4 text-sm text-amber-800">ข้าม {preview.skipped.length} รายการที่ไม่มีสิทธิ์รับอีเมลในขณะนี้ ระบบจะตรวจรายการอีกครั้งเมื่อกดส่ง</p>}
        {preview && !email && <p className="py-8 text-zinc-600">ไม่มีอีเมลที่จะส่ง กรุณาย้อนกลับเพื่อปรับรายการผู้รับ</p>}
        {email && <>
          <div aria-live="polite" className="mb-4 space-y-2 break-words text-sm text-zinc-800">
            <p><span className="font-semibold">ผู้รับ:</span> {email.name} &lt;{email.recipient}&gt;</p>
            <p><span className="font-semibold">หัวข้อ:</span> {email.subject}</p>
          </div>
          <iframe title={`เนื้อหาอีเมลสำหรับ ${email.name}`} sandbox="" referrerPolicy="no-referrer"
            srcDoc={email.html.replaceAll('<a ', '<a inert tabindex="-1" ').replace('<body>', '<head><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{overflow-wrap:anywhere}a{pointer-events:none}</style></head><body>')}
            className="h-[38dvh] min-h-56 w-full rounded-lg border border-zinc-200 bg-white" />
          {email.html.includes('<a ') && <p className="mt-2 text-xs text-zinc-600">ลิงก์ตอบรับในตัวอย่างใช้งานไม่ได้ ผู้รับจะได้รับลิงก์จริงทางอีเมล</p>}
          <div className="mt-4 flex items-center justify-between gap-3">
            <button type="button" className="btn-secondary" disabled={index === 0 || submitting} onClick={() => setIndex(value => value - 1)}>ก่อนหน้า</button>
            <p aria-live="polite" className="text-sm tabular-nums text-zinc-700">{index + 1} / {preview!.emails.length}</p>
            <button type="button" className="btn-secondary" disabled={index === preview!.emails.length - 1 || submitting} onClick={() => setIndex(value => value + 1)}>ถัดไป</button>
          </div>
        </>}
      </div>
      <div className="flex flex-wrap justify-end gap-3 border-t border-zinc-200 px-6 py-4">
        <button type="button" className="btn-secondary" disabled={submitting} onClick={onClose}>ย้อนกลับ</button>
        <button type="button" className="btn-primary" disabled={!email || submitting || !!error} onClick={() => {
          if (!preview || !email || submitting || error) return;
          void onConfirm({ ...request, registrationIds: preview.emails.map(item => item.registrationId) });
        }}>
          {submitting ? 'กำลังดำเนินการ...' : `ยืนยันและส่งทั้งหมด ${preview?.emails.length ?? 0} ฉบับ`}
        </button>
      </div>
    </dialog>
  );
}
