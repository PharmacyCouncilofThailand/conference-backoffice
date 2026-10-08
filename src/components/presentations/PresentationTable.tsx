'use client';

import Link from 'next/link';
import { IconEye, IconFileText, IconExternalLink } from '@tabler/icons-react';
import type { PresentationListRow } from '@/types/presentations';
import { PresentationComparison, presentationProblemLabel } from './PresentationHistoryViews';

export const progressLabels = { not_submitted: 'ยังไม่ส่ง', submitted: 'ส่งแล้ว', revision_pending: 'รอแก้ไข', revised: 'แก้ไขแล้ว', revision_expired: 'หมดเวลาแก้ไข' };
export const progressColors = { not_submitted: 'bg-zinc-100 text-zinc-600', submitted: 'bg-emerald-100 text-emerald-800', revision_pending: 'bg-amber-100 text-amber-800', revised: 'bg-blue-100 text-blue-800', revision_expired: 'bg-red-100 text-red-800' };
export const matchLabels = { ready: 'พร้อมใช้งาน', alias_pending: 'รอรับรองรหัสเดิม', conflict: 'ข้อมูลขัดกัน', missing: 'ไม่พบในฐานข้อมูล', incomplete: 'ข้อมูลไม่ครบ', withdrawn: 'ถอนจากประกาศ' };
export const mailLabels = { pending: 'รอส่ง', sending: 'กำลังส่ง', sent: 'ผู้ให้บริการรับอีเมลแล้ว', failed: 'ส่งล้มเหลว', unknown: 'ไม่ทราบผลส่ง', suppressed: 'พักการส่ง' };
export const thaiTime = (value: string) => new Date(value).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'medium' });

export function PresentationTable({ rows, manage, showAdminDetails = manage, selected, onSelect, onVerify, eventId, view, closesAt }: {
  rows: PresentationListRow[]; manage: boolean; showAdminDetails?: boolean; selected: Set<number>; onSelect: (id: number) => void; onVerify: (row: PresentationListRow) => void;
  eventId: number; view: 'verify' | 'notifications' | 'received'; closesAt: string;
}) {
  return <div className="overflow-x-auto"><table className="w-full min-w-[1000px] table-sticky-actions text-sm">
    <caption className="sr-only">รายชื่อไฟล์นำเสนอ</caption>
    <thead><tr className="border-b border-zinc-200 bg-zinc-50">
      {manage && view === 'notifications' && <th scope="col" className="px-4 py-3 text-center text-xs font-semibold text-zinc-500">เลือก</th>}
      <th scope="col" className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-zinc-500">Tracking ID</th>
      <th scope="col" className="min-w-[300px] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">ผลงาน / ผู้ส่ง</th>
      <th scope="col" className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-zinc-500">ประเภท / หมวด</th>
      {showAdminDetails && <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">ผลตรวจรายชื่อ</th>}
      <th scope="col" className="px-4 py-3 text-center text-xs font-semibold text-zinc-500">{showAdminDetails ? 'Presentation / Email' : 'สถานะไฟล์นำเสนอ'}</th>
      <th scope="col" className="px-4 py-3 text-center text-xs font-semibold text-zinc-500">ไฟล์ / วันที่รับ</th>
      <th scope="col" className="w-[100px] px-4 py-3 text-center text-xs font-semibold text-zinc-500">จัดการ</th>
    </tr></thead>
    <tbody className="divide-y divide-zinc-100">{rows.map(row => <tr key={row.sourceKey} className="align-top transition-colors hover:bg-zinc-50">
      {manage && view === 'notifications' && <td className="px-4 py-4 text-center">{row.abstractId !== null && <input type="checkbox" className="h-4 w-4 accent-emerald-600" aria-label={`เลือก ${row.announcement.trackingId ?? row.sourceKey}`} disabled={!row.canNotify} checked={selected.has(row.abstractId)} onChange={() => onSelect(row.abstractId!)} />}</td>}
      <td className="px-4 py-4 text-center"><span className="inline-block whitespace-nowrap rounded bg-zinc-100 px-2 py-1 font-mono text-xs text-zinc-500">{row.announcement.trackingId ?? 'ข้อมูลรหัสไม่ครบ'}</span><p className="mt-2 text-xs text-zinc-400">Round {row.announcement.round}</p></td>
      <td className="max-w-md px-4 py-4"><h3 className="mb-1 line-clamp-2 font-medium text-zinc-900" title={row.announcement.title}>{row.announcement.title}</h3><p className="text-sm text-zinc-500">{row.announcement.submitterName ?? 'ข้อมูลชื่อไม่ครบ'}</p><p className="mt-1 break-all text-xs text-zinc-400">{row.submitterEmail ?? 'ไม่พบอีเมลผู้ส่ง'}</p></td>
      <td className="px-4 py-4 text-center"><span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${row.announcement.presentationType === 'highlighted-poster' ? 'bg-orange-100 text-orange-800' : 'bg-cyan-100 text-cyan-800'}`}>{({ oral: 'Oral', poster: 'Poster', 'highlighted-poster': 'Highlighted Poster' })[row.announcement.presentationType]}</span><p className="mt-2 max-w-[180px] text-xs leading-relaxed text-zinc-500">{row.announcement.categoryName}</p></td>
      {showAdminDetails && <td className="max-w-sm px-4 py-4"><span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${row.matchState === 'ready' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{row.matchState ? matchLabels[row.matchState] : '—'}</span><ul className="mt-2 space-y-1 text-xs text-zinc-500">{row.problems.map(problem => <li key={problem}>{presentationProblemLabel(problem)}</li>)}</ul>
        {row.matchState === 'conflict' && <p className="mt-2 text-xs text-red-700">แก้ข้อมูลต้นทางหรือฐานข้อมูลด้วยเครื่องมือเดิม แล้วตรวจรายชื่อซ้ำ ไม่สามารถรับรองข้ามข้อมูลขัดกันได้</p>}
        {view === 'verify' && <details className="mt-3"><summary className="cursor-pointer text-xs font-medium text-emerald-600">ข้อมูลประกาศ / ฐานข้อมูล</summary><div className="mt-3"><PresentationComparison value={row.snapshot} /></div></details>}
        {manage && row.matchState === 'alias_pending' && <button className="btn-secondary mt-3" onClick={() => onVerify(row)}>ตรวจและรับรองรหัสเดิม</button>}
      </td>}
      <td className="px-4 py-4 text-center"><span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${progressColors[row.progress]}`}>{progressLabels[row.progress]}</span>{showAdminDetails && <><p className="mt-2 text-xs text-zinc-500">{row.lastEmail ? `${row.lastEmail.kind} · ${mailLabels[row.lastEmail.state]}` : 'ยังไม่แจ้ง'}</p>{row.lastEmail && <p className="mt-1 text-xs text-zinc-400">{thaiTime(row.lastEmail.createdAt)}</p>}</>}
        <p className="mt-3 text-xs leading-relaxed text-zinc-400">วันสุดท้าย {thaiTime(new Date(Date.parse(row.activeRequest?.closesAt ?? closesAt) - 1000).toISOString())} (ไทย)</p>
        {row.activeRequest && <p className="mt-1 text-xs text-amber-700">คำขอแก้ไข: {row.activeRequest.status}</p>}
      </td>
      <td className="px-4 py-4 text-center">{row.currentUpload ? <><a className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-emerald-50 hover:text-emerald-700" href={row.currentUpload.fileUrl} target="_blank" rel="noopener noreferrer"><IconFileText size={14} />ฉบับ {row.currentUpload.version}<IconExternalLink size={12} /></a><p className="mt-2 text-xs leading-relaxed text-zinc-400">{thaiTime(row.currentUpload.receivedAt)}</p></> : <span className="text-zinc-300">—</span>}</td>
      <td className="px-4 py-4 text-center">{row.abstractId !== null && <Link className="inline-flex rounded-lg p-2 text-zinc-400 transition-colors hover:bg-emerald-50 hover:text-emerald-600 focus-visible:outline-2 focus-visible:outline-emerald-600" href={`/presentations/${row.abstractId}?eventId=${eventId}`} title="ดูรายละเอียดและประวัติ" aria-label={`ดูรายละเอียด ${row.announcement.trackingId ?? row.sourceKey}`}><IconEye size={18} /></Link>}</td>
    </tr>)}</tbody>
  </table>{rows.length === 0 && <div className="py-16 text-center text-zinc-400"><IconFileText size={40} stroke={1.5} className="mx-auto mb-3 opacity-30" /><p>ไม่พบรายการตามตัวกรอง</p></div>}</div>;
}
