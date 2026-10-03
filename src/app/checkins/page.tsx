'use client';

import { useCallback, useEffect, useState } from 'react';
import { AdminLayout } from '@/components/layout';
import { api } from '@/lib/api';
import { exportToExcel } from '@/lib/exportExcel';
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
    sessionName: string | null;
    eventName: string | null;
    scannedBy: { id?: number | null; firstName: string | null; lastName: string | null } | null;
}

interface SessionOption { id: number; name: string }

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

function todayBangkok() {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Bangkok',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(new Date());
}

export default function CheckinsListPage() {
    const [rows, setRows] = useState<CheckinRow[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [eventFilter, setEventFilter] = useState('');
    const [sessionFilter, setSessionFilter] = useState('');
    const [universityFilter, setUniversityFilter] = useState('');
    const [dateFilter, setDateFilter] = useState(todayBangkok());
    const [historyFilter, setHistoryFilter] = useState<'active' | 'cancelled' | 'all'>('active');
    const [eventOptions, setEventOptions] = useState<{ id: number; name: string }[]>([]);
    const [sessionOptions, setSessionOptions] = useState<SessionOption[]>([]);
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
        api.backofficeEvents.list(token, 'limit=100').then((res) => {
            setEventOptions((res.events as Record<string, unknown>[]).map((event) => ({
                id: event.id as number,
                name: event.eventName as string,
            })));
        }).catch(() => undefined);
    }, []);

    useEffect(() => {
        if (!eventFilter) {
            setSessionOptions([]);
            setSessionFilter('');
            setUniversityOptions([]);
            setUniversityFilter('');
            return;
        }
        const token = getBackofficeToken();
        api.backofficeEvents.getSessions(token, Number(eventFilter)).then((res) => {
            setSessionOptions((res.sessions as Record<string, unknown>[]).map((session) => ({
                id: session.id as number,
                name: session.sessionName as string,
            })));
        }).catch(() => setSessionOptions([]));
        api.checkins.universities(token, Number(eventFilter)).then((res) => {
            setUniversityOptions(res.universities ?? []);
        }).catch(() => setUniversityOptions([]));
        setSessionFilter('');
        setUniversityFilter('');
    }, [eventFilter]);

    useEffect(() => setPage(1), [
        debouncedSearch,
        eventFilter,
        sessionFilter,
        universityFilter,
        dateFilter,
        historyFilter,
    ]);

    const buildQuery = useCallback((queryPage: number, queryLimit: number) => {
        const params: Record<string, string> = {
            page: String(queryPage),
            limit: String(queryLimit),
            eventId: eventFilter,
        };
        if (sessionFilter) {
            params.sessionId = sessionFilter;
            params.date = dateFilter;
            params.history = historyFilter;
        }
        if (debouncedSearch) params.search = debouncedSearch;
        if (universityFilter) params.university = universityFilter;
        return new URLSearchParams(params).toString();
    }, [
        eventFilter,
        sessionFilter,
        dateFilter,
        historyFilter,
        debouncedSearch,
        universityFilter,
    ]);

    const fetchData = useCallback(async () => {
        if (!eventFilter) {
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
                ...(sessionFilter ? { sessionId: sessionFilter, date: dateFilter } : {}),
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
            toast.error(error instanceof Error ? error.message : 'Failed to load check-ins');
        } finally {
            setIsLoading(false);
        }
    }, [eventFilter, sessionFilter, dateFilter, page, limit, buildQuery]);

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
                const res = await api.checkins.list(token, buildQuery(exportPage, pageSize));
                allRows.push(...(res.checkins as CheckinRow[]));
                pages = Math.max(1, res.pagination.totalPages);
                exportPage += 1;
            } while (exportPage <= pages);

            const eventName = eventOptions.find((event) => String(event.id) === eventFilter)?.name || 'event';
            exportToExcel(allRows.map((row) => ({
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
            })), `checkins_${eventName}_${dateFilter}_${historyFilter}`);
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
                const reason = window.prompt('เหตุผลในการยกเลิกเช็คอิน (จำเป็น)')?.trim();
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
            <div className="space-y-6">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
                    <select value={eventFilter} onChange={(event) => setEventFilter(event.target.value)} className="input">
                        <option value="">Select event</option>
                        {eventOptions.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}
                    </select>
                    <select value={sessionFilter} onChange={(event) => setSessionFilter(event.target.value)} className="input" disabled={!eventFilter}>
                        <option value="">All sessions (legacy view)</option>
                        {sessionOptions.map((session) => <option key={session.id} value={session.id}>{session.name}</option>)}
                    </select>
                    <input
                        type="date"
                        value={dateFilter}
                        onChange={(event) => setDateFilter(event.target.value)}
                        className="input"
                        disabled={!sessionFilter}
                        aria-label="Attendance date"
                    />
                    <select
                        value={historyFilter}
                        onChange={(event) => setHistoryFilter(event.target.value as 'active' | 'cancelled' | 'all')}
                        className="input"
                        disabled={!sessionFilter}
                    >
                        <option value="active">Active attendance</option>
                        <option value="cancelled">Cancelled history</option>
                        <option value="all">All history</option>
                    </select>
                    <select value={universityFilter} onChange={(event) => setUniversityFilter(event.target.value)} className="input" disabled={!eventFilter}>
                        <option value="">All universities</option>
                        {universityOptions.map((university) => <option key={university} value={university}>{university}</option>)}
                    </select>
                    <div className="relative">
                        <IconSearch size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                        <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} className="input pl-10" placeholder="Name / Reg code" />
                    </div>
                </div>

                {sessionFilter && stats && (
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                        {([
                            ['Eligible entitlements', stats.eligibleRegistrations ?? stats.total, IconUsers],
                            ['People on selected day', stats.checkedInPeopleOnDate ?? stats.checkedIn, IconUserCheck],
                            ['Unique identified people', stats.uniquePeople ?? stats.checkedIn, IconUsers],
                            ['Attendance occurrences', stats.attendanceOccurrences ?? stats.checkedIn, IconChartBar],
                            ['Unlinked registrations', stats.unlinkedRegistrationCount ?? 0, IconChartBar],
                        ] as Array<[string, number, typeof IconUsers]>).map(([label, value, Icon]) => (
                            <div className="card py-4" key={String(label)}>
                                <Icon size={20} className="mb-2 text-emerald-600" />
                                <p className="text-2xl font-bold text-zinc-900">{String(value)}</p>
                                <p className="text-xs text-zinc-500">{String(label)}</p>
                            </div>
                        ))}
                    </div>
                )}

                <div className="card">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h2 className="font-semibold text-zinc-900">
                                {sessionFilter ? `Attendance for ${dateFilter}` : 'Legacy session check-ins'}
                            </h2>
                            <p className="text-sm text-zinc-500">
                                {sessionFilter
                                    ? `${historyFilter} history · ${totalCount} matching rows`
                                    : `${totalCount} rows · choose a session for daily attendance semantics`}
                            </p>
                        </div>
                        <button onClick={handleExport} disabled={isExporting || !eventFilter} className="btn btn-secondary">
                            {isExporting ? <IconLoader2 size={18} className="animate-spin" /> : <IconDownload size={18} />}
                            Export all filtered rows
                        </button>
                    </div>

                    {isLoading ? (
                        <div className="flex justify-center py-16"><IconLoader2 className="animate-spin text-emerald-600" /></div>
                    ) : rows.length === 0 ? (
                        <div className="py-16 text-center text-zinc-400">No matching attendance records</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[980px] text-sm">
                                <thead>
                                    <tr className="border-b border-zinc-200 text-left text-zinc-500">
                                        <th className="py-3 pr-4">Person</th>
                                        <th className="py-3 pr-4">Session</th>
                                        <th className="py-3 pr-4">Attendance day</th>
                                        <th className="py-3 pr-4">Scan time</th>
                                        <th className="py-3 pr-4">Actor</th>
                                        <th className="py-3 pr-4">State</th>
                                        <th className="py-3 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((row) => (
                                        <tr key={`${row.kind || 'single'}-${row.id}`} className="border-b border-zinc-100 align-top">
                                            <td className="py-4 pr-4">
                                                <p className="font-medium text-zinc-900">{row.firstName} {row.lastName}</p>
                                                <p className="text-xs text-zinc-500">{row.regCode} · {row.university || 'No university'}</p>
                                            </td>
                                            <td className="py-4 pr-4 text-zinc-700">{row.sessionName || '-'}</td>
                                            <td className="py-4 pr-4">{row.attendanceDate || 'single-session'}</td>
                                            <td className="py-4 pr-4">{formatDateTime(row.scannedAt)}</td>
                                            <td className="py-4 pr-4">
                                                {row.scannedBy
                                                    ? `${row.scannedBy.firstName ?? ''} ${row.scannedBy.lastName ?? ''}`.trim() || '-'
                                                    : '-'}
                                            </td>
                                            <td className="py-4 pr-4">
                                                {row.cancelledAt ? (
                                                    <div>
                                                        <span className="rounded-full bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700">Cancelled</span>
                                                        <p className="mt-1 max-w-xs text-xs text-zinc-500">{row.cancellationReason || '-'}</p>
                                                    </div>
                                                ) : (
                                                    <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">Active</span>
                                                )}
                                            </td>
                                            <td className="py-4 text-right">
                                                {!row.cancelledAt && (
                                                    <button
                                                        onClick={() => void handleUndo(row)}
                                                        disabled={undoingId === row.id}
                                                        className="inline-flex items-center gap-1 text-sm font-medium text-amber-700 hover:text-amber-800"
                                                    >
                                                        {undoingId === row.id
                                                            ? <IconLoader2 size={16} className="animate-spin" />
                                                            : <IconArrowBackUp size={16} />}
                                                        Undo
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
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
                                onPageSizeChange={(value) => { setLimit(value); setPage(1); }}
                                itemName="attendance rows"
                            />
                        </div>
                    )}
                </div>
            </div>
        </AdminLayout>
    );
}
