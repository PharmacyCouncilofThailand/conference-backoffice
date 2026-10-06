'use client';

import { useEffect, useRef, type ReactNode } from 'react';

export function PosterDialog({ title, children, onClose, busy = false }: { title: string; children: ReactNode; onClose: () => void; busy?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} aria-labelledby="poster-dialog-title" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }} className="m-auto max-h-[90vh] w-[min(960px,94vw)] overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-6 text-zinc-900 backdrop:bg-zinc-900/50">
    <div className="mb-5 flex items-center justify-between gap-4"><h2 id="poster-dialog-title" className="text-xl font-semibold">{title}</h2><button type="button" className="btn-secondary" disabled={busy} onClick={onClose}>ปิด</button></div>
    {children}
  </dialog>;
}

export function PosterSnapshot({ value }: { value: unknown }) {
  if (value === null || value === undefined) return <span>—</span>;
  if (typeof value !== 'object') return <span className="break-words">{String(value)}</span>;
  return <dl className="space-y-2 border-l border-zinc-200 pl-3">{Object.entries(value).map(([key, item]) => <div key={key}><dt className="text-xs font-semibold text-zinc-500">{key}</dt><dd><PosterSnapshot value={item} /></dd></div>)}</dl>;
}
