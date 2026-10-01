'use client';

import { useEffect, useRef, useState } from 'react';
import { IconLoader2, IconX } from '@tabler/icons-react';
import { api } from '@/lib/api';
import type { GrantSessionChoiceDto } from '@/types/session-grants';

interface AddSessionDialogProps {
  open: boolean;
  eventId: number;
  existingSessionIds: number[];
  onClose: () => void;
  onSessionSelected: (session: GrantSessionChoiceDto) => void;
}

const getBackofficeToken = () =>
  localStorage.getItem('backoffice_token') ||
  sessionStorage.getItem('backoffice_token') ||
  '';

export function AddSessionDialog({
  open,
  eventId,
  existingSessionIds,
  onClose,
  onSessionSelected,
}: AddSessionDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const [sessions, setSessions] = useState<GrantSessionChoiceDto[]>([]);
  const [serverNow, setServerNow] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      returnFocusRef.current = document.activeElement as HTMLElement | null;
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const trapTab = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const dialog = dialogRef.current;
      if (!dialog?.open) return;
      const focusable = [...dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )].filter((element) => element.offsetParent !== null);
      if (focusable.length === 0) return;
      const active = document.activeElement as HTMLElement | null;
      const activeIndex = active ? focusable.indexOf(active) : -1;
      event.preventDefault();
      if (event.shiftKey) {
        const previousIndex = activeIndex <= 0 ? focusable.length - 1 : activeIndex - 1;
        focusable[previousIndex].focus();
      } else {
        const nextIndex = activeIndex < 0 || activeIndex >= focusable.length - 1 ? 0 : activeIndex + 1;
        focusable[nextIndex].focus();
      }
    };
    document.addEventListener('keydown', trapTab, true);
    return () => document.removeEventListener('keydown', trapTab, true);
  }, [open]);

  useEffect(() => {
    if (!open || !eventId) return;
    let current = true;
    setLoading(true);
    setError(null);
    api.backofficeEvents.getSessions(getBackofficeToken(), eventId, true)
      .then((response) => {
        if (!current) return;
        setSessions(response.sessions as GrantSessionChoiceDto[]);
        setServerNow(response.serverNow || null);
      })
      .catch((err: Error) => {
        if (current) setError(err.message || 'ไม่สามารถโหลด Session ได้');
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => { current = false; };
  }, [eventId, open]);

  const close = () => {
    onClose();
    queueMicrotask(() => returnFocusRef.current?.focus());
  };

  const existing = new Set(existingSessionIds);
  const now = serverNow ? new Date(serverNow).getTime() : Date.now();

  return (
    <dialog
      ref={dialogRef}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClose={() => {
        if (open) onClose();
        queueMicrotask(() => returnFocusRef.current?.focus());
      }}
      className="w-[min(720px,calc(100vw-2rem))] rounded-2xl p-0 shadow-2xl backdrop:bg-black/40"
      aria-labelledby="session-grant-dialog-title"
    >
      <div className="border-b border-zinc-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h2 id="session-grant-dialog-title" className="text-lg font-semibold text-zinc-900">
            เลือก Session ที่จะเพิ่มสิทธิ์
          </h2>
          <p className="text-sm text-zinc-500">Session ที่สิ้นสุดแล้วหรือไม่เปิดใช้งานจะเลือกไม่ได้</p>
        </div>
        <button type="button" onClick={close} className="p-2 rounded-lg hover:bg-zinc-100" aria-label="ปิด">
          <IconX size={20} />
        </button>
      </div>
      <div className="max-h-[65vh] overflow-y-auto p-6">
        {loading ? (
          <div className="flex justify-center py-10"><IconLoader2 className="animate-spin" /></div>
        ) : error ? (
          <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700" role="alert">{error}</p>
        ) : sessions.length === 0 ? (
          <p className="py-10 text-center text-zinc-500">ไม่พบ Session สำหรับ Event นี้</p>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => {
              const ended = new Date(session.endTime).getTime() <= now;
              const alreadyOwned = existing.has(session.id);
              const disabled = !session.grantEligible || ended || alreadyOwned;
              const reason = alreadyOwned
                ? 'มีสิทธิ์ Session นี้แล้ว'
                : session.disabledReason === 'SESSION_INACTIVE'
                  ? 'Session ไม่เปิดใช้งาน'
                  : session.disabledReason === 'SESSION_ENDED' || ended
                    ? 'Session สิ้นสุดแล้ว'
                    : null;
              return (
                <button
                  key={session.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    onSessionSelected(session);
                    close();
                  }}
                  className="w-full rounded-xl border border-zinc-200 p-4 text-left transition hover:border-emerald-400 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:opacity-60"
                  aria-describedby={reason ? `session-${session.id}-reason` : undefined}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium text-zinc-900">{session.sessionName}</p>
                      <p className="mt-1 text-sm text-zinc-500">
                        {new Date(session.startTime).toLocaleString('th-TH')} – {new Date(session.endTime).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                        {session.room ? ` · ${session.room}` : ''}
                      </p>
                    </div>
                    <span className="text-xs text-zinc-500">ผู้มีสิทธิ์ {session.enrollmentCount}</span>
                  </div>
                  {reason && <p id={`session-${session.id}-reason`} className="mt-2 text-sm text-red-600">{reason}</p>}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </dialog>
  );
}
