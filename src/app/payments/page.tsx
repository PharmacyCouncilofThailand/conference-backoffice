'use client';

import { useState } from 'react';
import { AdminLayout } from '@/components/layout';
import {
    IconCreditCard,
    IconSearch,
    IconFilter,
    IconDownload,
    IconEye,
    IconCheck,
    IconX,
    IconRefresh,
    IconClock
} from '@tabler/icons-react';
import { useAuth } from '@/contexts/AuthContext';

// Mock payment data
const mockPayments = [
    {
        id: 'PAY-001',
        eventId: 1,
        user: 'Somchai Jaidee',
        email: 'somchai@example.com',
        amount: 3500,
        currency: 'THB',
        status: 'completed',
        method: 'Credit Card',
        date: '2026-01-15 10:30',
        items: ['Early Bird - Member'],
    },
    {
        id: 'PAY-002',
        eventId: 1,
        user: 'Jane Doe',
        email: 'jane@example.com',
        amount: 5000,
        currency: 'THB',
        status: 'pending',
        method: 'Bank Transfer',
        date: '2026-01-15 11:45',
        items: ['Regular - Public'],
    },
    {
        id: 'PAY-003',
        eventId: 2,
        user: 'Dr. Smith',
        email: 'smith@hospital.com',
        amount: 3000,
        currency: 'THB',
        status: 'completed',
        method: 'QR PromptPay',
        date: '2026-01-16 09:15',
        items: ['MIS Registration'],
    },
    {
        id: 'PAY-004',
        eventId: 1,
        user: 'Student A',
        email: 'student@uni.ac.th',
        amount: 1500,
        currency: 'THB',
        status: 'failed',
        method: 'Credit Card',
        date: '2026-01-16 14:20',
        items: ['Student'],
    },
    {
        id: 'PAY-005',
        eventId: 1,
        user: 'Vip Guest',
        email: 'vip@company.com',
        amount: 0,
        currency: 'THB',
        status: 'completed',
        method: 'Free (Invite)',
        date: '2026-01-17 08:00',
        items: ['VIP Access'],
    },
];

const statusColors: { [key: string]: string } = {
    completed: 'bg-green-100 text-green-700',
    pending: 'bg-yellow-100 text-yellow-700',
    failed: 'bg-red-100 text-red-700',
    refunded: 'bg-gray-100 text-gray-700',
};

const statusIcons: { [key: string]: any } = {
    completed: IconCheck,
    pending: IconClock,
    failed: IconX,
    refunded: IconRefresh,
};

export default function PaymentsPage() {
    const { isAdmin, user } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [dateRange, setDateRange] = useState('all');

    // Filter payments based on permissions and search
    const filteredPayments = mockPayments.filter(payment => {
        // 1. Permission Check
        if (!isAdmin && !user?.assignedEvents.some(e => e.id === payment.eventId)) {
            return false;
        }

        // 2. Search
        const matchesSearch =
            payment.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
            payment.user.toLowerCase().includes(searchTerm.toLowerCase()) ||
            payment.email.toLowerCase().includes(searchTerm.toLowerCase());

        // 3. Status Filter
        const matchesStatus = !statusFilter || payment.status === statusFilter;

        return matchesSearch && matchesStatus;
    });

    const stats = {
        total: filteredPayments.reduce((sum, p) => sum + p.amount, 0),
        count: filteredPayments.length,
        success: filteredPayments.filter(p => p.status === 'completed').length,
        pending: filteredPayments.filter(p => p.status === 'pending').length,
    };

    return (
        <AdminLayout title="Payment Management">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="card py-4 bg-gradient-to-br from-blue-500 to-blue-600 text-white">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                            <IconCreditCard size={24} />
                        </div>
                        <div>
                            <p className="text-2xl font-bold">฿{stats.total.toLocaleString()}</p>
                            <p className="text-blue-100 text-sm">Total Revenue</p>
                        </div>
                    </div>
                </div>
                <div className="card py-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-green-100 text-green-600 rounded-xl flex items-center justify-center">
                            <IconCheck size={24} />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-800">{stats.success}</p>
                            <p className="text-gray-500 text-sm">Successful Payments</p>
                        </div>
                    </div>
                </div>
                <div className="card py-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-yellow-100 text-yellow-600 rounded-xl flex items-center justify-center">
                            <IconClock size={24} />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-800">{stats.pending}</p>
                            <p className="text-gray-500 text-sm">Pending Verification</p>
                        </div>
                    </div>
                </div>
                <div className="card py-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gray-100 text-gray-600 rounded-xl flex items-center justify-center">
                            <IconFilter size={24} />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-800">{filteredPayments.length}</p>
                            <p className="text-gray-500 text-sm">Total Transactions</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="card">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
                    <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                        <IconCreditCard size={20} className="text-blue-600" />
                        Transactions
                    </h2>
                    <div className="flex gap-2">
                        <button className="btn-secondary flex items-center gap-2">
                            <IconDownload size={18} /> Export CSV
                        </button>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex flex-col md:flex-row gap-4 mb-6 bg-gray-50 p-4 rounded-xl border border-gray-100">
                    <div className="relative flex-1">
                        <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search transaction ID, name, email..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="input-field-search bg-white"
                        />
                    </div>

                    <div className="flex gap-4">
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="input-field w-40 bg-white"
                        >
                            <option value="">All Status</option>
                            <option value="completed">Completed</option>
                            <option value="pending">Pending</option>
                            <option value="failed">Failed</option>
                            <option value="refunded">Refunded</option>
                        </select>

                        <select
                            value={dateRange}
                            onChange={(e) => setDateRange(e.target.value)}
                            className="input-field w-40 bg-white"
                        >
                            <option value="all">All Time</option>
                            <option value="today">Today</option>
                            <option value="week">This Week</option>
                            <option value="month">This Month</option>
                        </select>
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-200">
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Transaction ID</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">User</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Items</th>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Amount</th>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Date</th>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider w-[80px]">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredPayments.map((payment) => {
                                const StatusIcon = statusIcons[payment.status] || IconCreditCard;
                                return (
                                    <tr key={payment.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-4 py-4">
                                            <span className="font-mono text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                                {payment.id}
                                            </span>
                                            <div className="text-xs text-gray-400 mt-1">{payment.method}</div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="font-medium text-gray-900">{payment.user}</div>
                                            <div className="text-sm text-gray-500">{payment.email}</div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="text-sm text-gray-600">
                                                {payment.items.join(', ')}
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            <div className="font-bold text-gray-900">
                                                ฿{payment.amount.toLocaleString()}
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[payment.status]}`}>
                                                <StatusIcon size={14} />
                                                <span className="capitalize">{payment.status}</span>
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 text-center text-sm text-gray-600">
                                            {payment.date}
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            <div className="flex justify-center">
                                                <button className="p-2 hover:bg-blue-50 text-gray-500 hover:text-blue-600 rounded-lg transition-colors" title="View Details">
                                                    <IconEye size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}

                            {filteredPayments.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="text-center py-8 text-gray-500">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                                                <IconSearch size={24} className="text-gray-400" />
                                            </div>
                                            <p>No transactions found matching your search.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </AdminLayout>
    );
}
