'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { AdminLayout } from '@/components/layout';
import { api } from '@/lib/api';
import { exportToExcel } from '@/lib/exportExcel';
import { useDebounce } from '@/hooks/useDebounce';
import { Pagination } from '@/components/common';
import {
    IconUsers,
    IconSearch,
    IconEye,
    IconDownload,
    IconUserPlus,
    IconLoader2,
} from '@tabler/icons-react';



interface Registration {
    id: number;
    regCode: string;
    firstName: string;
    lastName: string;
    email: string;
    status: string;
    createdAt: string;
    ticketName: string;
    eventName: string;
    eventCode: string;
    source?: string;
    addedNote?: string | null;
    addedByFirstName?: string | null;
    addedByLastName?: string | null;
}

const getBackofficeToken = () =>
    localStorage.getItem('backoffice_token') ||
    sessionStorage.getItem('backoffice_token') ||
    '';

export default function RegistrationsPage() {
    const [registrations, setRegistrations] = useState<Registration[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [sourceFilter, setSourceFilter] = useState('');
    const [eventFilter, setEventFilter] = useState('');
    const [eventOptions, setEventOptions] = useState<{ id: number; name: string }[]>([]);
    const [eventSelected, setEventSelected] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

    // Pagination
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);


    // Debounce search term to avoid API calls on every keystroke
    const debouncedSearchTerm = useDebounce(searchTerm, 300);

    // Fetch events for filter dropdown
    useEffect(() => {
        const token = getBackofficeToken();
        api.backofficeEvents.list(token, 'limit=100').then((res) => {
            setEventOptions((res.events as any[]).map((e) => ({ id: e.id as number, name: e.eventName as string })));
        }).catch(() => {});
    }, []);

    useEffect(() => {
        if (!eventSelected) return;
        fetchRegistrations();
    }, [page, debouncedSearchTerm, statusFilter, sourceFilter, eventFilter, eventSelected]);

    const handleExport = async () => {
        if (!eventFilter) return;
        setIsExporting(true);
        try {
            const token = getBackofficeToken();
            const params: any = { page: 1, limit: 1000 };
            if (statusFilter) params.status = statusFilter;
            if (searchTerm) params.search = searchTerm;
            if (sourceFilter) params.source = sourceFilter;
            if (eventFilter) params.eventId = eventFilter;

            const res = await api.registrations.list(token, new URLSearchParams(params).toString());
            const eventName = eventOptions.find(e => String(e.id) === eventFilter)?.name || 'event';

            const rows = (res.registrations as any[]).map((r) => ({
                'Reg Code': r.regCode,
                'First Name': r.firstName,
                'Last Name': r.lastName,
                'Email': r.email,
                'Ticket': r.ticketName,
                'Status': r.status,
                'Source': r.source,
                'Note': r.addedNote || '',
                'Added By': r.addedByFirstName ? `${r.addedByFirstName} ${r.addedByLastName}` : '',
                'Created At': new Date(r.createdAt).toLocaleString('th-TH'),
            }));

            exportToExcel(rows, `registrations_${eventName.replace(/\s+/g, '_')}`);
        } catch (error) {
            console.error('Export failed:', error);
            alert('Export failed');
        } finally {
            setIsExporting(false);
        }
    };

    const fetchRegistrations = async () => {
        setIsLoading(true);
        try {
            const token = getBackofficeToken();
            const params: any = { page, limit: 10 };
            if (statusFilter) params.status = statusFilter;
            if (searchTerm) params.search = searchTerm;
            if (sourceFilter) params.source = sourceFilter;
            if (eventFilter) params.eventId = eventFilter;

            const res = await api.registrations.list(token, new URLSearchParams(params).toString());
            setRegistrations(res.registrations as unknown as Registration[]);
            setTotalCount(res.pagination.total);
            setTotalPages(res.pagination.totalPages);
        } catch (error) {
            console.error('Failed to fetch registrations:', error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <AdminLayout title="Registrations">
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="card py-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
                            <IconUsers size={24} stroke={1.5} />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-800">{isLoading ? '-' : totalCount}</p>
                            <p className="text-sm text-gray-500">Total Registrations</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters & Actions */}
            <div className="card mb-6">
                <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
                    <div className="flex flex-col md:flex-row gap-4 flex-1">
                        <div className="relative flex-1 max-w-md">
                            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                type="text"
                                placeholder="Search by name, email, or code..."
                                value={searchTerm}
                                onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                                className="input-field-search"
                            />
                        </div>

                        <select
                            value={statusFilter}
                            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                            className="input-field w-auto"
                        >
                            <option value="">All Status</option>
                            <option value="confirmed">Confirmed</option>
                            <option value="cancelled">Cancelled</option>
                        </select>

                        <select
                            value={sourceFilter}
                            onChange={(e) => { setSourceFilter(e.target.value); setPage(1); }}
                            className="input-field w-auto"
                        >
                            <option value="">All Source</option>
                            <option value="purchase">Purchase</option>
                            <option value="manual">Manual</option>
                            <option value="free">Free</option>
                        </select>

                        <select
                                value={eventFilter}
                                onChange={(e) => { setEventFilter(e.target.value); setEventSelected(!!e.target.value); setPage(1); }}
                                className="input-field w-auto"
                            >
                                <option value="">-- เลือก Event --</option>
                                {eventOptions.map((e) => (
                                    <option key={e.id} value={e.id}>{e.name}</option>
                                ))}
                            </select>
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={handleExport}
                            disabled={!eventSelected || isExporting}
                            className="btn-secondary flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {isExporting ? <IconLoader2 size={18} className="animate-spin" /> : <IconDownload size={18} />}
                            Export Excel
                        </button>
                        <Link
                            href="/registrations/add"
                            className="btn-primary flex items-center gap-2"
                        >
                            <IconUserPlus size={18} /> Add Registration
                        </Link>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                {!eventSelected ? (
                    <div className="text-center py-16 text-gray-400">
                        <IconUsers size={40} className="mx-auto mb-3 opacity-30" />
                        <p className="font-medium">กรุณาเลือก Event เพื่อดูข้อมูล</p>
                    </div>
                ) : isLoading ? (
                    <div className="flex justify-center py-12">
                        <IconLoader2 size={32} className="animate-spin text-blue-600" />
                    </div>
                ) : registrations.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                        No registrations found.
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-200">
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Code</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Attendee</th>
                                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Event</th>
                                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Ticket</th>
                                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Source</th>
                                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider w-[100px]">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {registrations.map((reg) => (
                                        <tr key={reg.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-4 py-4">
                                                <span className="font-mono text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded">
                                                    {reg.regCode}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4">
                                                <div>
                                                    <p className="font-medium text-gray-900">{reg.firstName} {reg.lastName}</p>
                                                    <p className="text-sm text-gray-500">{reg.email}</p>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 text-center">
                                                <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                                                    {reg.eventCode}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4 text-center">
                                                <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                                                    {reg.ticketName}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4 text-center">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${reg.status === 'confirmed' ? 'bg-green-50 text-green-700 border-green-200' :
                                                    reg.status === 'pending' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                                                        'bg-red-50 text-red-700 border-red-200'
                                                    }`}>
                                                    {reg.status === 'confirmed' && <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>}
                                                    {reg.status === 'pending' && <span className="w-1.5 h-1.5 rounded-full bg-yellow-500"></span>}
                                                    {reg.status === 'cancelled' && <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>}
                                                    {reg.status.charAt(0).toUpperCase() + reg.status.slice(1)}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4 text-center">
                                                {reg.source === 'manual' ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200"
                                                        title={`Added by ${reg.addedByFirstName || ''} ${reg.addedByLastName || ''}${reg.addedNote ? ` — ${reg.addedNote}` : ''}`}
                                                    >
                                                        Manual
                                                    </span>
                                                ) : reg.source === 'free' ? (
                                                    <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                                                        Free
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-gray-50 text-gray-500">
                                                        Purchase
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-4 text-center">
                                                <div className="flex gap-1 justify-center items-center">
                                                    <Link
                                                        href={`/registrations/${reg.id}`}
                                                        className="p-2 hover:bg-blue-50 rounded-lg text-gray-500 hover:text-blue-600 transition-colors"
                                                        title="View Details"
                                                    >
                                                        <IconEye size={18} />
                                                    </Link>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            {/* Pagination */}
                            <Pagination
                                currentPage={page}
                                totalPages={totalPages}
                                totalCount={totalCount}
                                onPageChange={setPage}
                                itemName="registrations"
                            />
                        </div>
                    </>
                )}
            </div>

        </AdminLayout>
    );
}
