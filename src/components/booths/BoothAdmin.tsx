'use client';
import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AdminLayout } from '@/components/layout';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { boothApi } from '@/lib/boothApi';
import { exportToExcel } from '@/lib/exportExcel';
import {
  buildBoothExcelRows,
  boothExcelHeaders,
  boothEligibilityLabel,
  boothTicketDate,
  dailyAttendanceLabel,
} from '@/lib/boothExcel';
import type {
  BoothSummary,
  BoothType,
  BoothMemberReport,
} from '@/types/booths';
const inputClass =
  'rounded-lg border border-zinc-300 bg-white p-2 text-zinc-900';
const buttonClass =
  'rounded-lg bg-zinc-900 px-4 py-2 text-white disabled:opacity-40';
const types: BoothType[] = ['symposium', 'premium', 'standard'];
export default function BoothAdmin({ detail = false }: { detail?: boolean }) {
  const { user, token } = useAuth();
  const params = useParams();
  const query = useSearchParams();
  const boothId = detail ? Number(params.id) : 0;
  const initialEvent = Number(query.get('eventId'));
  const [eventId, setEventId] = useState(
    Number.isSafeInteger(initialEvent) && initialEvent > 0 ? initialEvent : 0,
  );
  const [events, setEvents] = useState<
    Array<{ id: number; eventName: string }>
  >([]);
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [list, setList] = useState<Awaited<
    ReturnType<typeof boothApi.list>
  > | null>(null);
  const [report, setReport] = useState<BoothMemberReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [editor, setEditor] = useState<BoothSummary | null | undefined>(
    undefined,
  );
  const [name, setName] = useState('');
  const [editorType, setEditorType] = useState<BoothType>('standard');
  const [saving, setSaving] = useState(false);
  const admin = user?.role === 'admin';
  useEffect(() => {
    if (!admin || !token || detail) return;
    let active = true;
    api.backofficeEvents
      .list(token, 'limit=100')
      .then((r) => {
        if (active)
          setEvents(r.events as Array<{ id: number; eventName: string }>);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [admin, token, detail]);
  useEffect(() => {
    setList(null);
    setReport(null);
    setError('');
    if (
      !admin ||
      !token ||
      !eventId ||
      (detail && (!Number.isSafeInteger(boothId) || boothId <= 0))
    )
      return;
    const c = new AbortController();
    setLoading(true);
    const q = new URLSearchParams({ page: String(page), limit: '20' });
    if (search) q.set('search', search);
    if (type && !detail) q.set('type', type);
    const work = detail
      ? boothApi.members(eventId, boothId, q, token, c.signal).then((r) => {
          if (!c.signal.aborted) setReport(r);
        })
      : boothApi.list(eventId, q, token, c.signal).then((r) => {
          if (!c.signal.aborted) setList(r);
        });
    work
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!c.signal.aborted) setLoading(false);
      });
    return () => c.abort();
  }, [admin, token, eventId, boothId, detail, search, type, page, revision]);
  function edit(booth: BoothSummary | null) {
    setEditor(booth);
    setName(booth?.name ?? '');
    setEditorType(booth?.type ?? 'standard');
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setError('');
    try {
      const value = { name: name.trim(), type: editorType };
      if (!value.name) throw new Error('กรุณาระบุชื่อ Booth');
      if (editor) await boothApi.update(eventId, editor.id, value, token);
      else await boothApi.create(eventId, value, token);
      setEditor(undefined);
      setRevision((x) => x + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  }
  async function download() {
    if (!token) return;
    setExporting(true);
    try {
      const r = await boothApi.exportMembers(eventId, boothId, token);
      const file =
        `${r.event.eventCode}_Booth-${r.booth.id}_${r.booth.name}`.replace(
          /[<>:"/\\|?*\x00-\x1f]/g,
          '_',
        );
      exportToExcel(buildBoothExcelRows(r), file, boothExcelHeaders(r));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ดาวน์โหลดไม่สำเร็จ');
    } finally {
      setExporting(false);
    }
  }
  const pagination = detail ? report?.pagination : list?.pagination;
  return (
    <AdminLayout title={detail ? 'สมาชิก Booth' : 'ทะเบียน Booth'}>
      <div className="space-y-5 p-4 text-zinc-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">
              {detail
                ? (report?.booth.name ?? 'สมาชิก Booth')
                : 'ทะเบียน Booth'}
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              สมาชิก สิทธิ์คูปองอาหาร และเช็กอินรายวัน
            </p>
          </div>
          {detail && (
            <Link href={`/booths?eventId=${eventId}`} className="underline">
              กลับทะเบียน Booth
            </Link>
          )}
        </div>
        {!admin ? (
          <p role="alert">หน้านี้สำหรับ Admin เท่านั้น</p>
        ) : (
          <>
            {!detail && (
              <div className="flex flex-wrap gap-3">
                <label>
                  Event{' '}
                  <select
                    value={eventId || ''}
                    onChange={(e) => {
                      setEventId(Number(e.target.value));
                      setPage(1);
                      setEditor(undefined);
                    }}
                    className={inputClass}
                  >
                    <option value="">เลือก Event</option>
                    {events.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.eventName}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  disabled={!eventId}
                  className={buttonClass}
                  onClick={() => edit(null)}
                >
                  เพิ่ม Booth
                </button>
              </div>
            )}
            {detail && !eventId && (
              <p role="alert">
                กรุณาเลือก Event จากทะเบียน Booth ก่อนเปิดรายชื่อ
              </p>
            )}
            {error && (
              <div
                role="alert"
                className="rounded-lg border border-red-300 bg-red-50 p-3"
              >
                {error}{' '}
                <button
                  className="underline"
                  onClick={() => setRevision((x) => x + 1)}
                >
                  ลองใหม่
                </button>
              </div>
            )}
            {editor !== undefined && (
              <form
                onSubmit={save}
                className="space-y-3 rounded-xl border bg-white p-4"
              >
                <h2 className="font-bold">
                  {editor ? 'แก้ไข Booth' : 'เพิ่ม Booth'}
                </h2>
                <label className="block">
                  ชื่อ Booth{' '}
                  <input
                    required
                    maxLength={255}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={inputClass}
                  />
                </label>
                <label className="block">
                  ประเภท{' '}
                  <select
                    value={editorType}
                    onChange={(e) => setEditorType(e.target.value as BoothType)}
                    disabled={!!editor?.typeLockedAt}
                    className={inputClass}
                  >
                    {types.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
                {editor?.typeLockedAt && (
                  <p className="text-sm">
                    เปลี่ยนประเภทไม่ได้ เนื่องจากมีผู้รับตั๋วแล้ว
                  </p>
                )}
                <div className="flex gap-3">
                  <button disabled={saving} className={buttonClass}>
                    {saving ? 'กำลังบันทึก' : 'บันทึก'}
                  </button>
                  <button type="button" onClick={() => setEditor(undefined)}>
                    ยกเลิก
                  </button>
                </div>
              </form>
            )}
            {!!eventId && (
              <div className="flex flex-wrap gap-3">
                <input
                  aria-label="ค้นหา Booth หรือสมาชิก"
                  placeholder={detail ? 'ค้นหาชื่อ / อีเมล' : 'ค้นหาชื่อ Booth'}
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className={inputClass}
                />
                {!detail && (
                  <select
                    aria-label="ประเภท Booth"
                    value={type}
                    onChange={(e) => {
                      setType(e.target.value);
                      setPage(1);
                    }}
                    className={inputClass}
                  >
                    <option value="">ทุกประเภท</option>
                    {types.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                )}
                {detail && (
                  <button
                    disabled={exporting || !report}
                    onClick={download}
                    className={buttonClass}
                  >
                    {exporting
                      ? 'กำลังดาวน์โหลด'
                      : 'ดาวน์โหลดสมาชิกทั้งหมดของ Booth (Excel)'}
                  </button>
                )}
              </div>
            )}
            {loading && <p role="status">กำลังโหลดข้อมูล</p>}
            {list && (
              <div className="overflow-x-auto rounded-xl border bg-white">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr>
                      {[
                        'Booth',
                        'ประเภท',
                        'สมาชิก',
                        'รับตั๋ว',
                        'เข้าเงื่อนไข',
                        'สิทธิ์ / โควตา',
                        'จัดการ',
                      ].map((h) => (
                        <th key={h} className="p-3">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {list.booths.map((b) => (
                      <tr key={b.id} className="border-t">
                        <td className="p-3">
                          <Link
                            className="font-semibold underline"
                            href={`/booths/${b.id}?eventId=${eventId}`}
                          >
                            {b.name} #{b.id}
                          </Link>
                        </td>
                        <td className="p-3">{b.type}</td>
                        <td className="p-3">{b.memberCount}</td>
                        <td className="p-3">{b.ticketCount}</td>
                        <td className="p-3">{b.qualifiedCount}</td>
                        <td className="p-3">
                          {b.eligibleCount} / {b.quota}
                        </td>
                        <td className="p-3">
                          <button className="underline" onClick={() => edit(b)}>
                            แก้ไข
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!list.booths.length && (
                  <p className="p-4">ยังไม่มี Booth ตามเงื่อนไขนี้</p>
                )}
              </div>
            )}
            {report && (
              <>
                <p className="text-sm">
                  {report.event.eventName} · {report.booth.type} · มีสิทธิ์{' '}
                  {report.booth.eligibleCount}/{report.booth.quota} คน
                </p>
                {!report.columns.length && (
                  <p className="text-sm text-zinc-500">
                    งานนี้ยังไม่ได้ตั้งค่าเช็กอินรายวัน
                  </p>
                )}
                <div className="overflow-x-auto rounded-xl border bg-white">
                  <table className="w-full whitespace-nowrap text-left text-sm">
                    <thead>
                      <tr>
                        {[
                          'ชื่อ-นามสกุล',
                          'อีเมล',
                          'เบอร์โทร',
                          'วันที่รับตั๋ว',
                          'ลำดับ',
                          'สิทธิ์คูปอง',
                          ...report.columns.map(
                            (c) => `${c.date} · ${c.sessionName}`,
                          ),
                        ].map((h, i) => (
                          <th key={i} className="p-3">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {report.members.map((m) => (
                        <tr className="border-t" key={m.id}>
                          <td className="p-3">
                            {m.firstName} {m.lastName}
                          </td>
                          <td className="p-3">{m.email}</td>
                          <td className="p-3">{m.phone ?? '—'}</td>
                          <td className="p-3">
                            {boothTicketDate(m.firstTicketConfirmedAt) ||
                              'ยังไม่มีตั๋ว'}
                          </td>
                          <td className="p-3">
                            {m.qualificationSequence ?? '—'}
                          </td>
                          <td className="p-3">
                            {boothEligibilityLabel(m.mealCouponEligible)}
                          </td>
                          {report.columns.map((c) => (
                            <td className="p-3" key={c.key}>
                              {dailyAttendanceLabel[m.attendanceByDate[c.key]]}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!report.members.length && (
                    <p className="p-4">ยังไม่มีสมาชิกตามเงื่อนไขนี้</p>
                  )}
                </div>
              </>
            )}
            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center gap-3">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((x) => x - 1)}
                  className={buttonClass}
                >
                  ก่อนหน้า
                </button>
                <span>
                  หน้า {page}/{pagination.totalPages} · {pagination.total}{' '}
                  รายการ
                </span>
                <button
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage((x) => x + 1)}
                  className={buttonClass}
                >
                  ถัดไป
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
}
