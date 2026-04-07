'use client';

import { useState } from 'react';
import { AdminLayout } from '@/components/layout';
import { useAuth } from '@/contexts/AuthContext';
import {
    IconReportAnalytics,
    IconDownload,
    IconCalendarEvent,
    IconUsers,
    IconCreditCard,
    IconTicket,
    IconCheck,
    IconTrendingUp,
} from '@tabler/icons-react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell,
} from 'recharts';

// Mock data
const registrationTrend = [
    { date: 'Jan 1', count: 45 },
    { date: 'Jan 5', count: 78 },
    { date: 'Jan 10', count: 125 },
    { date: 'Jan 15', count: 189 },
    { date: 'Jan 20', count: 256 },
    { date: 'Jan 25', count: 312 },
    { date: 'Jan 30', count: 378 },
    { date: 'Feb 5', count: 423 },
];

const revenueByTicket = [
    { name: 'Professional', value: 450000, count: 120 },
    { name: 'Student', value: 90000, count: 60 },
    { name: 'Guest', value: 320000, count: 80 },
    { name: 'General', value: 50000, count: 25 },
];

const dailyRevenue = [
    { date: 'Mon', amount: 45000 },
    { date: 'Tue', amount: 52000 },
    { date: 'Wed', amount: 48000 },
    { date: 'Thu', amount: 75000 },
    { date: 'Fri', amount: 95000 },
    { date: 'Sat', amount: 68000 },
    { date: 'Sun', amount: 84000 },
];

const checkInBySession = [
    { name: 'Opening Keynote', registered: 423, checkedIn: 398 },
    { name: 'Clinical Panel', registered: 178, checkedIn: 156 },
    { name: 'Workshop A', registered: 40, checkedIn: 38 },
    { name: 'Workshop B', registered: 35, checkedIn: 32 },
    { name: 'Closing', registered: 380, checkedIn: 0 },
];

const COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b'];

export default function ReportsPage() {
    const { currentEvent } = useAuth();
    const [reportType, setReportType] = useState('overview');
    const [dateRange, setDateRange] = useState('all');

    const totalRevenue = revenueByTicket.reduce((sum, t) => sum + t.value, 0);
    const totalRegistrations = revenueByTicket.reduce((sum, t) => sum + t.count, 0);
    const totalCheckedIn = checkInBySession.reduce((sum, s) => sum + s.checkedIn, 0);

    return (
        <AdminLayout title={currentEvent ? `Reports: ${currentEvent.name}` : "Reports & Analytics"}>
            {/* Header Controls */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div className="flex gap-2">
                    <button
                        onClick={() => setReportType('overview')}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${reportType === 'overview' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                        Overview
                    </button>
                    <button
                        onClick={() => setReportType('revenue')}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${reportType === 'revenue' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                        Revenue
                    </button>
                    <button
                        onClick={() => setReportType('attendance')}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${reportType === 'attendance' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                        Attendance
                    </button>
                </div>
                <div className="flex gap-2">
                    <select
                        value={dateRange}
                        onChange={(e) => setDateRange(e.target.value)}
                        className="input-field w-auto"
                    >
                        <option value="all">All Time</option>
                        <option value="week">This Week</option>
                        <option value="month">This Month</option>
                    </select>
                    <button className="btn-secondary flex items-center gap-2">
                        <IconDownload size={18} /> Export PDF
                    </button>
                </div>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="card py-4 bg-gradient-to-br from-blue-500 to-blue-600 text-white">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                            <IconCreditCard size={24} />
                        </div>
                        <div>
                            <p className="text-2xl font-bold">฿{totalRevenue.toLocaleString()}</p>
                            <p className="text-blue-100 text-sm">Total Revenue</p>
                        </div>
                    </div>
                </div>
                <div className="card py-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-green-100 text-green-600 rounded-xl flex items-center justify-center">
                            <IconUsers size={24} />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-800">{totalRegistrations}</p>
                            <p className="text-gray-500 text-sm">Total Registrations</p>
                        </div>
                    </div>
                </div>
                <div className="card py-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center">
                            <IconCheck size={24} />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-800">{totalCheckedIn}</p>
                            <p className="text-gray-500 text-sm">Checked In</p>
                        </div>
                    </div>
                </div>
                <div className="card py-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-yellow-100 text-yellow-600 rounded-xl flex items-center justify-center">
                            <IconTrendingUp size={24} />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-800">{Math.round((totalCheckedIn / totalRegistrations) * 100)}%</p>
                            <p className="text-gray-500 text-sm">Check-in Rate</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Registration Trend */}
                <div className="card">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                        <IconUsers size={20} className="text-blue-600" />
                        Registration Trend
                    </h3>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height={288}>
                            <AreaChart data={registrationTrend}>
                                <defs>
                                    <linearGradient id="colorReg" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} />
                                <Tooltip contentStyle={{ borderRadius: '0.5rem', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
                                <Area type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorReg)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Revenue by Ticket Type */}
                <div className="card">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                        <IconTicket size={20} className="text-purple-600" />
                        Revenue by Ticket Type
                    </h3>
                    <div className="flex items-center gap-6 h-72">
                        <div className="w-48 h-48">
                            <ResponsiveContainer width={192} height={192}>
                                <PieChart>
                                    <Pie
                                        data={revenueByTicket}
                                        innerRadius={50}
                                        outerRadius={80}
                                        paddingAngle={3}
                                        dataKey="value"
                                    >
                                        {revenueByTicket.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(value: number | undefined) => `฿${(value || 0).toLocaleString()}`} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="flex-1 space-y-3">
                            {revenueByTicket.map((item, index) => (
                                <div key={item.name} className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index] }} />
                                        <span className="text-sm text-gray-600">{item.name}</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="font-semibold text-gray-800">฿{item.value.toLocaleString()}</span>
                                        <span className="text-xs text-gray-400 ml-2">({item.count} tickets)</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Daily Revenue & Check-in by Session */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Daily Revenue */}
                <div className="card">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                        <IconCreditCard size={20} className="text-green-600" />
                        Daily Revenue (This Week)
                    </h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height={256}>
                            <BarChart data={dailyRevenue}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} tickFormatter={(value) => `฿${(value / 1000)}k`} />
                                <Tooltip formatter={(value: number | undefined) => `฿${(value || 0).toLocaleString()}`} />
                                <Bar dataKey="amount" fill="#10b981" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Check-in by Session */}
                <div className="card">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                        <IconCalendarEvent size={20} className="text-blue-600" />
                        Check-in by Session
                    </h3>
                    <div className="space-y-4">
                        {checkInBySession.map(session => {
                            const percent = session.registered > 0 ? Math.round((session.checkedIn / session.registered) * 100) : 0;
                            return (
                                <div key={session.name}>
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-sm text-gray-600 truncate flex-1">{session.name}</span>
                                        <span className="text-sm font-medium text-gray-800">{session.checkedIn}/{session.registered}</span>
                                    </div>
                                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all ${percent >= 90 ? 'bg-green-500' : percent >= 50 ? 'bg-blue-500' : percent > 0 ? 'bg-yellow-500' : 'bg-gray-300'}`}
                                            style={{ width: `${percent}%` }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}
