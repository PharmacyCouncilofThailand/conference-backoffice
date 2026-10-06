'use client';

import Link from 'next/link';
import type { PosterListRow } from '@/types/posters';
import { PosterSnapshot } from './PosterDialog';

export const progressLabels = { not_submitted: 'ยังไม่ส่ง', submitted: 'ส่งแล้ว', revision_pending: 'รอแก้ไข', revised: 'แก้ไขแล้ว', revision_expired: 'หมดเวลาแก้ไข' };
export const matchLabels = { ready: 'พร้อมใช้งาน', alias_pending: 'รอรับรองรหัสเดิม', conflict: 'ข้อมูลขัดกัน', missing: 'ไม่พบในฐานข้อมูล', incomplete: 'ข้อมูลไม่ครบ', withdrawn: 'ถอนจากประกาศ' };
export const mailLabels = { pending: 'รอส่ง', sending: 'กำลังส่ง', sent: 'ผู้ให้บริการรับอีเมลแล้ว', failed: 'ส่งล้มเหลว', unknown: 'ไม่ทราบผลส่ง', suppressed: 'พักการส่ง' };
export const thaiTime = (value: string) => new Date(value).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'medium' });

export function PosterTable({ rows, manage, selected, onSelect, onVerify, eventId, view, closesAt }: {
  rows: PosterListRow[]; manage: boolean; selected: Set<number>; onSelect: (id: number) => void; onVerify: (row: PosterListRow) => void;
  eventId: number; view: 'verify' | 'notifications' | 'received'; closesAt: string;
}) {
  return <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white"><table className="w-full min-w-[850px] text-left text-sm">
    <caption className="sr-only">รายชื่อ Poster และผลตรวจ</caption>
    <thead className="bg-zinc-50 text-zinc-600"><tr>{manage && view === 'notifications' && <th className="p-4">เลือก</th>}<th className="p-4">Tracking ID / ผลงาน</th><th className="p-4">ผู้ส่ง</th><th className="p-4">ผลตรวจรายชื่อ</th><th className="p-4">Poster / Email</th><th className="p-4">รายละเอียด</th></tr></thead>
    <tbody>{rows.map(row => <tr key={row.sourceKey} className="border-t border-zinc-200 align-top">
      {manage && view === 'notifications' && <td className="p-4">{row.abstractId !== null && <input type="checkbox" aria-label={`เลือก ${row.announcement.trackingId ?? row.sourceKey}`} disabled={!row.canNotify} checked={selected.has(row.abstractId)} onChange={() => onSelect(row.abstractId!)} />}</td>}
      <td className="max-w-md p-4"><strong>{row.announcement.trackingId ?? 'ข้อมูลรหัสไม่ครบ'}</strong><p className="my-2 whitespace-normal break-words">{row.announcement.title}</p><p className="text-xs text-zinc-500">Round {row.announcement.round} · {row.announcement.presentationType}</p></td>
      <td className="p-4">{row.announcement.submitterName ?? 'ข้อมูลชื่อไม่ครบ'}<p className="mt-2 break-all text-zinc-500">{row.submitterEmail ?? 'ไม่พบอีเมลผู้ส่ง'}</p></td>
      <td className="max-w-sm p-4"><span className={row.matchState === 'ready' ? 'text-emerald-700' : 'text-amber-800'}>{matchLabels[row.matchState]}</span><ul className="mt-2 space-y-1 text-xs">{row.problems.map(problem => <li key={problem}>{problem}</li>)}</ul>
        {row.matchState === 'conflict' && <p className="mt-2 text-xs text-red-700">แก้ข้อมูลต้นทางหรือฐานข้อมูลด้วยเครื่องมือเดิม แล้วตรวจรายชื่อซ้ำ ไม่สามารถรับรองข้ามข้อมูลขัดกันได้</p>}
        {view === 'verify' && <details className="mt-3"><summary className="cursor-pointer text-emerald-700">ข้อมูลประกาศ / ฐานข้อมูล</summary><div className="mt-3"><PosterSnapshot value={row.snapshot} /></div></details>}
        {manage && row.matchState === 'alias_pending' && <button className="btn-secondary mt-3" onClick={() => onVerify(row)}>ตรวจและรับรองรหัสเดิม</button>}
      </td>
      <td className="p-4"><strong>{progressLabels[row.progress]}</strong><p className="mt-2 text-xs">{row.lastEmail ? `${row.lastEmail.kind} · ${mailLabels[row.lastEmail.state]}` : 'ยังไม่แจ้ง'}</p>{row.lastEmail && <p className="text-xs text-zinc-500">{thaiTime(row.lastEmail.createdAt)}</p>}
        {row.currentUpload && <><a className="mt-3 block text-emerald-700 underline" href={row.currentUpload.publicUrl} target="_blank" rel="noopener noreferrer">ดู Poster · ฉบับ {row.currentUpload.version}</a><p className="text-xs text-zinc-500">รับ {thaiTime(row.currentUpload.receivedAt)}</p></>}
        <p className="mt-3 text-xs text-zinc-500">วันสุดท้าย {thaiTime(new Date(Date.parse(row.activeRequest?.closesAt ?? closesAt) - 1000).toISOString())} (ไทย)</p>
        {row.activeRequest && <p className="text-xs">คำขอแก้ไข: {row.activeRequest.status}</p>}
      </td>
      <td className="p-4">{row.abstractId !== null && <Link className="text-emerald-700 underline" href={`/posters/${row.abstractId}?eventId=${eventId}`}>ดูประวัติ</Link>}</td>
    </tr>)}</tbody>
  </table>{rows.length === 0 && <p className="p-8 text-center text-zinc-500">ไม่พบรายการตามตัวกรอง</p>}</div>;
}
