'use client';

import { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AdminLayout } from '@/components/layout';
import { api, ApiError } from '@/lib/api';
import { exportToExcel } from '@/lib/exportExcel';
import { useDebounce } from '@/hooks/useDebounce';
import { Pagination } from '@/components/common';
import { AddSessionDialog } from '@/components/registrations/AddSessionDialog';
import { SessionGrantResults } from '@/components/registrations/SessionGrantResults';
import { SESSION_GRANT_SELECTION_LIMIT, updateSelection, type SelectedRegistration } from '@/lib/session-grant-selection';
import type { GrantSessionChoiceDto } from '@/types/session-grants';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';
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
    promoCode?: string | null;
    addedNote?: string | null;
    addedByFirstName?: string | null;
    addedByLastName?: string | null;
    grantEligible?: boolean;
    grantDisabledReason?: string | null;
    hasSession?: boolean;
    hasParticipantSession?: boolean;
    hasPendingInvitation?: boolean;
}

interface PromoCodeOption {
    id: number;
    code: string;
}

const getBackofficeToken = () =>
    localStorage.getItem('backoffice_token') ||
    sessionStorage.getItem('backoffice_token') ||
    '';

const bangkokDateTime = (value: string) => new Date(value).toLocaleString('th-TH', {
    timeZone: 'Asia/Bangkok',
    dateStyle: 'medium',
    timeStyle: 'short',
});

const grantDisabledLabel = (reason?: string | null) => {
    switch (reason) {
        case 'ALREADY_REGISTERED': return 'มีสิทธิ์ Session นี้แล้ว';
        case 'ALREADY_INVITED': return 'มีคำเชิญที่ยังรอตอบรับ';
        case 'DUPLICATE_PARTICIPANT': return 'บุคคลเดียวกันถูกเลือกแล้ว';
        case 'REGISTRATION_NOT_CONFIRMED': return 'Registration ไม่อยู่ในสถานะยืนยัน';
        case 'EVENT_MISMATCH': return 'Registration อยู่คนละ Event';
        case 'SESSION_INACTIVE': return 'Session ไม่เปิดใช้งาน';
        case 'SESSION_ENDED': return 'Session สิ้นสุดแล้ว';
        case 'SESSION_RESPONSE_CLOSED': return 'Session ปิดรับคำตอบแล้ว';
        default: return reason || 'ไม่สามารถเพิ่มสิทธิ์ได้';
    }
};

async function fetchEventPromoCodes(token: string, eventId: string): Promise<PromoCodeOption[]> {
    const toOptions = (rows: Record<string, unknown>[]) =>
        rows.map((promo) => ({ id: Number(promo.id), code: String(promo.code) }));
    const firstPage = await api.promoCodes.list(token, new URLSearchParams({
        page: '1',
        limit: '100',
        eventId,
    }).toString());
    const options = toOptions(firstPage.promoCodes);

    for (let page = 2; page <= firstPage.pagination.totalPages; page += 1) {
        const result = await api.promoCodes.list(token, new URLSearchParams({
            page: String(page),
            limit: '100',
            eventId,
        }).toString());
        options.push(...toOptions(result.promoCodes));
    }

    return options;
}

export default function RegistrationsPage() {
    const { user } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const isOrganizer = user?.role === 'organizer';
    const isAdmin = user?.role === 'admin';
    const [registrations, setRegistrations] = useState<Registration[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [sourceFilter, setSourceFilter] = useState('');
    const [eventFilter, setEventFilter] = useState('');
    const [eventOptions, setEventOptions] = useState<{ id: number; name: string }[]>([]);
    const [promoCodeOptions, setPromoCodeOptions] = useState<PromoCodeOption[]>([]);
    const [promoCodeFilter, setPromoCodeFilter] = useState('');
    const [isLoadingPromoCodes, setIsLoadingPromoCodes] = useState(false);
    const [eventSelected, setEventSelected] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [grantFeatureEnabled, setGrantFeatureEnabled] = useState(false);
    const [grantDialogOpen, setGrantDialogOpen] = useState(false);
    const [grantSession, setGrantSession] = useState<GrantSessionChoiceDto | null>(null);
    const [selectedRegistrations, setSelectedRegistrations] = useState<Map<number, SelectedRegistration>>(new Map());
    const [isGrantSubmitting, setIsGrantSubmitting] = useState(false);
    const [pendingGrantOperation, setPendingGrantOperation] = useState<{
        key: string;
        sessionId: number;
        registrationIds: number[];
    } | null>(null);
    const [grantBatchId, setGrantBatchId] = useState<string | null>(() => searchParams.get('grantBatchId'));
    const registrationRequestRef = useRef(0);

    // Pagination
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);


    // Debounce search term to avoid API calls on every keystroke
    const debouncedSearchTerm = useDebounce(searchTerm, 300);
    const visibleEligibleRegistrations = useMemo(
        () => registrations.filter((registration) => registration.grantEligible),
        [registrations],
    );
    const selectedCount = selectedRegistrations.size;
    const allVisibleSelected = visibleEligibleRegistrations.length > 0 &&
        visibleEligibleRegistrations.every((registration) => selectedRegistrations.has(registration.id));
    const someVisibleSelected = visibleEligibleRegistrations.some((registration) => selectedRegistrations.has(registration.id));

    useEffect(() => {
        if (!isAdmin) {
            setGrantFeatureEnabled(false);
            return;
        }
        api.sessionGrants.status(getBackofficeToken())
            .then((status) => setGrantFeatureEnabled(status.enabled))
            .catch(() => setGrantFeatureEnabled(false));
    }, [isAdmin]);

    // Fetch events for filter dropdown
    useEffect(() => {
        const token = getBackofficeToken();
        api.backofficeEvents.list(token, 'limit=100').then((res) => {
            setEventOptions((res.events as any[]).map((e) => ({ id: e.id as number, name: e.eventName as string })));
        }).catch(() => {});
    }, []);

    useEffect(() => {
        if (!isOrganizer || eventOptions.length !== 1 || eventFilter) return;
        setEventFilter(String(eventOptions[0].id));
        setEventSelected(true);
        setPage(1);
    }, [isOrganizer, eventOptions, eventFilter]);

    useEffect(() => {
        let isCurrent = true;
        setPromoCodeOptions([]);

        if (!eventFilter) {
            setIsLoadingPromoCodes(false);
            return () => { isCurrent = false; };
        }

        setIsLoadingPromoCodes(true);
        fetchEventPromoCodes(getBackofficeToken(), eventFilter)
            .then((options) => {
                if (isCurrent) setPromoCodeOptions(options);
            })
            .catch((error) => {
                console.error('Failed to fetch promo codes:', error);
                if (isCurrent) {
                    setPromoCodeOptions([]);
                    toast.error('Failed to load promo codes');
                }
            })
            .finally(() => {
                if (isCurrent) setIsLoadingPromoCodes(false);
            });

        return () => { isCurrent = false; };
    }, [eventFilter]);

    useEffect(() => {
        if (!eventSelected) return;
        fetchRegistrations();
    }, [page, debouncedSearchTerm, statusFilter, sourceFilter, eventFilter, promoCodeFilter, eventSelected, grantSession?.id]);

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
            if (promoCodeFilter) params.promoCodeId = promoCodeFilter;

            const res = await api.registrations.list(token, new URLSearchParams(params).toString());
            const eventName = eventOptions.find(e => String(e.id) === eventFilter)?.name || 'event';

            const rows = (res.registrations as any[]).map((r) => ({
                'Reg Code': r.regCode,
                'First Name': r.firstName,
                'Last Name': r.lastName,
                'Email': r.email,
                'Ticket': r.ticketName,
                'Promo Code': r.promoCode || '',
                'Status': r.status,
                'Source': r.source,
                'Note': r.addedNote || '',
                'Added By': r.addedByFirstName ? `${r.addedByFirstName} ${r.addedByLastName}` : '',
                'Created At': new Date(r.createdAt).toLocaleString('th-TH'),
            }));

            exportToExcel(rows, `registrations_${eventName.replace(/\s+/g, '_')}`);
        } catch (error) {
            console.error('Export failed:', error);
            toast.error('Export failed');
        } finally {
            setIsExporting(false);
        }
    };

    const fetchRegistrations = async () => {
        const requestId = ++registrationRequestRef.current;
        setIsLoading(true);
        try {
            const token = getBackofficeToken();
            const params: any = { page, limit };
            if (statusFilter) params.status = statusFilter;
            if (searchTerm) params.search = searchTerm;
            if (sourceFilter) params.source = sourceFilter;
            if (eventFilter) params.eventId = eventFilter;
            if (promoCodeFilter) params.promoCodeId = promoCodeFilter;
            if (grantSession) params.sessionId = grantSession.id;

            const res = await api.registrations.list(token, new URLSearchParams(params).toString());
            if (requestId !== registrationRequestRef.current) return;
            setRegistrations(res.registrations as unknown as Registration[]);
            setTotalCount(res.pagination.total);
            setTotalPages(res.pagination.totalPages);
        } catch (error) {
            if (requestId === registrationRequestRef.current) {
                console.error('Failed to fetch registrations:', error);
            }
        } finally {
            if (requestId === registrationRequestRef.current) setIsLoading(false);
        }
    };

    const selectRow = (registration: Registration, checked: boolean) => {
        if (!registration.grantEligible) return;
        if (checked && !selectedRegistrations.has(registration.id) && selectedRegistrations.size >= SESSION_GRANT_SELECTION_LIMIT) {
            toast.error(`เลือกได้สูงสุด ${SESSION_GRANT_SELECTION_LIMIT} Registration ต่อรายการ`);
            return;
        }
        setPendingGrantOperation(null);
        setSelectedRegistrations((current) => updateSelection(current, checked
            ? {
                type: 'add',
                rows: [{
                    id: registration.id,
                    regCode: registration.regCode,
                    name: `${registration.firstName} ${registration.lastName}`.trim(),
                    email: registration.email,
                }],
            }
            : { type: 'remove', ids: [registration.id] }));
    };

    const toggleVisible = (checked: boolean) => {
        if (!checked) {
            setPendingGrantOperation(null);
            setSelectedRegistrations((current) => updateSelection(current, {
                type: 'remove',
                ids: visibleEligibleRegistrations.map((registration) => registration.id),
            }));
            return;
        }
        const remaining = SESSION_GRANT_SELECTION_LIMIT - selectedRegistrations.size;
        const newVisibleRows = visibleEligibleRegistrations.filter(
            (registration) => !selectedRegistrations.has(registration.id),
        );
        if (newVisibleRows.length > remaining) {
            toast.error(`เลือกได้สูงสุด ${SESSION_GRANT_SELECTION_LIMIT} Registration ต่อรายการ`);
            return;
        }
        setPendingGrantOperation(null);
        setSelectedRegistrations((current) => updateSelection(current, {
            type: 'add',
            rows: newVisibleRows.map((registration) => ({
                id: registration.id,
                regCode: registration.regCode,
                name: `${registration.firstName} ${registration.lastName}`.trim(),
                email: registration.email,
            })),
        }));
    };

    const chooseGrantSession = (session: GrantSessionChoiceDto) => {
        if (grantSession && grantSession.id !== session.id && selectedCount > 0) {
            const confirmed = window.confirm('เปลี่ยน Session จะล้างรายการ Registration ที่เลือกไว้ ต้องการดำเนินการต่อหรือไม่?');
            if (!confirmed) return;
            setSelectedRegistrations(new Map());
        }
        setGrantSession(session);
        setPendingGrantOperation(null);
        setPage(1);
    };

    const submitGrant = async () => {
        if (!grantSession || selectedCount === 0 || isGrantSubmitting) return;
        if (selectedCount > SESSION_GRANT_SELECTION_LIMIT) {
            toast.error(`เลือกได้สูงสุด ${SESSION_GRANT_SELECTION_LIMIT} Registration ต่อรายการ`);
            return;
        }
        if (grantSession.adminGrantRequiresConfirmation) {
            const deadline = grantSession.effectiveDeadline
                ? `\nตอบรับได้ก่อน ${bangkokDateTime(grantSession.effectiveDeadline)} เวลาไทย`
                : '';
            const confirmed = window.confirm(
                `Session นี้ต้องให้ผู้เข้าร่วมตอบรับก่อนจึงจะมีสิทธิ์เข้า Session\nจะสร้างคำเชิญสำหรับ ${selectedCount} Registration${deadline}\n\nต้องการดำเนินการต่อหรือไม่?`,
            );
            if (!confirmed) return;
        }
        const operation = pendingGrantOperation || {
            key: crypto.randomUUID(),
            sessionId: grantSession.id,
            registrationIds: [...selectedRegistrations.keys()].sort((a, b) => a - b),
        };
        if (!pendingGrantOperation) setPendingGrantOperation(operation);
        setIsGrantSubmitting(true);
        try {
            const result = await api.sessionGrants.create(getBackofficeToken(), operation.key, {
                sessionId: operation.sessionId,
                registrationIds: operation.registrationIds,
            });
            setGrantBatchId(result.batchId);
            const next = new URLSearchParams(searchParams.toString());
            next.set('grantBatchId', result.batchId);
            router.replace(`/registrations?${next.toString()}`);
            setSelectedRegistrations(new Map());
            setPendingGrantOperation(null);
            toast.success(`เพิ่มสิทธิ์ ${result.addedCount} · สร้างคำเชิญ ${result.invitedCount} · ข้าม ${result.skippedCount}`);
            await fetchRegistrations();
        } catch (error) {
            console.error('Grant session failed:', error);
            if (error instanceof ApiError && error.code === 'SESSION_CAPACITY_EXCEEDED' && error.capacity) {
                setGrantSession((current) => current ? {
                    ...current,
                    enrollmentCount: error.capacity!.currentEnrollmentCount,
                    reservedCount: error.capacity!.reservedCount,
                    occupiedCount: error.capacity!.occupiedCount,
                    seatsRemaining: error.capacity!.seatsRemaining,
                } : current);
                toast.error(`ที่นั่งไม่พอ เหลือ ${error.capacity.seatsRemaining} ที่ · รายการที่เลือกยังคงอยู่ กรุณาปรับรายการแล้วส่งใหม่`);
            } else {
                toast.error(error instanceof Error ? error.message : 'เพิ่มสิทธิ์ Session ไม่สำเร็จ');
            }
        } finally {
            setIsGrantSubmitting(false);
        }
    };

    const refreshGrantEntitlements = useCallback(() => {
        void fetchRegistrations();
    // fetchRegistrations intentionally follows the active page/filter/session state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, limit, debouncedSearchTerm, statusFilter, sourceFilter, eventFilter, promoCodeFilter, grantSession?.id]);

    return (
        <AdminLayout title="Registrations">
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="card py-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
                            <IconUsers size={24} stroke={1.5} />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-zinc-800">{isLoading ? '-' : totalCount}</p>
                            <p className="text-sm text-zinc-400">Total Registrations</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters & Actions */}
            <div className="card mb-6">
                <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
                    <div className="flex flex-col md:flex-row gap-4 flex-1">
                        <select
                            value={eventFilter}
                            onChange={(e) => {
                                const nextEventId = e.target.value;
                                if (nextEventId !== eventFilter && selectedCount > 0) {
                                    const confirmed = window.confirm('เปลี่ยน Event จะล้างรายการ Registration ที่เลือกไว้ ต้องการดำเนินการต่อหรือไม่?');
                                    if (!confirmed) return;
                                    setSelectedRegistrations(new Map());
                                    setGrantSession(null);
                                    setPendingGrantOperation(null);
                                }
                                setEventFilter(nextEventId);
                                setPromoCodeFilter('');
                                setPromoCodeOptions([]);
                                setIsLoadingPromoCodes(!!nextEventId);
                                setEventSelected(!!nextEventId);
                                setPage(1);
                            }}
                            className="input-field w-auto"
                        >
                            <option value="">-- เลือก Event --</option>
                            {eventOptions.map((e) => (
                                <option key={e.id} value={e.id}>{e.name}</option>
                            ))}
                        </select>

                        <select
                            value={promoCodeFilter}
                            onChange={(e) => { setPromoCodeFilter(e.target.value); setPage(1); }}
                            disabled={!eventFilter || isLoadingPromoCodes || promoCodeOptions.length === 0}
                            className="input-field w-auto disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <option value="">
                                {!eventFilter ? 'Select event first' :
                                    isLoadingPromoCodes ? 'Loading Promo Codes...' :
                                        promoCodeOptions.length === 0 ? 'No Promo Codes' : 'All Promo Codes'}
                            </option>
                            {promoCodeOptions.map((promoCode) => (
                                <option key={promoCode.id} value={promoCode.id}>{promoCode.code}</option>
                            ))}
                        </select>

                        <div className="relative flex-1 max-w-md">
                            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
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
                            <option value="quick">Quick</option>
                        </select>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {isAdmin && grantFeatureEnabled && eventSelected && (
                            <button
                                type="button"
                                onClick={() => setGrantDialogOpen(true)}
                                className="btn-primary flex items-center gap-2"
                            >
                                <IconUserPlus size={18} />
                                {grantSession ? `Session: ${grantSession.sessionName}` : 'เพิ่มสิทธิ์ Session'}
                            </button>
                        )}
                        <button
                            onClick={handleExport}
                            disabled={!eventSelected || isExporting}
                            className="btn-secondary flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {isExporting ? <IconLoader2 size={18} className="animate-spin" /> : <IconDownload size={18} />}
                            Export Excel
                        </button>
                        {!isOrganizer && (
                            <Link
                                href="/registrations/add"
                                className="btn-primary flex items-center gap-2"
                            >
                                <IconUserPlus size={18} /> Add Registration
                            </Link>
                        )}
                    </div>
                </div>
            </div>

            {isAdmin && grantFeatureEnabled && grantSession && (
                <div className="card mb-6 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <p className="font-semibold text-zinc-900">เพิ่มสิทธิ์: {grantSession.sessionName}</p>
                            <p className="text-sm text-zinc-500">เลือกแล้ว {selectedCount} / {SESSION_GRANT_SELECTION_LIMIT} Registration · การค้นหา/กรอง/เปลี่ยนหน้าจะไม่ล้างรายการที่เลือก</p>
                            <p className="mt-1 text-sm text-zinc-500" aria-live="polite">
                                {grantSession.adminGrantRequiresConfirmation
                                    ? `มีสิทธิ์แล้ว ${grantSession.enrollmentCount} · รอตอบรับ ${grantSession.reservedCount} · รวม ${grantSession.occupiedCount}${grantSession.maxCapacity !== null ? `/${grantSession.maxCapacity}` : ''}${grantSession.seatsRemaining !== null ? ` · เหลือ ${grantSession.seatsRemaining}` : ''}`
                                    : `ผู้มีสิทธิ์ปัจจุบัน ${grantSession.enrollmentCount} · เลือกเพิ่ม ${selectedCount} · หลังยืนยันโดยประมาณ ${grantSession.enrollmentCount + selectedCount}`}
                            </p>
                            {grantSession.adminGrantRequiresConfirmation && grantSession.effectiveDeadline && (
                                <p className="mt-1 text-xs text-amber-700">ผู้รับต้องตอบรับก่อน {bangkokDateTime(grantSession.effectiveDeadline)} เวลาไทย จึงจะมีสิทธิ์เข้า Session</p>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <button type="button" className="btn-secondary" onClick={() => { setSelectedRegistrations(new Map()); setPendingGrantOperation(null); }} disabled={selectedCount === 0}>
                                ล้างรายการ
                            </button>
                            <button type="button" className="btn-primary" onClick={() => void submitGrant()} disabled={selectedCount === 0 || isGrantSubmitting}>
                                {isGrantSubmitting ? 'กำลังดำเนินการ...' : pendingGrantOperation ? 'ลองคำขอเดิมอีกครั้ง' : `ยืนยัน ${selectedCount} คน`}
                            </button>
                        </div>
                    </div>
                    {selectedCount > 0 && (
                        <div className="max-h-32 overflow-y-auto rounded-xl border border-zinc-200 bg-zinc-50/70 p-3">
                            <div className="flex flex-wrap gap-2">
                                {[...selectedRegistrations.values()].map((registration) => (
                                    <span
                                        key={registration.id}
                                        className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700 shadow-sm"
                                    >
                                        <span className="leading-5">
                                            {registration.name} ({registration.regCode})
                                        </span>
                                        <button
                                            type="button"
                                            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-red-500 transition-colors hover:bg-red-50 hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-red-200"
                                            aria-label={`เอา ${registration.regCode} ออกจากรายการ`}
                                            onClick={() => { setPendingGrantOperation(null); setSelectedRegistrations((current) => updateSelection(current, { type: 'remove', ids: [registration.id] })); }}
                                        >
                                            ×
                                        </button>
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {grantBatchId && (
                <div className="card mb-6">
                    <SessionGrantResults batchId={grantBatchId} onEntitlementsChanged={refreshGrantEntitlements} />
                </div>
            )}

            {/* Table */}
            <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
                {!eventSelected ? (
                    <div className="text-center py-16 text-zinc-400">
                        <IconUsers size={40} className="mx-auto mb-3 opacity-30" />
                        <p className="font-medium">กรุณาเลือก Event เพื่อดูข้อมูล</p>
                    </div>
                ) : isLoading ? (
                    <div className="flex justify-center py-12">
                        <IconLoader2 size={32} className="animate-spin text-emerald-600" />
                    </div>
                ) : registrations.length === 0 ? (
                    <div className="text-center py-12 text-zinc-400">
                        No registrations found.
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full table-sticky-actions">
                                <thead>
                                    <tr className="bg-zinc-50 border-b border-zinc-200">
                                        {isAdmin && grantFeatureEnabled && grantSession && (
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                                                <input
                                                    type="checkbox"
                                                    checked={allVisibleSelected}
                                                    ref={(element) => { if (element) element.indeterminate = !allVisibleSelected && someVisibleSelected; }}
                                                    onChange={(event) => toggleVisible(event.target.checked)}
                                                    aria-label="เลือก Registration ที่มีสิทธิ์ทั้งหมดในหน้าปัจจุบัน"
                                                />
                                            </th>
                                        )}
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Code</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Attendee</th>
                                        <th className="px-4 py-3 text-center text-xs font-semibold text-zinc-500 uppercase tracking-wider">Event</th>
                                        <th className="px-4 py-3 text-center text-xs font-semibold text-zinc-500 uppercase tracking-wider">Ticket</th>
                                        <th className="px-4 py-3 text-center text-xs font-semibold text-zinc-500 uppercase tracking-wider">Promo Code</th>
                                        <th className="px-4 py-3 text-center text-xs font-semibold text-zinc-500 uppercase tracking-wider">Status</th>
                                        <th className="px-4 py-3 text-center text-xs font-semibold text-zinc-500 uppercase tracking-wider">Source</th>
                                        <th className="px-4 py-3 text-center text-xs font-semibold text-zinc-500 uppercase tracking-wider w-[100px]">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {registrations.map((reg) => (
                                        <tr key={reg.id} className="hover:bg-zinc-50 transition-colors">
                                            {isAdmin && grantFeatureEnabled && grantSession && (
                                                <td className="px-4 py-4">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedRegistrations.has(reg.id)}
                                                        disabled={!reg.grantEligible}
                                                        onChange={(event) => selectRow(reg, event.target.checked)}
                                                        aria-label={`เลือก ${reg.firstName} ${reg.lastName} ${reg.regCode}`}
                                                        title={reg.grantEligible ? 'เลือกเพื่อเพิ่มสิทธิ์' : grantDisabledLabel(reg.grantDisabledReason)}
                                                    />
                                                    {!reg.grantEligible && reg.grantDisabledReason && (
                                                        <p className="mt-1 max-w-28 text-[11px] normal-case leading-tight text-red-600">
                                                            {grantDisabledLabel(reg.grantDisabledReason)}
                                                        </p>
                                                    )}
                                                </td>
                                            )}
                                            <td className="px-4 py-4">
                                                <span className="font-mono text-sm text-zinc-500 bg-zinc-100 px-2 py-1 rounded">
                                                    {reg.regCode}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4">
                                                <div>
                                                    <p className="font-medium text-zinc-900">{reg.firstName} {reg.lastName}</p>
                                                    <p className="text-sm text-zinc-400">{reg.email}</p>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 text-center">
                                                <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-100 text-zinc-600">
                                                    {reg.eventCode}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4 text-center">
                                                <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
                                                    {reg.ticketName}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4 text-center">
                                                {reg.promoCode ? (
                                                    <span
                                                        className="inline-flex max-w-[180px] break-all rounded bg-violet-50 px-2 py-1 font-mono text-xs font-medium text-violet-700"
                                                        title={reg.promoCode}
                                                    >
                                                        {reg.promoCode}
                                                    </span>
                                                ) : (
                                                    <span className="text-zinc-400">-</span>
                                                )}
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
                                                ) : reg.source === 'quick' ? (
                                                    <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-sky-50 text-sky-700 border border-sky-200">
                                                        Quick
                                                    </span>
                                                ) : reg.source === 'purchase' ? (
                                                    <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                                                        Purchase
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-zinc-50 text-zinc-400">
                                                        {reg.source || '-'}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-4 text-center">
                                                <div className="flex gap-1 justify-center items-center">
                                                    <Link
                                                        href={`/registrations/${reg.id}`}
                                                        className="p-2 hover:bg-emerald-50 rounded-lg text-zinc-400 hover:text-emerald-600 transition-colors"
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
                                pageSize={limit}
                                onPageChange={setPage}
                                onPageSizeChange={setLimit}
                                itemName="registrations"
                            />
                        </div>
                    </>
                )}
            </div>

            {isAdmin && grantFeatureEnabled && eventFilter && (
                <AddSessionDialog
                    open={grantDialogOpen}
                    eventId={Number(eventFilter)}
                    existingSessionIds={[]}
                    onClose={() => setGrantDialogOpen(false)}
                    onSessionSelected={chooseGrantSession}
                />
            )}

        </AdminLayout>
    );
}
