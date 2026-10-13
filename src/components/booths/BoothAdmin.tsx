'use client';
import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AdminLayout } from '@/components/layout';
import Pagination from '@/components/common/Pagination';
import {
  IconArrowLeft,
  IconBuildingStore,
  IconDownload,
  IconLoader2,
  IconPencil,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconUsers,
} from '@tabler/icons-react';
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
const inputClass = 'input-field';
const buttonClass = 'btn-primary gap-2';
const types: BoothType[] = ['symposium', 'premium', 'standard'];
const typeLabels: Record<BoothType, string> = {
  symposium: 'Symposium',
  premium: 'Premium',
  standard: 'Standard',
};
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
  const pager = pagination && (
    <Pagination
      currentPage={page}
      totalPages={pagination.totalPages}
      totalCount={pagination.total}
      pageSize={20}
      onPageChange={setPage}
      itemName={detail ? 'สมาชิก' : 'Booth'}
      className="flex-wrap gap-3 border-t border-zinc-100"
    />
  );
  return (
    <AdminLayout title={detail ? 'สมาชิก Booth' : 'ทะเบียน Booth'}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
              {detail
                ? (report?.booth.name ?? 'สมาชิก Booth')
                : 'ทะเบียน Booth'}
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              สมาชิก สิทธิ์คูปองอาหาร และเช็กอินรายวัน
            </p>
          </div>
          {detail ? (
            <Link
              href={`/booths?eventId=${eventId}`}
              className="btn-secondary gap-2"
            >
              <IconArrowLeft size={18} aria-hidden="true" />
              กลับทะเบียน Booth
            </Link>
          ) : (
            admin && (
              <button
                type="button"
                disabled={!eventId}
                className={buttonClass}
                onClick={() => edit(null)}
              >
                <IconPlus size={18} aria-hidden="true" />
                เพิ่ม Booth
              </button>
            )
          )}
        </div>
        {!admin ? (
          <p role="alert">หน้านี้สำหรับ Admin เท่านั้น</p>
        ) : (
          <>
            {!detail && (
              <div className="card">
                <label className="block max-w-xl space-y-2">
                  <span className="text-sm font-medium text-zinc-700">
                    Event
                  </span>
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
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-red-50 p-4 text-sm text-red-700"
              >
                {error}{' '}
                <button
                  className="inline-flex items-center gap-2 font-medium underline underline-offset-4"
                  onClick={() => setRevision((x) => x + 1)}
                >
                  <IconRefresh size={16} aria-hidden="true" />
                  ลองใหม่
                </button>
              </div>
            )}
            {editor !== undefined && (
              <form onSubmit={save} className="card space-y-5">
                <h2 className="text-lg font-semibold text-zinc-800">
                  {editor ? 'แก้ไข Booth' : 'เพิ่ม Booth'}
                </h2>
                <div className="grid gap-5 md:grid-cols-2">
                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-zinc-700">
                      ชื่อ Booth <span className="text-red-500">*</span>
                    </span>
                    <input
                      required
                      maxLength={255}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className={inputClass}
                    />
                  </label>
                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-zinc-700">
                      ประเภท
                    </span>
                    <select
                      value={editorType}
                      onChange={(e) =>
                        setEditorType(e.target.value as BoothType)
                      }
                      disabled={!!editor?.typeLockedAt}
                      className={inputClass}
                    >
                      {types.map((t) => (
                        <option key={t} value={t}>
                          {typeLabels[t]}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                {editor?.typeLockedAt && (
                  <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    เปลี่ยนประเภทไม่ได้ เนื่องจากมีผู้รับตั๋วแล้ว
                  </p>
                )}
                <div className="flex justify-end gap-3 border-t border-zinc-100 pt-4">
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={saving}
                    onClick={() => setEditor(undefined)}
                  >
                    ยกเลิก
                  </button>
                  <button disabled={saving} className={buttonClass}>
                    {saving && (
                      <IconLoader2
                        size={18}
                        className="animate-spin"
                        aria-hidden="true"
                      />
                    )}
                    {saving ? 'กำลังบันทึก' : 'บันทึก'}
                  </button>
                </div>
              </form>
            )}
            {!!eventId && (
              <div className="card flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative min-w-0 flex-1">
                  <IconSearch
                    size={18}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
                    aria-hidden="true"
                  />
                  <input
                    aria-label="ค้นหา Booth หรือสมาชิก"
                    placeholder={
                      detail ? 'ค้นหาชื่อ / อีเมล' : 'ค้นหาชื่อ Booth'
                    }
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                    className="input-field-search !min-w-0"
                  />
                </div>
                {!detail && (
                  <select
                    aria-label="ประเภท Booth"
                    value={type}
                    onChange={(e) => {
                      setType(e.target.value);
                      setPage(1);
                    }}
                    className={`${inputClass} sm:max-w-[200px]`}
                  >
                    <option value="">ทุกประเภท</option>
                    {types.map((t) => (
                      <option key={t} value={t}>
                        {typeLabels[t]}
                      </option>
                    ))}
                  </select>
                )}
                {detail && (
                  <button
                    disabled={exporting || !report}
                    onClick={download}
                    className="btn-secondary gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {exporting ? (
                      <IconLoader2
                        size={18}
                        className="animate-spin shrink-0"
                        aria-hidden="true"
                      />
                    ) : (
                      <IconDownload
                        size={18}
                        className="shrink-0"
                        aria-hidden="true"
                      />
                    )}
                    {exporting
                      ? 'กำลังดาวน์โหลด'
                      : 'ดาวน์โหลด Excel (สมาชิกทั้งหมด)'}
                  </button>
                )}
              </div>
            )}
            {loading && (
              <div
                className="card flex items-center justify-center gap-2 py-12 text-sm text-zinc-500"
                role="status"
              >
                <IconLoader2
                  size={20}
                  className="animate-spin"
                  aria-hidden="true"
                />
                กำลังโหลดข้อมูล
              </div>
            )}
            {!eventId && !detail && (
              <div className="card py-12 text-center">
                <IconBuildingStore
                  size={32}
                  className="mx-auto mb-3 text-zinc-400"
                  aria-hidden="true"
                />
                <p className="font-medium text-zinc-700">
                  เลือก Event เพื่อดูทะเบียน Booth
                </p>
              </div>
            )}
            {list && (
              <div className="card !p-0 overflow-hidden">
                <div className="flex items-center justify-between gap-3 px-6 py-5">
                  <h2 className="text-lg font-semibold text-zinc-800">
                    รายชื่อ Booth
                  </h2>
                  <span className="text-sm text-zinc-500">
                    {pagination?.total ?? 0} Booth
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="data-table min-w-[760px] tabular-nums">
                    <caption className="sr-only">
                      รายชื่อ Booth และโควตาคูปองอาหาร
                    </caption>
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
                          <th key={h} scope="col">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {list.booths.map((b) => (
                        <tr key={b.id}>
                          <td className="p-3">
                            <Link
                              className="font-semibold text-zinc-900 hover:text-emerald-700 hover:underline underline-offset-4"
                              href={`/booths/${b.id}?eventId=${eventId}`}
                            >
                              {b.name}
                            </Link>
                          </td>
                          <td className="p-3">
                            <span className="badge badge-info">
                              {typeLabels[b.type]}
                            </span>
                          </td>
                          <td className="p-3">{b.memberCount}</td>
                          <td className="p-3">{b.ticketCount}</td>
                          <td className="p-3">{b.qualifiedCount}</td>
                          <td className="p-3">
                            <span className="badge badge-success">
                              {b.eligibleCount} / {b.quota}
                            </span>
                          </td>
                          <td className="p-3">
                            <button
                              className="btn-secondary gap-1.5 !px-3 !py-1.5"
                              aria-label={`แก้ไข ${b.name}`}
                              onClick={() => edit(b)}
                            >
                              <IconPencil size={15} aria-hidden="true" />
                              แก้ไข
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!list.booths.length && (
                  <div className="py-12 text-center">
                    <IconBuildingStore
                      size={32}
                      className="mx-auto mb-3 text-zinc-400"
                      aria-hidden="true"
                    />
                    <p className="text-sm text-zinc-500">
                      ยังไม่มี Booth ตามเงื่อนไขนี้
                    </p>
                  </div>
                )}
                {pager}
              </div>
            )}
            {report && (
              <>
                <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-600">
                  <span>{report.event.eventName}</span>
                  <span className="badge badge-info">
                    {typeLabels[report.booth.type]}
                  </span>
                  <span className="badge badge-success">
                    มีสิทธิ์ {report.booth.eligibleCount}/{report.booth.quota}{' '}
                    คน
                  </span>
                </div>
                {!report.columns.length && (
                  <p className="text-sm text-zinc-500">
                    งานนี้ยังไม่ได้ตั้งค่าเช็กอินรายวัน
                  </p>
                )}
                <div className="card !p-0 overflow-hidden">
                  <div className="flex items-center justify-between gap-3 px-6 py-5">
                    <h2 className="text-lg font-semibold text-zinc-800">
                      รายชื่อสมาชิก
                    </h2>
                    <span className="text-sm text-zinc-500">
                      {pagination?.total ?? 0} คน
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="data-table whitespace-nowrap tabular-nums">
                      <caption className="sr-only">
                        สมาชิก Booth สิทธิ์คูปองอาหาร และเช็กอินรายวัน
                      </caption>
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
                            <th key={i} scope="col">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {report.members.map((m) => (
                          <tr key={m.id}>
                            <td className="p-3">
                              <span className="font-medium text-zinc-900">
                                {m.firstName} {m.lastName}
                              </span>
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
                              <span
                                className={
                                  m.mealCouponEligible === true
                                    ? 'badge badge-success'
                                    : m.mealCouponEligible === null
                                      ? 'badge badge-warning'
                                      : 'badge bg-zinc-100 text-zinc-600'
                                }
                              >
                                {boothEligibilityLabel(m.mealCouponEligible)}
                              </span>
                            </td>
                            {report.columns.map((c) => (
                              <td className="p-3" key={c.key}>
                                <span
                                  className={
                                    m.attendanceByDate[c.key] === 'checked_in'
                                      ? 'badge badge-success'
                                      : 'text-zinc-500'
                                  }
                                >
                                  {
                                    dailyAttendanceLabel[
                                      m.attendanceByDate[c.key]
                                    ]
                                  }
                                </span>
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {!report.members.length && (
                    <div className="py-12 text-center">
                      <IconUsers
                        size={32}
                        className="mx-auto mb-3 text-zinc-400"
                        aria-hidden="true"
                      />
                      <p className="text-sm text-zinc-500">
                        ยังไม่มีสมาชิกตามเงื่อนไขนี้
                      </p>
                    </div>
                  )}
                  {pager}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
}
