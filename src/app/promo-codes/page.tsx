'use client';

import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/layout';
import { api } from '@/lib/api';
import {
    IconDiscount,
    IconPlus,
    IconPencil,
    IconTrash,
    IconSearch,
    IconCheck,
    IconX,
    IconCopy,
    IconCalendarEvent,
    IconPercentage,
    IconLoader2,
} from '@tabler/icons-react';
import toast from 'react-hot-toast';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { Pagination } from "@/components/common";

const statusColors: { [key: string]: string } = {
    active: 'badge-success',
    expired: 'badge-error',
    inactive: 'badge-warning',
};

const getBackofficeToken = () =>
    localStorage.getItem('backoffice_token') ||
    sessionStorage.getItem('backoffice_token') ||
    '';

interface PromoCodeRuleSetResponse {
    matchType: 'all' | 'any' | 'only';
    items?: { ticketTypeId: number }[];
    ticketTypeIds?: number[];
}

interface PromoCode {
    id: number;
    eventId: number | null;
    code: string;
    description: string | null;
    discountType: 'percentage' | 'fixed';
    discountValue: string;
    fixedValueThb?: string | null;
    fixedValueUsd?: string | null;
    minPurchase?: string | null;
    maxDiscount?: string | null;
    maxUses: number;
    maxUsesPerUser?: number;
    usedCount: number;
    validFrom: string | null;
    validUntil: string | null;
    isActive: boolean;
    status: string;
    eventCode?: string;
    eventName?: string;
    ruleSets?: PromoCodeRuleSetResponse[];
}

interface EventOption {
    id: number;
    code: string;
    name: string;
}

interface PromoRuleSet {
    matchType: 'all' | 'any' | 'only';
    ticketTypeIds: number[];
}

interface TicketOption {
    id: number;
    name: string;
    category: string;
    currency?: string;
    price?: string | number | null;
}

export default function PromoCodesPage() {
    const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
    const [events, setEvents] = useState<EventOption[]>([]);
    const [ticketOptions, setTicketOptions] = useState<TicketOption[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isFetchingDetails, setIsFetchingDetails] = useState(false);
    const [isLoadingTickets, setIsLoadingTickets] = useState(false);

    const [searchTerm, setSearchTerm] = useState('');
    const [eventFilter, setEventFilter] = useState<number | ''>('');
    const [statusFilter, setStatusFilter] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);

    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [selectedPromo, setSelectedPromo] = useState<PromoCode | null>(null);

    // Form state
    const [formData, setFormData] = useState({
        eventId: null as number | null,
        code: '',
        description: '',
        discountType: 'percentage',
        discountValue: 10,
        fixedValueThb: '' as number | '',
        fixedValueUsd: '' as number | '',
        minPurchase: 0,
        maxDiscount: '' as number | '',
        maxUses: 100,
        maxUsesPerUser: 1,
        validFrom: '',
        validUntil: '',
        isActive: true,
        ruleSets: [] as PromoRuleSet[],
    });

    useEffect(() => {
        fetchEvents();
    }, []);

    useEffect(() => {
        fetchPromoCodes();
    }, [page, eventFilter, statusFilter]);

    useEffect(() => {
        if (showCreateModal || showEditModal) {
            fetchTickets(formData.eventId);
        } else {
            setTicketOptions([]);
        }
    }, [formData.eventId, showCreateModal, showEditModal]);

    const fetchEvents = async () => {
        try {
            const token = getBackofficeToken();
            const res = await api.backofficeEvents.list(token, 'limit=100');
            setEvents(res.events.map((e: any) => ({
                id: e.id,
                code: e.eventCode,
                name: e.eventName
            })));
        } catch (error) {
            console.error('Failed to fetch events:', error);
        }
    };

    const fetchPromoCodes = async () => {
        setIsLoading(true);
        try {
            const token = getBackofficeToken();
            const params: any = { page, limit: 10 };
            if (eventFilter) params.eventId = eventFilter;
            if (statusFilter) params.status = statusFilter;
            if (searchTerm) params.search = searchTerm;

            const res = await api.promoCodes.list(token, new URLSearchParams(params).toString());
            setPromoCodes(res.promoCodes as unknown as PromoCode[]);
            setTotalCount(res.pagination.total);
            setTotalPages(res.pagination.totalPages);
        } catch (error) {
            console.error('Failed to fetch promo codes:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchTickets = async (eventId: number | null) => {
        setIsLoadingTickets(true);
        try {
            const token = getBackofficeToken();
            const params: any = { page: 1, limit: 100 };
            if (eventId) params.eventId = eventId;
            const res = await api.tickets.list(token, new URLSearchParams(params).toString());
            const mapped = (res.tickets || []).map((t: any) => ({
                id: t.id,
                name: t.name,
                category: t.category,
                currency: t.currency,
                price: t.price,
            }));
            setTicketOptions(mapped);
        } catch (error) {
            console.error('Failed to fetch tickets:', error);
            setTicketOptions([]);
        } finally {
            setIsLoadingTickets(false);
        }
    };

    const normalizeRuleSets = (ruleSets?: PromoCodeRuleSetResponse[]): PromoRuleSet[] => {
        if (!ruleSets || ruleSets.length === 0) return [];
        return ruleSets
            .map((rs) => ({
                matchType: rs.matchType,
                ticketTypeIds: rs.ticketTypeIds || rs.items?.map((item) => item.ticketTypeId) || [],
            }))
            .filter((rs) => rs.ticketTypeIds.length > 0);
    };

    const formatTicketLabel = (ticket: TicketOption) => {
        const priceNum = ticket.price ? Number(ticket.price) : null;
        const priceLabel = priceNum
            ? `${ticket.currency === 'USD' ? '$' : '฿'}${priceNum.toLocaleString()}`
            : '';
        return priceLabel ? `${ticket.name} (${priceLabel})` : ticket.name;
    };

    const buildPayload = () => {
        const ruleSets = formData.ruleSets.filter((rs) => rs.ticketTypeIds.length > 0);
        return {
            eventId: formData.eventId || null,
            code: formData.code,
            description: formData.description || undefined,
            discountType: formData.discountType as 'percentage' | 'fixed',
            discountValue: Number(formData.discountValue) || 0,
            fixedValueThb: formData.fixedValueThb === '' ? null : Number(formData.fixedValueThb),
            fixedValueUsd: formData.fixedValueUsd === '' ? null : Number(formData.fixedValueUsd),
            minPurchase: Number(formData.minPurchase) || 0,
            maxDiscount: formData.maxDiscount === '' ? null : Number(formData.maxDiscount),
            maxUses: Number(formData.maxUses) || 1,
            maxUsesPerUser: Number(formData.maxUsesPerUser) || 1,
            validFrom: formData.validFrom || undefined,
            validUntil: formData.validUntil || undefined,
            isActive: formData.isActive,
            ruleSets,
        };
    };

    const fetchPromoDetails = async (promoId: number, mode: 'edit' | 'duplicate') => {
        setIsFetchingDetails(true);
        try {
            const token = getBackofficeToken();
            const res = await api.promoCodes.get(token, promoId);
            const promo = res.promoCode as unknown as PromoCode;
            const ruleSets = normalizeRuleSets(promo.ruleSets);

            setFormData({
                eventId: promo.eventId ?? null,
                code: mode === 'duplicate' ? `${promo.code}-COPY` : promo.code,
                description: promo.description || '',
                discountType: promo.discountType,
                discountValue: parseFloat(promo.discountValue || '0'),
                fixedValueThb: promo.fixedValueThb ? parseFloat(promo.fixedValueThb) : '',
                fixedValueUsd: promo.fixedValueUsd ? parseFloat(promo.fixedValueUsd) : '',
                minPurchase: promo.minPurchase ? parseFloat(promo.minPurchase) : 0,
                maxDiscount: promo.maxDiscount ? parseFloat(promo.maxDiscount) : '',
                maxUses: promo.maxUses || 1,
                maxUsesPerUser: promo.maxUsesPerUser || 1,
                validFrom: promo.validFrom || '',
                validUntil: promo.validUntil || '',
                isActive: mode === 'duplicate' ? true : promo.isActive,
                ruleSets,
            });

            if (mode === 'edit') {
                setSelectedPromo(promo);
            } else {
                setSelectedPromo(null);
            }
        } catch (error: any) {
            console.error('Failed to fetch promo details:', error);
            toast.error(error.message || 'Failed to load promo details');
        } finally {
            setIsFetchingDetails(false);
        }
    };

    const addRuleSet = () => {
        setFormData((prev) => ({
            ...prev,
            ruleSets: [...prev.ruleSets, { matchType: 'all', ticketTypeIds: [] }],
        }));
    };

    const removeRuleSet = (index: number) => {
        setFormData((prev) => ({
            ...prev,
            ruleSets: prev.ruleSets.filter((_, idx) => idx !== index),
        }));
    };

    const updateRuleSetMatchType = (index: number, matchType: 'all' | 'any' | 'only') => {
        setFormData((prev) => ({
            ...prev,
            ruleSets: prev.ruleSets.map((rs, idx) =>
                idx === index ? { ...rs, matchType } : rs
            ),
        }));
    };

    const toggleRuleSetTicket = (index: number, ticketId: number) => {
        setFormData((prev) => {
            const ruleSets = [...prev.ruleSets];
            const current = ruleSets[index];
            if (!current) return prev;
            const exists = current.ticketTypeIds.includes(ticketId);
            const ticketTypeIds = exists
                ? current.ticketTypeIds.filter((id) => id !== ticketId)
                : [...current.ticketTypeIds, ticketId];
            ruleSets[index] = { ...current, ticketTypeIds };
            return { ...prev, ruleSets };
        });
    };

    const stats = {
        total: totalCount,
        active: promoCodes.filter(p => p.status === 'active').length,
        expired: promoCodes.filter(p => p.status === 'expired').length,
        totalUsed: promoCodes.reduce((sum, p) => sum + p.usedCount, 0),
    };

    const getEventName = (eventId: number | null) => {
        if (!eventId) return 'All Events';
        return events.find(e => e.id === eventId)?.code || 'Unknown';
    };

    const handleCreate = async () => {
        setIsSubmitting(true);
        try {
            const token = getBackofficeToken();
            await api.promoCodes.create(token, buildPayload());
            toast.success('Promo code created successfully!');
            setShowCreateModal(false);
            resetForm();
            fetchPromoCodes();
        } catch (error: any) {
            toast.error(error.message || 'Failed to create promo code');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEdit = async () => {
        if (!selectedPromo) return;
        setIsSubmitting(true);
        try {
            const token = getBackofficeToken();
            await api.promoCodes.update(token, selectedPromo.id, buildPayload());
            toast.success('Promo code updated successfully!');
            setShowEditModal(false);
            setSelectedPromo(null);
            fetchPromoCodes();
        } catch (error: any) {
            toast.error(error.message || 'Failed to update promo code');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!selectedPromo) return;
        setIsSubmitting(true);
        try {
            const token = getBackofficeToken();
            await api.promoCodes.delete(token, selectedPromo.id);
            toast.success('Promo code deleted successfully!');
            setShowDeleteModal(false);
            setSelectedPromo(null);
            fetchPromoCodes();
        } catch (error: any) {
            toast.error(error.message || 'Failed to delete promo code');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDuplicate = (promo: PromoCode) => {
        setShowCreateModal(true);
        fetchPromoDetails(promo.id, 'duplicate');
    };

    const resetForm = () => {
        setFormData({
            eventId: events[0]?.id || null,
            code: '',
            description: '',
            discountType: 'percentage',
            discountValue: 10,
            fixedValueThb: '',
            fixedValueUsd: '',
            minPurchase: 0,
            maxDiscount: '',
            maxUses: 100,
            maxUsesPerUser: 1,
            validFrom: '',
            validUntil: '',
            isActive: true,
            ruleSets: [],
        });
    };

    const openEditModal = (promo: PromoCode) => {
        setShowEditModal(true);
        fetchPromoDetails(promo.id, 'edit');
    };

    const generateCode = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        for (let i = 0; i < 8; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        setFormData({ ...formData, code });
    };

    const handleSearch = () => {
        setPage(1);
        fetchPromoCodes();
    };

    return (
        <AdminLayout title="Promo Codes">
            {/* Event Filter - Above Content */}
            <div className="mb-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-4 flex items-center gap-3">
                <div className="bg-blue-100 p-2 rounded-lg">
                    <IconCalendarEvent className="text-blue-600" size={20} />
                </div>
                <span className="text-sm font-medium text-gray-700">Select Event:</span>
                <select
                    value={eventFilter}
                    onChange={(e) => { setEventFilter(e.target.value ? Number(e.target.value) : ''); setPage(1); }}
                    className="input-field pr-8 min-w-[250px] font-semibold bg-white"
                >
                    <option value="">All Events</option>
                    {events.map((event) => (
                        <option key={event.id} value={event.id}>{event.name}</option>
                    ))}
                </select>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="card py-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
                            <IconDiscount size={24} stroke={1.5} />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-800">{isLoading ? '-' : stats.total}</p>
                            <p className="text-sm text-gray-500">Total Codes</p>
                        </div>
                    </div>
                </div>
                <div className="card py-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center text-green-600">
                            <IconCheck size={24} stroke={1.5} />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-green-600">{stats.active}</p>
                            <p className="text-sm text-gray-500">Active</p>
                        </div>
                    </div>
                </div>
                <div className="card py-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center text-red-600">
                            <IconX size={24} stroke={1.5} />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-red-600">{stats.expired}</p>
                            <p className="text-sm text-gray-500">Expired</p>
                        </div>
                    </div>
                </div>
                <div className="card py-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center text-purple-600">
                            <IconPercentage size={24} stroke={1.5} />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-purple-600">{stats.totalUsed}</p>
                            <p className="text-sm text-gray-500">Total Used</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Card */}
            <div className="card">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-semibold text-gray-800">
                        {eventFilter ? `Promo Codes for ${events.find(e => e.id === eventFilter)?.name || 'Event'}` : 'All Promo Codes'}
                    </h2>
                    <button
                        onClick={() => { resetForm(); setShowCreateModal(true); }}
                        className="btn-primary flex items-center gap-2"
                    >
                        <IconPlus size={18} />
                        Add Promo Code
                    </button>
                </div>

                {/* Filters */}
                <div className="flex flex-col md:flex-row gap-4 mb-6">
                    <div className="relative flex-1 max-w-md">
                        <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 z-10 pointer-events-none" size={18} />
                        <input
                            type="text"
                            placeholder="Search by code or description..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            className="input-field-search"
                        />
                    </div>

                    <select
                        value={statusFilter}
                        onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                        className="input-field w-auto"
                    >
                        <option value="">All Status</option>
                        <option value="active">Active</option>
                        <option value="expired">Expired</option>
                        <option value="inactive">Inactive</option>
                    </select>
                </div>

                {/* Table */}
                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <IconLoader2 size={32} className="animate-spin text-blue-600" />
                    </div>
                ) : promoCodes.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                        No promo codes found.
                    </div>
                ) : (
                    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-200">
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Promo Code</th>
                                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Event</th>
                                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Discount</th>
                                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Usage</th>
                                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Period</th>
                                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {promoCodes.map((promo) => {
                                    const usagePercentage = promo.maxUses ? (promo.usedCount / promo.maxUses) * 100 : 0;
                                    const fixedThb = promo.fixedValueThb ? Number(promo.fixedValueThb) : null;
                                    const fixedUsd = promo.fixedValueUsd ? Number(promo.fixedValueUsd) : null;
                                    const discountLabel = promo.discountType === 'percentage'
                                        ? `${promo.discountValue}%`
                                        : fixedThb || fixedUsd
                                            ? [
                                                fixedThb ? `฿${fixedThb.toLocaleString()}` : null,
                                                fixedUsd ? `$${fixedUsd.toLocaleString()}` : null,
                                            ].filter(Boolean).join(' / ')
                                            : `฿${parseFloat(promo.discountValue || '0').toLocaleString()}`;
                                    const discountDetails: string[] = [];
                                    if (promo.minPurchase && Number(promo.minPurchase) > 0) {
                                        discountDetails.push(`Min ${Number(promo.minPurchase).toLocaleString()}`);
                                    }
                                    if (promo.maxDiscount && Number(promo.maxDiscount) > 0) {
                                        discountDetails.push(`Max ${Number(promo.maxDiscount).toLocaleString()}`);
                                    }
                                    if (promo.maxUsesPerUser) {
                                        discountDetails.push(`Per user ${promo.maxUsesPerUser}`);
                                    }
                                    return (
                                        <tr key={promo.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-4 py-4">
                                                <p className="font-mono font-semibold text-gray-900">{promo.code}</p>
                                                <p className="text-sm text-gray-500">{promo.description || '-'}</p>
                                            </td>
                                            <td className="px-4 py-4 text-center">
                                                <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                                                    {promo.eventCode || getEventName(promo.eventId)}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4 text-center">
                                                <p className="font-semibold text-green-600">{discountLabel}</p>
                                                {discountDetails.length > 0 && (
                                                    <p className="text-xs text-gray-400 mt-1">
                                                        {discountDetails.join(' • ')}
                                                    </p>
                                                )}
                                            </td>
                                            <td className="px-4 py-4 text-center">
                                                <div className="w-20 mx-auto">
                                                    <div className="flex justify-between text-xs mb-1">
                                                        <span className="text-gray-600">{promo.usedCount}/{promo.maxUses}</span>
                                                    </div>
                                                    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full ${usagePercentage >= 100 ? 'bg-red-500' : usagePercentage >= 80 ? 'bg-yellow-500' : 'bg-green-500'}`}
                                                            style={{ width: `${Math.min(usagePercentage, 100)}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 text-center">
                                                <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[promo.status] || 'bg-gray-100 text-gray-700'}`}>
                                                    {promo.status.charAt(0).toUpperCase() + promo.status.slice(1)}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4 text-center">
                                                <p className="text-sm text-gray-600">{promo.validFrom?.split('T')[0] || '-'}</p>
                                                <p className="text-xs text-gray-400">to {promo.validUntil?.split('T')[0] || '-'}</p>
                                            </td>
                                            <td className="px-4 py-4 text-center">
                                                <div className="flex gap-1 justify-center items-center">
                                                    <button
                                                        className="p-2 hover:bg-blue-50 rounded-lg text-gray-500 hover:text-blue-600 transition-colors"
                                                        title="Duplicate"
                                                        onClick={() => handleDuplicate(promo)}
                                                    >
                                                        <IconCopy size={18} />
                                                    </button>
                                                    <button
                                                        className="p-2 hover:bg-yellow-50 rounded-lg text-gray-500 hover:text-yellow-600 transition-colors"
                                                        title="Edit"
                                                        onClick={() => openEditModal(promo)}
                                                    >
                                                        <IconPencil size={18} />
                                                    </button>
                                                    <button
                                                        className="p-2 hover:bg-red-50 rounded-lg text-gray-500 hover:text-red-600 transition-colors"
                                                        title="Delete"
                                                        onClick={() => { setSelectedPromo(promo); setShowDeleteModal(true); }}
                                                    >
                                                        <IconTrash size={18} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination */}
                <Pagination
                    currentPage={page}
                    totalPages={totalPages}
                    totalCount={totalCount}
                    onPageChange={setPage}
                    itemName="promo codes"
                    hideIfSinglePage={true}
                    showPageInfo={true}
                />
            </div>

            {/* Create/Edit Modal */}
            {(showCreateModal || showEditModal) && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-100">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-semibold flex items-center gap-2 text-gray-900">
                                    <IconDiscount size={20} /> {showCreateModal ? 'Create Promo Code' : 'Edit Promo Code'}
                                </h3>
                                <button
                                    onClick={() => { setShowCreateModal(false); setShowEditModal(false); }}
                                    className="text-gray-400 hover:text-gray-600"
                                >
                                    <IconX size={20} />
                                </button>
                            </div>
                        </div>
                        <div className="p-6">
                            {isFetchingDetails && (
                                <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
                                    <IconLoader2 size={16} className="animate-spin" /> Loading promo details...
                                </div>
                            )}
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Event</label>
                                <select
                                    className="input-field"
                                    value={formData.eventId || ''}
                                    onChange={(e) => setFormData({ ...formData, eventId: e.target.value ? Number(e.target.value) : null })}
                                >
                                    <option value="">All Events</option>
                                    {events.map((event) => (
                                        <option key={event.id} value={event.id}>{event.code} - {event.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Promo Code *</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        className="input-field font-mono flex-1"
                                        placeholder="PROMO2026"
                                        value={formData.code}
                                        onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                                    />
                                    <button
                                        type="button"
                                        onClick={generateCode}
                                        className="btn-secondary whitespace-nowrap"
                                    >
                                        Generate
                                    </button>
                                </div>
                            </div>

                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                <input
                                    type="text"
                                    className="input-field"
                                    placeholder="รายละเอียดโค้ดส่วนลด"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Discount Type *</label>
                                    <select
                                        className="input-field"
                                        value={formData.discountType}
                                        onChange={(e) => setFormData({ ...formData, discountType: e.target.value })}
                                    >
                                        <option value="percentage">Percentage (%)</option>
                                        <option value="fixed">Fixed Amount (THB/USD)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        {formData.discountType === 'percentage' ? 'Discount (%) *' : 'Default Fixed Amount *'}
                                    </label>
                                    <input
                                        type="number"
                                        className="input-field"
                                        value={formData.discountValue}
                                        onChange={(e) => setFormData({ ...formData, discountValue: Number(e.target.value) })}
                                    />
                                </div>
                            </div>

                            {formData.discountType === 'fixed' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Fixed THB</label>
                                        <input
                                            type="number"
                                            className="input-field"
                                            placeholder="฿"
                                            value={formData.fixedValueThb}
                                            onChange={(e) => setFormData({ ...formData, fixedValueThb: e.target.value === '' ? '' : Number(e.target.value) })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Fixed USD</label>
                                        <input
                                            type="number"
                                            className="input-field"
                                            placeholder="$"
                                            value={formData.fixedValueUsd}
                                            onChange={(e) => setFormData({ ...formData, fixedValueUsd: e.target.value === '' ? '' : Number(e.target.value) })}
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Min Purchase</label>
                                    <input
                                        type="number"
                                        className="input-field"
                                        value={formData.minPurchase}
                                        onChange={(e) => setFormData({ ...formData, minPurchase: Number(e.target.value) || 0 })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Max Discount</label>
                                    <input
                                        type="number"
                                        className="input-field"
                                        value={formData.maxDiscount}
                                        onChange={(e) => setFormData({ ...formData, maxDiscount: e.target.value === '' ? '' : Number(e.target.value) })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Max Uses / User</label>
                                    <input
                                        type="number"
                                        className="input-field"
                                        value={formData.maxUsesPerUser}
                                        onChange={(e) => setFormData({ ...formData, maxUsesPerUser: Number(e.target.value) || 1 })}
                                    />
                                </div>
                            </div>

                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Max Uses *</label>
                                <input
                                    type="number"
                                    className="input-field"
                                    placeholder="100"
                                    value={formData.maxUses}
                                    onChange={(e) => setFormData({ ...formData, maxUses: Number(e.target.value) || 1 })}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Valid From</label>
                                    <DatePicker
                                        selected={formData.validFrom ? new Date(formData.validFrom) : null}
                                        onChange={(date: Date | null) => setFormData({ ...formData, validFrom: date ? date.toISOString() : '' })}
                                        showTimeSelect
                                        dateFormat="d MMM yyyy, h:mm aa"
                                        className="input-field w-full"
                                        placeholderText="Select start date & time"
                                        wrapperClassName="w-full"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Valid Until</label>
                                    <DatePicker
                                        selected={formData.validUntil ? new Date(formData.validUntil) : null}
                                        onChange={(date: Date | null) => setFormData({ ...formData, validUntil: date ? date.toISOString() : '' })}
                                        showTimeSelect
                                        dateFormat="d MMM yyyy, h:mm aa"
                                        className="input-field w-full"
                                        placeholderText="Select end date & time"
                                        wrapperClassName="w-full"
                                    />
                                </div>
                            </div>

                            <div className="mb-4 border border-gray-200 rounded-lg p-4 bg-gray-50">
                                <div className="flex items-center justify-between mb-2">
                                    <div>
                                        <p className="text-sm font-semibold text-gray-800">Rule Sets (Ticket Conditions)</p>
                                        <p className="text-xs text-gray-500">ถ้าไม่ระบุ rule set โค้ดจะใช้ได้กับทุก ticket</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={addRuleSet}
                                        className="btn-secondary text-xs"
                                    >
                                        + Add Rule Set
                                    </button>
                                </div>

                                {isLoadingTickets && (
                                    <div className="flex items-center gap-2 text-sm text-gray-500">
                                        <IconLoader2 size={16} className="animate-spin" /> Loading tickets...
                                    </div>
                                )}

                                {!isLoadingTickets && ticketOptions.length === 0 && (
                                    <p className="text-sm text-gray-400">ไม่พบรายการ ticket สำหรับ event นี้</p>
                                )}

                                {formData.ruleSets.length === 0 && !isLoadingTickets && (
                                    <p className="text-sm text-gray-500 mt-2">ยังไม่มี rule set</p>
                                )}

                                <div className="mt-3 space-y-3">
                                    {formData.ruleSets.map((ruleSet, idx) => (
                                        <div key={`${ruleSet.matchType}-${idx}`} className="bg-white border border-gray-200 rounded-lg p-3">
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-semibold text-gray-500">Match Type</span>
                                                    <select
                                                        className="input-field py-1 text-sm"
                                                        value={ruleSet.matchType}
                                                        onChange={(e) => updateRuleSetMatchType(idx, e.target.value as 'all' | 'any' | 'only')}
                                                    >
                                                        <option value="all">All</option>
                                                        <option value="any">Any</option>
                                                        <option value="only">Only</option>
                                                    </select>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => removeRuleSet(idx)}
                                                    className="text-xs text-red-500 hover:text-red-600"
                                                >
                                                    Remove
                                                </button>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                {ticketOptions.map((ticket) => (
                                                    <label key={ticket.id} className="flex items-start gap-2 text-sm text-gray-700">
                                                        <input
                                                            type="checkbox"
                                                            checked={ruleSet.ticketTypeIds.includes(ticket.id)}
                                                            onChange={() => toggleRuleSetTicket(idx, ticket.id)}
                                                            className="mt-1"
                                                        />
                                                        <span>{formatTicketLabel(ticket)}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="mb-4">
                                <label className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={formData.isActive}
                                        onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                                        className="rounded"
                                    />
                                    <span className="text-sm font-medium text-gray-700">Active</span>
                                </label>
                            </div>
                        </div>
                        <div className="p-6 border-t border-gray-100 flex gap-3 justify-end">
                            <button
                                onClick={() => { setShowCreateModal(false); setShowEditModal(false); }}
                                className="btn-secondary"
                                disabled={isSubmitting || isFetchingDetails}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={showCreateModal ? handleCreate : handleEdit}
                                className="btn-primary flex items-center gap-2"
                                disabled={isSubmitting || isFetchingDetails}
                            >
                                {isSubmitting && <IconLoader2 size={18} className="animate-spin" />}
                                {showCreateModal ? 'Create Code' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Modal */}
            {showDeleteModal && selectedPromo && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full">
                        <div className="p-6 bg-red-600 rounded-t-2xl">
                            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                <IconTrash size={20} /> Delete Promo Code
                            </h3>
                        </div>
                        <div className="p-6 text-center">
                            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <IconTrash size={32} className="text-red-600" />
                            </div>
                            <p className="mb-2 text-gray-900 font-medium">Are you sure you want to delete this promo code?</p>
                            <p className="font-mono font-semibold text-gray-800 text-lg">{selectedPromo.code}</p>
                            {selectedPromo.usedCount > 0 && (
                                <p className="text-sm text-yellow-600 mt-2 bg-yellow-50 p-2 rounded">
                                    ⚠️ This code has been used {selectedPromo.usedCount} time(s)
                                </p>
                            )}
                        </div>
                        <div className="p-6 border-t border-gray-100 flex gap-3 justify-end">
                            <button
                                onClick={() => setShowDeleteModal(false)}
                                className="btn-secondary"
                                disabled={isSubmitting}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDelete}
                                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 flex items-center gap-2"
                                disabled={isSubmitting}
                            >
                                {isSubmitting && <IconLoader2 size={18} className="animate-spin" />}
                                Delete Code
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AdminLayout>
    );
}
