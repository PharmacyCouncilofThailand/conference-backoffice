'use client';

import { useCallback, useEffect, useState } from 'react';
import { AdminLayout } from '@/components/layout';
import { api } from '@/lib/api';
import type { HolderTypeOption } from '@/lib/holder-types';
import { holderTypeTone } from '@/lib/holder-type-colors';
import {
  PRIS_EVENT_CODE,
  formatBangkokTime,
  formatThaiDayMonth,
  formatThaiShortDate,
  listEventDays,
  toPrisExportRow,
} from '@/lib/checkin-history';
import { exportToExcel } from '@/lib/exportExcel';
import { mealCouponStatusOf } from '@/lib/meal-coupon';
import { MealCouponBadge } from '@/components/checkin/MealCouponBadge';
import { useDebounce } from '@/hooks/useDebounce';
import { Pagination } from '@/components/common';
import toast from 'react-hot-toast';
import {
  IconArrowBackUp,
  IconChartBar,
  IconDownload,
  IconLoader2,
  IconSearch,
  IconUserCheck,
  IconUsers,
} from '@tabler/icons-react';

interface CheckinRow {
  booth?: { mealCouponEligible: boolean | null } | null;
  mealCouponEligible?: boolean | null;
  mealCouponStatus?: 'eligible' | 'over_quota' | null;
  kind?: 'daily' | 'single';
  id: number | string;
  attendanceId?: string | null;
  registrationSessionId: number;
  attendanceDate?: string | null;
  scannedAt: string;
  cancelledAt?: string | null;
  cancelledBy?: number | null;
  cancellationReason?: string | null;
  regCode: string;
  firstName: string;
  lastName: string;
  email: string;
  university: string | null;
  institution: string | null;
  ticketName?: string | null;
  holderType?: string | null;
  holderTypeLabel?: string | null;
  holderGift?: string | null;
  holderGiftCode?: 'gift' | 'none' | null;
  sessionName: string | null;
  eventName: string | null;
  scannedBy: {
    id?: number | null;
    firstName: string | null;
    lastName: string | null;
  } | null;
}

interface SessionOption {
  id: number;
  name: string;
}

interface Stats {
  total: number;
  checkedIn: number;
  remaining: number;
  percentage: number;
  serverDate?: string;
  selectedDate?: string;
  eligibleRegistrations?: number;
  checkedInPeopleOnDate?: number;
  uniquePeople?: number;
  attendanceOccurrences?: number;
  unlinkedRegistrationCount?: number;
}

const getBackofficeToken = () =>
  localStorage.getItem('backoffice_token') ||
  sessionStorage.getItem('backoffice_token') ||
  '';

const formatDateTime = (iso: string | null | undefined) => {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('th-TH', {
    timeZone: 'Asia/Bangkok',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

const STAT_TONES = [
  'bg-blue-50 text-blue-600',
  'bg-emerald-50 text-emerald-600',
  'bg-emerald-50 text-emerald-600',
  'bg-blue-50 text-blue-600',
  'bg-amber-50 text-amber-600',
];

function bangkokDay(value: string | Date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value));
}

function todayBangkok() {
  return bangkokDay();
}

export default function CheckinsListPage() {
  const [rows, setRows] = useState<CheckinRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [eventFilter, setEventFilter] = useState('');
  const [sessionFilter, setSessionFilter] = useState('');
  const [universityFilter, setUniversityFilter] = useState('');
  const [dateFilter, setDateFilter] = useState(todayBangkok());
  const [historyFilter, setHistoryFilter] = useState<
    'active' | 'cancelled' | 'all'
  >('active');
  const [eventOptions, setEventOptions] = useState<
    { id: number; name: string; code: string | null }[]
  >([]);
  const [holderTypeFilter, setHolderTypeFilter] = useState('');
  const [holderTypeOptions, setHolderTypeOptions] = useState<
    HolderTypeOption[]
  >([]);
  const [eventDays, setEventDays] = useState<string[]>([]);
  const [sessionOptions, setSessionOptions] = useState<SessionOption[]>([]);
  const [mainSessionId, setMainSessionId] = useState<number | null>(null);
  const [universityOptions, setUniversityOptions] = useState<string[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [undoingId, setUndoingId] = useState<string | number | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const debouncedSearch = useDebounce(searchTerm, 300);

  useEffect(() => {
    const token = getBackofficeToken();
    api.backofficeEvents
      .list(token, 'limit=100')
      .then((res) => {
        setEventOptions(
          (res.events as Record<string, unknown>[]).map((event) => ({
            id: event.id as number,
            name: event.eventName as string,
            code: (event.eventCode as string | null | undefined) ?? null,
          })),
        );
      })
      .catch(() => undefined);
  }, []);

  const isPris =
    eventOptions.find((event) => String(event.id) === eventFilter)?.code ===
    PRIS_EVENT_CODE;

  useEffect(() => {
    setHolderTypeFilter('');
    setHolderTypeOptions([]);
    setEventDays([]);
    if (!eventFilter || !isPris) return;
    const token = getBackofficeToken();
    let cancelled = false;
    api.checkins
      .deskSummary(token, Number(eventFilter))
      .then((summary) => {
        if (cancelled) return;
        const today = summary.serverDate;
        const days = summary.eventDays
          ? listEventDays(summary.eventDays.first, summary.eventDays.last)
          : [today];
        setEventDays(days);
        setDateFilter(today);
      })
      .catch((error) => {
        if (cancelled) return;
        toast.error(
          error instanceof Error ? error.message : 'โหลดข้อมูลวันงานไม่สำเร็จ',
        );
      });
    api.registrations
      .holderTypes(token)
      .then((res) => {
        if (!cancelled) setHolderTypeOptions(res.holderTypes ?? []);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [eventFilter, isPris]);

  useEffect(() => {
    if (!eventFilter) {
      setSessionOptions([]);
      setSessionFilter('');
      setUniversityOptions([]);
      setUniversityFilter('');
      return;
    }
    const token = getBackofficeToken();
    let cancelled = false;
    // Sessions plus the event main session, which is selected by default.
    Promise.all([
      api.backofficeEvents.getSessions(token, Number(eventFilter)),
      api.checkins.deskSummary(token, Number(eventFilter)).catch(() => null),
    ])
      .then(([res, desk]) => {
        if (cancelled) return;
        const options = (res.sessions as Record<string, unknown>[]).map(
          (session) => ({
            id: session.id as number,
            name: session.sessionName as string,
          }),
        );
        const mainId = desk?.mainSession.id ?? null;
        setSessionOptions(options);
        setMainSessionId(mainId);
        const initial =
          options.find((option) => option.id === mainId) ?? options[0];
        setSessionFilter(initial ? String(initial.id) : '');
      })
      .catch(() => {
        if (cancelled) return;
        setSessionOptions([]);
        setMainSessionId(null);
      });
    api.checkins
      .universities(token, Number(eventFilter))
      .then((res) => {
        setUniversityOptions(res.universities ?? []);
      })
      .catch(() => setUniversityOptions([]));
    setSessionFilter('');
    setUniversityFilter('');
    return () => {
      cancelled = true;
    };
  }, [eventFilter]);

  useEffect(
    () => setPage(1),
    [
      debouncedSearch,
      eventFilter,
      sessionFilter,
      universityFilter,
      holderTypeFilter,
      dateFilter,
      historyFilter,
    ],
  );

  const buildQuery = useCallback(
    (queryPage: number, queryLimit: number) => {
      const params: Record<string, string> = {
        page: String(queryPage),
        limit: String(queryLimit),
        eventId: eventFilter,
      };
      if (sessionFilter) {
        params.sessionId = sessionFilter;
        if (dateFilter || !isPris) params.date = dateFilter;
        params.history = historyFilter;
      }
      if (debouncedSearch) params.search = debouncedSearch;
      if (universityFilter) params.university = universityFilter;
      if (isPris && holderTypeFilter) params.holderType = holderTypeFilter;
      return new URLSearchParams(params).toString();
    },
    [
      eventFilter,
      sessionFilter,
      dateFilter,
      historyFilter,
      debouncedSearch,
      universityFilter,
      holderTypeFilter,
      isPris,
    ],
  );

  const fetchData = useCallback(async () => {
    if (!eventFilter) {
      setRows([]);
      setStats(null);
      return;
    }
    // Always one session at a time: wait until a session is selected
    if (!sessionFilter) {
      setRows([]);
      setStats(null);
      return;
    }
    setIsLoading(true);
    try {
      const token = getBackofficeToken();
      const listPromise = api.checkins.list(token, buildQuery(page, limit));
      const statsParams = new URLSearchParams({
        eventId: eventFilter,
        ...(sessionFilter
          ? {
              sessionId: sessionFilter,
              ...(dateFilter || !isPris ? { date: dateFilter } : {}),
            }
          : {}),
      });
      const [listRes, statsRes] = await Promise.all([
        listPromise,
        api.checkins.stats(token, statsParams.toString()),
      ]);
      setRows((listRes.checkins || []) as CheckinRow[]);
      setTotalCount(listRes.pagination.total);
      setTotalPages(listRes.pagination.totalPages);
      setStats(statsRes);
    } catch (error) {
      console.error('Failed to load check-ins:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to load check-ins',
      );
    } finally {
      setIsLoading(false);
    }
  }, [eventFilter, sessionFilter, dateFilter, page, limit, buildQuery, isPris]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleExport = async () => {
    if (!eventFilter) return;
    setIsExporting(true);
    try {
      const token = getBackofficeToken();
      const allRows: CheckinRow[] = [];
      const pageSize = 500;
      let exportPage = 1;
      let pages = 1;
      do {
        const res = await api.checkins.list(
          token,
          buildQuery(exportPage, pageSize),
        );
        allRows.push(...(res.checkins as CheckinRow[]));
        pages = Math.max(1, res.pagination.totalPages);
        exportPage += 1;
      } while (exportPage <= pages);

      const eventName =
        eventOptions.find((event) => String(event.id) === eventFilter)?.name ||
        'event';
      if (isPris) {
        exportToExcel(
          allRows.map((row) => toPrisExportRow(row)),
          `checkins_${eventName}_${dateFilter || 'all-days'}_${historyFilter}`,
        );
        toast.success(`Exported ${allRows.length} rows`);
        return;
      }
      exportToExcel(
        allRows.map((row) => ({
          'Reg Code': row.regCode,
          'First Name': row.firstName,
          'Last Name': row.lastName,
          Email: row.email,
          University: row.university ?? '',
          Institution: row.institution ?? '',
          Event: row.eventName ?? '',
          Session: row.sessionName ?? '',
          'Attendance Day': row.attendanceDate ?? '',
          'Scanned At (Bangkok)': formatDateTime(row.scannedAt),
          'Scanned By': row.scannedBy
            ? `${row.scannedBy.firstName ?? ''} ${row.scannedBy.lastName ?? ''}`.trim()
            : '',
          'Cancelled At (Bangkok)': formatDateTime(row.cancelledAt),
          'Cancelled By ID': row.cancelledBy ?? '',
          'Cancellation Reason': row.cancellationReason ?? '',
          'History State': row.cancelledAt ? 'cancelled' : 'active',
        })),
        `checkins_${eventName}_${dateFilter}_${historyFilter}`,
      );
      toast.success(`Exported ${allRows.length} rows`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  const handleUndo = async (row: CheckinRow) => {
    const token = getBackofficeToken();
    setUndoingId(row.id);
    try {
      if (row.kind === 'daily' && row.attendanceId) {
        const reason = window
          .prompt('เหตุผลในการยกเลิกเช็คอิน (จำเป็น)')
          ?.trim();
        if (!reason) return;
        await api.checkins.undoDaily(token, row.attendanceId, reason);
      } else {
        if (!window.confirm('Undo this session check-in?')) return;
        await api.checkins.undo(token, row.registrationSessionId);
      }
      toast.success('ยกเลิกเช็คอินแล้ว และยังคงประวัติไว้');
      await fetchData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Undo failed');
    } finally {
      setUndoingId(null);
    }
  };

  return (
    <AdminLayout title="Check-in History">
      <div className="min-w-0 space-y-6">
        <div className="card space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <select
              value={eventFilter}
              onChange={(event) => setEventFilter(event.target.value)}
              className="input-field"
            >
              <option value="">Select event</option>
              {eventOptions.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.name}
                </option>
              ))}
            </select>
            <select
              value={sessionFilter}
              onChange={(event) => setSessionFilter(event.target.value)}
              className="input-field"
              disabled={!eventFilter || sessionOptions.length === 0}
              aria-label="Session"
            >
              {sessionOptions.length === 0 && (
                <option value="">Select session</option>
              )}
              {sessionOptions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.name}
                  {session.id === mainSessionId ? ' — Main Session' : ''}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={dateFilter}
              onChange={(event) => setDateFilter(event.target.value)}
              className="input-field"
              disabled={!sessionFilter}
              aria-label="Attendance date"
            />
            <select
              value={historyFilter}
              onChange={(event) =>
                setHistoryFilter(
                  event.target.value as 'active' | 'cancelled' | 'all',
                )
              }
              className="input-field"
              disabled={!sessionFilter}
            >
              <option value="active">Active attendance</option>
              <option value="cancelled">Cancelled history</option>
              <option value="all">All history</option>
            </select>
            <select
              value={universityFilter}
              onChange={(event) => setUniversityFilter(event.target.value)}
              className="input-field"
              disabled={!eventFilter}
            >
              <option value="">All universities</option>
              {universityOptions.map((university) => (
                <option key={university} value={university}>
                  {university}
                </option>
              ))}
            </select>
            {isPris && (
              <select
                value={holderTypeFilter}
                onChange={(event) => setHolderTypeFilter(event.target.value)}
                className="input-field"
                aria-label="Ticket Type"
              >
                <option value="">ทุก Ticket Type</option>
                {holderTypeOptions.map((type) => (
                  <option key={type.key} value={type.key}>
                    {type.label}
                  </option>
                ))}
                <option value="unassigned">ยังไม่ระบุ</option>
              </select>
            )}
            <div className="relative">
              <IconSearch
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
              />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="input-field !pl-10"
                placeholder="Name / Reg code"
              />
            </div>
          </div>

          {isPris && sessionFilter && (
            <div
              className="flex flex-wrap items-center gap-2"
              role="group"
              aria-label="วันที่เข้างาน"
            >
              {eventDays.map((day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => setDateFilter(day)}
                  aria-pressed={dateFilter === day}
                  className={`min-h-[40px] rounded-full border px-4 text-sm font-medium ${
                    dateFilter === day
                      ? 'border-emerald-600 bg-emerald-600 text-white'
                      : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
                  }`}
                >
                  {formatThaiDayMonth(day)}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setDateFilter('')}
                aria-pressed={dateFilter === ''}
                className={`min-h-[40px] rounded-full border px-4 text-sm font-medium ${
                  dateFilter === ''
                    ? 'border-emerald-600 bg-emerald-600 text-white'
                    : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
                }`}
              >
                ทุกวัน
              </button>
            </div>
          )}
        </div>

        {/* Stats are per day; hide them for the PRIS all-days view. */}
        {sessionFilter && stats && !(isPris && !dateFilter) && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
            {(
              [
                [
                  'Eligible entitlements',
                  stats.eligibleRegistrations ?? stats.total,
                  IconUsers,
                ],
                [
                  'People on selected day',
                  stats.checkedInPeopleOnDate ?? stats.checkedIn,
                  IconUserCheck,
                ],
                [
                  'Unique identified people',
                  stats.uniquePeople ?? stats.checkedIn,
                  IconUsers,
                ],
                [
                  'Attendance occurrences',
                  stats.attendanceOccurrences ?? stats.checkedIn,
                  IconChartBar,
                ],
                [
                  'Unlinked registrations',
                  stats.unlinkedRegistrationCount ?? 0,
                  IconChartBar,
                ],
              ] as Array<[string, number, typeof IconUsers]>
            ).map(([label, value, Icon], index) => (
              <div className="card py-4" key={String(label)}>
                <div className="flex items-center gap-4">
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${STAT_TONES[index]}`}
                  >
                    <Icon size={24} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-2xl font-bold text-zinc-800">
                      {String(value)}
                    </p>
                    <p className="text-sm text-zinc-400">{String(label)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="card min-w-0">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-zinc-800">
                {sessionFilter
                  ? `Attendance for ${dateFilter || (isPris ? 'all days' : dateFilter)}`
                  : 'Check-ins'}
              </h2>
              <p className="text-sm text-zinc-400">
                {sessionFilter
                  ? `${historyFilter} history · ${totalCount} matching rows`
                  : 'Select an event and a session'}
              </p>
            </div>
            <button
              onClick={handleExport}
              disabled={isExporting || !eventFilter}
              className="btn-secondary gap-2"
            >
              {isExporting ? (
                <IconLoader2 size={18} className="animate-spin" />
              ) : (
                <IconDownload size={18} />
              )}
              Export all filtered rows
            </button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-teal-700"></div>
              <span className="ml-3 text-zinc-400">Loading check-ins...</span>
            </div>
          ) : rows.length === 0 ? (
            <div className="py-12 text-center text-zinc-400">
              No check-ins match these filters. Try another date or session.
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table
                  className={`w-full text-sm ${isPris ? 'min-w-[1180px]' : 'min-w-[980px]'}`}
                >
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50">
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                        {isPris ? 'ชื่อ' : 'Person'}
                      </th>
                      {isPris ? (
                        <>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                            Ticket
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                            Ticket Type
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                            Gift
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                            คูปองอาหาร
                          </th>
                        </>
                      ) : (
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                          Session
                        </th>
                      )}
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                        {isPris ? 'วันที่เข้างาน' : 'Attendance day'}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                        {isPris ? 'เวลาสแกน' : 'Scan time'}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                        {isPris ? 'ผู้สแกน' : 'Actor'}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                        {isPris ? 'สถานะ' : 'State'}
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-zinc-500">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {rows.map((row) => (
                      <tr
                        key={`${row.kind || 'single'}-${row.id}`}
                        className="align-top transition-colors hover:bg-zinc-50"
                      >
                        <td className="px-4 py-4">
                          <p className="font-medium text-zinc-900">
                            {row.firstName} {row.lastName}
                          </p>
                          {isPris ? (
                            <p className="font-mono text-xs text-zinc-500">
                              {row.regCode}
                            </p>
                          ) : (
                            <p className="text-xs text-zinc-500">
                              {row.regCode} ·{' '}
                              {row.university || 'No university'}
                            </p>
                          )}
                        </td>
                        {isPris ? (
                          <>
                            <td className="px-4 py-4 text-zinc-700">
                              {row.ticketName || '-'}
                            </td>
                            <td className="px-4 py-4">
                              <span
                                className={`badge whitespace-nowrap border ${holderTypeTone(row.holderType).badge}`}
                              >
                                {row.holderType && row.holderTypeLabel
                                  ? row.holderTypeLabel
                                  : 'ยังไม่ระบุ'}
                              </span>
                            </td>
                            <td className="px-4 py-4">
                              {row.holderGiftCode === 'gift' ? (
                                <span className="badge badge-warning">ให้</span>
                              ) : (
                                <span className="text-zinc-400">-</span>
                              )}
                            </td>
                            <td className="px-4 py-4">
                              <MealCouponBadge
                                status={mealCouponStatusOf(row)}
                              />
                            </td>
                          </>
                        ) : (
                          <td className="px-4 py-4 text-zinc-700">
                            {row.sessionName || '-'}
                          </td>
                        )}
                        <td className="px-4 py-4 whitespace-nowrap">
                          {isPris
                            ? formatThaiShortDate(
                                row.attendanceDate ?? bangkokDay(row.scannedAt),
                              )
                            : row.attendanceDate || 'single-session'}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          {isPris
                            ? formatBangkokTime(row.scannedAt)
                            : formatDateTime(row.scannedAt)}
                        </td>
                        <td className="px-4 py-4">
                          {row.scannedBy
                            ? `${row.scannedBy.firstName ?? ''} ${row.scannedBy.lastName ?? ''}`.trim() ||
                              '-'
                            : '-'}
                        </td>
                        <td className="px-4 py-4">
                          {row.cancelledAt ? (
                            <div>
                              <span className="badge badge-error">
                                Cancelled
                              </span>
                              <p className="mt-1 max-w-xs text-xs text-zinc-500">
                                {row.cancellationReason || '-'}
                              </p>
                            </div>
                          ) : (
                            <span className="badge badge-success">Active</span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-right">
                          {!row.cancelledAt && (
                            <button
                              onClick={() => void handleUndo(row)}
                              disabled={undoingId === row.id}
                              className="btn-secondary gap-1 !px-3 !py-1.5 !text-amber-700"
                            >
                              {undoingId === row.id ? (
                                <IconLoader2
                                  size={16}
                                  className="animate-spin"
                                />
                              ) : (
                                <IconArrowBackUp size={16} />
                              )}
                              Undo
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {totalPages > 1 && (
            <div className="mt-5">
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                totalCount={totalCount}
                onPageChange={setPage}
                pageSize={limit}
                onPageSizeChange={(value) => {
                  setLimit(value);
                  setPage(1);
                }}
                itemName="attendance rows"
              />
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
