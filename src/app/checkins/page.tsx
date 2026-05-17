'use client';

import { useState, useEffect, useCallback } from 'react';
import { AdminLayout } from '@/components/layout';
import { api } from '@/lib/api';
import { exportToExcel } from '@/lib/exportExcel';
import { useDebounce } from '@/hooks/useDebounce';
import { Pagination } from '@/components/common';
import toast from 'react-hot-toast';
import {
    IconUserCheck,
    IconSearch,
    IconDownload,
    IconLoader2,
    IconCheck,
    IconClock,
    IconArrowBackUp,
    IconUsers,
    IconChartBar,
} from '@tabler/icons-react';

interface CheckinRow {
    id: number;
    scannedAt: string;
    regCode: string;
    firstName: string;
    lastName: string;
    email: string;
    university: string | null;
    institution: string | null;
    ticketName: string | null;
    sessionName: string | null;
    eventName: string | null;
    scannedBy: { firstName: string | null; lastName: string | null } | null;
}

interface SessionOption { id: number; name: string }

interface Stats {
    total: number;
    checkedIn: number;
    remaining: number;
    percentage: number;
}

const getBackofficeToken = () =>
    localStorage.getItem('backoffice_token') ||
    sessionStorage.getItem('backoffice_token') ||
    '';

const formatDateTime = (iso: string) => {
    if (!iso) return '-';
    const d = new Date(iso);
    return d.toLocaleString('th-TH', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
};

export default function CheckinsListPage() {
    const [rows, setRows] = useState<CheckinRow[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [eventFilter, setEventFilter] = useState('');
    const [sessionFilter, setSessionFilter] = useState('');
    const [universityFilter, setUniversityFilter] = useState('');
    const [eventOptions, setEventOptions] = useState<{ id: number; name: string }[]>([]);
    const [sessionOptions, setSessionOptions] = useState<SessionOption[]>([]);
    const [universityOptions, setUniversityOptions] = useState<string[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);
    const [isExporting, setIsExporting] = useState(false);
    const [undoingId, setUndoingId] = useState<number | null>(null);

    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);

    const debouncedSearch = useDebounce(searchTerm, 300);

    // Load events for filter
    useEffect(() => {
        const token = getBackofficeToken();
        api.backofficeEvents.list(token, 'limit=100').then((res) => {
            setEventOptions((res.events as Record<string, unknown>[]).map((e) => ({ id: e.id as number, name: e.eventName as string })));
        }).catch(() => { });
    }, []);

    // Load sessions + universities when event changes
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
            setSessionOptions((res.sessions as Record<string, unknown>[]).map((s) => ({ id: s.id as number, name: s.sessionName as string })));
        }).catch(() => setSessionOptions([]));
        api.checkins.universities(token, Number(eventFilter)).then((res) => {
            setUniversityOptions(res.universities ?? []);
        }).catch(() => setUniversityOptions([]));
        setSessionFilter('');
        setUniversityFilter('');
    }, [eventFilter]);

    const fetchData = useCallback(async () => {
        if (!eventFilter) return;
        setIsLoading(true);
        try {
            const token = getBackofficeToken();
            const params: Record<string, string> = { page: String(page), limit: '20', eventId: eventFilter };
            if (debouncedSearch) params.search = debouncedSearch;
            if (sessionFilter) params.sessionId = sessionFilter;
            if (universityFilter) params.university = universityFilter;

            const [listRes, statsRes] = await Promise.all([
                api.checkins.list(token, new URLSearchParams(params).toString()),
                api.checkins.stats(token, new URLSearchParams({
                    eventId: eventFilter,
                    ...(sessionFilter ? { sessionId: sessionFilter } : {}),
                }).toString()),
            ]);

            setRows((listRes.checkins || []) as CheckinRow[]);
            setTotalCount(listRes.pagination.total);
            setTotalPages(listRes.pagination.totalPages);
            setStats({
                total: statsRes.total,
                checkedIn: statsRes.checkedIn,
                remaining: statsRes.remaining,
                percentage: statsRes.percentage,
            });
        } catch (err) {
            console.error('Failed to load check-ins:', err);
            toast.error('Failed to load check-ins');
        } finally {
            setIsLoading(false);
        }
    }, [page, debouncedSearch, eventFilter, sessionFilter, universityFilter]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleExport = async () => {
        if (!eventFilter) return;
        setIsExporting(true);
        try {
            const token = getBackofficeToken();
            const params: Record<string, string> = { page: '1', limit: '5000', eventId: eventFilter };
            if (debouncedSearch) params.search = debouncedSearch;
            if (sessionFilter) params.sessionId = sessionFilter;
            if (universityFilter) params.university = universityFilter;

            const res = await api.checkins.list(token, new URLSearchParams(params).toString());
            const eventName = eventOptions.find(e => String(e.id) === eventFilter)?.name || 'event';

            const data = (res.checkins as CheckinRow[]).map((r) => ({
                'Reg Code': r.regCode,
                'First Name': r.firstName,
                'Last Name': r.lastName,
                'Email': r.email,
                'University': r.university ?? '',
                'Institution': r.institution ?? '',
                'Event': r.eventName ?? '',
                'Ticket': r.ticketName ?? '',
                'Session': r.sessionName ?? '',
                'Checked-in At': formatDateTime(r.scannedAt),
                'Scanned By': r.scannedBy ? `${r.scannedBy.firstName ?? ''} ${r.scannedBy.lastName ?? ''}`.trim() : '',
            }));
            exportToExcel(data, `checkins_${eventName.replace(/\s+/g, '_')}`);
            toast.success(`Exported ${data.length} rows`);
        } catch (err) {
            console.error('Export failed:', err);
            toast.error('Export failed');
        } finally {
            setIsExporting(false);
        }
    };

    const handleUndo = async (row: CheckinRow) => {
        if (!confirm(`Undo check-in for ${row.firstName} ${row.lastName} (${row.regCode})?\nSession: ${row.sessionName ?? '-'}`)) return;
        setUndoingId(row.id);
        try {
            const token = getBackofficeToken();
            await api.checkins.undo(token, row.id);
            toast.success('Check-in undone');
            fetchData();
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Undo failed';
            toast.error(msg);
        } finally {
            setUndoingId(null);
        }
    };

    return (
        <AdminLayout title="Checked-in Attendees">
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <StatCard
                    icon={<IconUsers size={22} />}
                    color="blue"
                    label="Total Registered"
                    value={stats?.total ?? '-'}
                />
                <StatCard
                    icon={<IconUserCheck size={22} />}
                    color="green"
                    label="Checked-in"
                    value={stats?.checkedIn ?? '-'}
                />
                <StatCard
                    icon={<IconClock size={22} />}
                    color="amber"
                    label="Remaining"
                    value={stats?.remaining ?? '-'}
                />
                <StatCard
                    icon={<IconChartBar size={22} />}
                    color="violet"
                    label="Progress"
                    value={stats ? `${stats.percentage}%` : '-'}
                />
            </div>

            {/* Filters */}
            <div className="card mb-6">
                <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
                    <div className="flex flex-col md:flex-row gap-4 flex-1">
                        <div className="relative flex-1 max-w-md">
                            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                type="text"
                                placeholder="Search by name or reg code..."
                                value={searchTerm}
                                onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                                className="input-field-search"
                            />
                        </div>

                        <select
                            value={eventFilter}
                            onChange={(e) => { setEventFilter(e.target.value); setPage(1); }}
                            className="input-field w-auto"
                        >
                            <option value="">-- เลือก Event --</option>
                            {eventOptions.map((e) => (
                                <option key={e.id} value={e.id}>{e.name}</option>
                            ))}
                        </select>

                        <select
                            value={sessionFilter}
                            onChange={(e) => { setSessionFilter(e.target.value); setPage(1); }}
                            className="input-field w-auto"
                            disabled={!eventFilter || sessionOptions.length === 0}
                        >
                            <option value="">All Sessions</option>
                            {sessionOptions.map((s) => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>

                        <select
                            value={universityFilter}
                            onChange={(e) => { setUniversityFilter(e.target.value); setPage(1); }}
                            className="input-field w-auto max-w-[220px]"
                            disabled={!eventFilter || universityOptions.length === 0}
                            title={universityFilter || 'All Universities'}
                        >
                            <option value="">All Universities</option>
                            {universityOptions.map((u) => (
                                <option key={u} value={u}>{u}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={handleExport}
                            disabled={!eventFilter || isExporting}
                            className="btn-secondary flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {isExporting ? <IconLoader2 size={18} className="animate-spin" /> : <IconDownload size={18} />}
                            Export Excel
                        </button>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                {!eventFilter ? (
                    <div className="text-center py-16 text-gray-400">
                        <IconUserCheck size={40} className="mx-auto mb-3 opacity-30" />
                        <p className="font-medium">กรุณาเลือก Event เพื่อดูผู้ที่เช็คอินแล้ว</p>
                    </div>
                ) : isLoading ? (
                    <div className="flex justify-center py-12">
                        <IconLoader2 size={32} className="animate-spin text-blue-600" />
                    </div>
                ) : rows.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                        ยังไม่มีผู้เช็คอินตามเงื่อนไขที่เลือก
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-200">
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">เวลาเช็คอิน</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Code</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Attendee</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">University</th>
                                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Ticket</th>
                                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Session</th>
                                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Scanned By</th>
                                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider w-[90px]">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {rows.map((r) => (
                                    <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2 text-sm text-gray-700">
                                                <span className="inline-flex w-5 h-5 rounded-full bg-green-100 text-green-700 items-center justify-center">
                                                    <IconCheck size={12} stroke={3} />
                                                </span>
                                                {formatDateTime(r.scannedAt)}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="font-mono text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded">
                                                {r.regCode}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div>
                                                <p className="font-medium text-gray-900">{r.firstName} {r.lastName}</p>
                                                <p className="text-sm text-gray-500">{r.email}</p>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-700 max-w-[220px]">
                                            {r.university ? (
                                                <p className="truncate" title={r.university}>{r.university}</p>
                                            ) : r.institution ? (
                                                <p className="truncate text-gray-500" title={r.institution}>{r.institution}</p>
                                            ) : (
                                                <span className="text-gray-400">-</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                                                {r.ticketName ?? '-'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center text-sm text-gray-700">
                                            {r.sessionName ?? '-'}
                                        </td>
                                        <td className="px-4 py-3 text-center text-sm text-gray-600">
                                            {r.scannedBy?.firstName
                                                ? `${r.scannedBy.firstName} ${r.scannedBy.lastName ?? ''}`
                                                : <span className="text-gray-400">system</span>}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <button
                                                onClick={() => handleUndo(r)}
                                                disabled={undoingId === r.id}
                                                className="p-2 hover:bg-red-50 rounded-lg text-gray-500 hover:text-red-600 transition-colors disabled:opacity-40"
                                                title="Undo check-in"
                                            >
                                                {undoingId === r.id
                                                    ? <IconLoader2 size={18} className="animate-spin" />
                                                    : <IconArrowBackUp size={18} />}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <Pagination
                            currentPage={page}
                            totalPages={totalPages}
                            totalCount={totalCount}
                            onPageChange={setPage}
                            itemName="check-ins"
                        />
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}

const colorMap = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    amber: 'bg-amber-100 text-amber-600',
    violet: 'bg-violet-100 text-violet-600',
} as const;

function StatCard({ icon, color, label, value }: {
    icon: React.ReactNode;
    color: keyof typeof colorMap;
    label: string;
    value: number | string;
}) {
    return (
        <div className="card py-4">
            <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colorMap[color]}`}>
                    {icon}
                </div>
                <div>
                    <p className="text-2xl font-bold text-gray-800">{value}</p>
                    <p className="text-sm text-gray-500">{label}</p>
                </div>
            </div>
        </div>
    );
}
