'use client';

import { useCallback, useEffect, useState } from 'react';
import { AdminLayout } from '@/components/layout';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import {
    IconCalendarEvent,
    IconCheck,
    IconLoader2,
    IconRefresh,
    IconUsers,
} from '@tabler/icons-react';

interface AttendanceStats {
    eligibleRegistrations: number;
    checkedInPeopleOnDate: number;
    uniquePeople: number;
    attendanceOccurrences: number;
    unlinkedRegistrationCount: number;
    serverDate: string;
    selectedDate: string;
}

interface AttendanceRow {
    id: string | number;
    regCode: string;
    firstName: string;
    lastName: string;
    attendanceDate?: string | null;
    scannedAt: string;
    cancelledAt?: string | null;
    cancellationReason?: string | null;
}

const demoRegistrationTrend = [
    { date: 'Jan 1', count: 45 },
    { date: 'Jan 10', count: 125 },
    { date: 'Jan 20', count: 256 },
    { date: 'Feb 5', count: 423 },
];

const getBackofficeToken = () =>
    localStorage.getItem('backoffice_token') ||
    sessionStorage.getItem('backoffice_token') ||
    '';

const todayBangkok = () => new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
}).format(new Date());

export default function ReportsPage() {
    const { currentEvent } = useAuth();
    const [sessionId, setSessionId] = useState('');
    const [sessions, setSessions] = useState<{ id: number; name: string }[]>([]);
    const [date, setDate] = useState(todayBangkok());
    const [stats, setStats] = useState<AttendanceStats | null>(null);
    const [rows, setRows] = useState<AttendanceRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setSessionId('');
        setSessions([]);
        setStats(null);
        setRows([]);
        if (!currentEvent) return;
        api.backofficeEvents.getSessions(getBackofficeToken(), currentEvent.id)
            .then((response) => {
                setSessions((response.sessions as Record<string, unknown>[]).map((session) => ({
                    id: session.id as number,
                    name: session.sessionName as string,
                })));
            })
            .catch((loadError) => {
                setError(loadError instanceof Error ? loadError.message : 'โหลด Session ไม่สำเร็จ');
            });
    }, [currentEvent]);

    const loadAttendance = useCallback(async () => {
        if (!currentEvent || !sessionId) {
            setStats(null);
            setRows([]);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const token = getBackofficeToken();
            const query = new URLSearchParams({
                eventId: String(currentEvent.id),
                sessionId,
                date,
            });
            const [statsResponse, rowsResponse] = await Promise.all([
                api.checkins.stats(token, query.toString()),
                api.checkins.list(token, new URLSearchParams({
                    ...Object.fromEntries(query),
                    history: 'active',
                    page: '1',
                    limit: '100',
                }).toString()),
            ]);
            setStats({
                eligibleRegistrations: statsResponse.eligibleRegistrations ?? statsResponse.total,
                checkedInPeopleOnDate: statsResponse.checkedInPeopleOnDate ?? statsResponse.checkedIn,
                uniquePeople: statsResponse.uniquePeople ?? statsResponse.checkedIn,
                attendanceOccurrences: statsResponse.attendanceOccurrences ?? statsResponse.checkedIn,
                unlinkedRegistrationCount: statsResponse.unlinkedRegistrationCount ?? 0,
                serverDate: statsResponse.serverDate ?? date,
                selectedDate: statsResponse.selectedDate ?? date,
            });
            setRows(rowsResponse.checkins as AttendanceRow[]);
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : 'โหลดรายงาน Attendance ไม่สำเร็จ');
        } finally {
            setLoading(false);
        }
    }, [currentEvent, sessionId, date]);

    useEffect(() => {
        void loadAttendance();
    }, [loadAttendance]);

    return (
        <AdminLayout title={currentEvent ? `Reports: ${currentEvent.name}` : 'Reports & Analytics'}>
            <div className="space-y-6">
                <div className="card">
                    <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
                        <div>
                            <h2 className="text-lg font-semibold text-zinc-900">Live Attendance</h2>
                            <p className="text-sm text-zinc-500">
                                ข้อมูลส่วนนี้อ่านจาก attendance API จริง ไม่ใช้ sample totals
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <select
                                className="input min-w-56"
                                value={sessionId}
                                onChange={(event) => setSessionId(event.target.value)}
                                disabled={!currentEvent}
                            >
                                <option value="">Select session</option>
                                {sessions.map((session) => (
                                    <option key={session.id} value={session.id}>{session.name}</option>
                                ))}
                            </select>
                            <input
                                type="date"
                                className="input w-auto"
                                value={date}
                                onChange={(event) => setDate(event.target.value)}
                                disabled={!sessionId}
                            />
                            <button className="btn btn-secondary" onClick={() => void loadAttendance()} disabled={!sessionId || loading}>
                                {loading ? <IconLoader2 size={18} className="animate-spin" /> : <IconRefresh size={18} />}
                                Retry / Refresh
                            </button>
                        </div>
                    </div>
                </div>

                {error && (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                        <p>{error}</p>
                        <button className="mt-2 font-medium underline" onClick={() => void loadAttendance()}>Retry</button>
                    </div>
                )}

                {loading && (
                    <div className="card flex items-center justify-center gap-2 py-16 text-zinc-500">
                        <IconLoader2 size={22} className="animate-spin" /> Loading attendance…
                    </div>
                )}

                {!loading && sessionId && stats && (
                    <>
                        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
                            {([
                                ['Eligible entitlements', stats.eligibleRegistrations, IconUsers],
                                ['People on selected day', stats.checkedInPeopleOnDate, IconCheck],
                                ['Unique identified people', stats.uniquePeople, IconUsers],
                                ['Attendance occurrences', stats.attendanceOccurrences, IconCalendarEvent],
                                ['Unlinked registrations', stats.unlinkedRegistrationCount, IconUsers],
                            ] as Array<[string, number, typeof IconUsers]>).map(([label, value, Icon]) => (
                                <div className="card py-4" key={String(label)}>
                                    <Icon size={22} className="mb-2 text-emerald-600" />
                                    <p className="text-2xl font-bold text-zinc-900">{String(value)}</p>
                                    <p className="text-xs text-zinc-500">{String(label)}</p>
                                </div>
                            ))}
                        </div>
                        <div className="card">
                            <div className="mb-4 flex flex-wrap justify-between gap-2">
                                <div>
                                    <h3 className="font-semibold text-zinc-900">Active attendance — {stats.selectedDate}</h3>
                                    <p className="text-xs text-zinc-500">Server date: {stats.serverDate}</p>
                                </div>
                                <p className="text-sm text-zinc-500">Showing first {rows.length} matching rows</p>
                            </div>
                            {rows.length === 0 ? (
                                <p className="py-10 text-center text-zinc-400">ไม่มี attendance ในวันที่เลือก</p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[720px] text-sm">
                                        <thead>
                                            <tr className="border-b border-zinc-200 text-left text-zinc-500">
                                                <th className="py-3 pr-4">Registration</th>
                                                <th className="py-3 pr-4">Name</th>
                                                <th className="py-3 pr-4">Day</th>
                                                <th className="py-3">Scan time</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {rows.map((row) => (
                                                <tr key={String(row.id)} className="border-b border-zinc-100">
                                                    <td className="py-3 pr-4">{row.regCode}</td>
                                                    <td className="py-3 pr-4">{row.firstName} {row.lastName}</td>
                                                    <td className="py-3 pr-4">{row.attendanceDate || '-'}</td>
                                                    <td className="py-3">{new Date(row.scannedAt).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </>
                )}

                <div className="card border-dashed">
                    <h2 className="text-lg font-semibold text-zinc-900">Demonstration analytics</h2>
                    <p className="mt-1 text-sm text-amber-700">
                        ส่วน revenue/registration trend เดิมยังเป็นข้อมูลสาธิต ไม่ใช่ตัวเลข production ที่ยืนยันแล้ว
                    </p>
                    <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                        {demoRegistrationTrend.map((item) => (
                            <div key={item.date} className="rounded-xl bg-zinc-50 p-3">
                                <p className="text-xs text-zinc-500">{item.date}</p>
                                <p className="text-xl font-semibold text-zinc-800">{item.count}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}
