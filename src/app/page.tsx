'use client';

import { AdminLayout } from '@/components/layout';
import {
  IconCalendarEvent,
  IconFileText,
  IconCash,
  IconCheck,
  IconQrcode,
  IconChartBar,
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
  Legend
} from 'recharts';

// Mock chart data
const registrationData = [
  { name: 'Mon', count: 120 },
  { name: 'Tue', count: 145 },
  { name: 'Wed', count: 132 },
  { name: 'Thu', count: 195 },
  { name: 'Fri', count: 245 },
  { name: 'Sat', count: 180 },
  { name: 'Sun', count: 210 },
];

const revenueData = [
  { name: 'Mon', amount: 45000 },
  { name: 'Tue', amount: 52000 },
  { name: 'Wed', amount: 48000 },
  { name: 'Thu', amount: 75000 },
  { name: 'Fri', amount: 95000 },
  { name: 'Sat', amount: 68000 },
  { name: 'Sun', amount: 84000 },
];

const ticketTypeData = [
  { name: 'Professional', value: 450 },
  { name: 'Student', value: 180 },
  { name: 'Guest', value: 320 },
  { name: 'General', value: 50 },
];

const COLORS = ['#059669', '#18181b', '#d97706', '#71717a'];

const stats = [
  { label: 'Total Events', value: '12', icon: IconCalendarEvent, change: '+2', bg: '#ecfdf5', fg: '#059669' },
  { label: 'Registrations', value: '1,234', icon: IconFileText, change: '+156', bg: '#f4f4f5', fg: '#18181b' },
  { label: 'Revenue', value: '฿890,500', icon: IconCash, change: '+฿45,200', bg: '#fffbeb', fg: '#d97706' },
  { label: 'Checked In', value: '856', icon: IconCheck, change: '69.4%', bg: '#f0fdf4', fg: '#16a34a' },
];

const recentRegistrations = [
  { id: 1, name: 'สมชาย ใจดี', email: 'somchai@example.com', event: 'ACCP 2026', status: 'confirmed', date: '2026-01-09', photo: 'https://ui-avatars.com/api/?name=Somchai+Jaidee&background=random' },
  { id: 2, name: 'สมหญิง รักสวย', email: 'somying@example.com', event: 'ACCP 2026', status: 'pending', date: '2026-01-09', photo: 'https://ui-avatars.com/api/?name=Somying+Raksuay&background=random' },
  { id: 3, name: 'John Doe', email: 'john@example.com', event: 'ACCP 2026', status: 'confirmed', date: '2026-01-08', photo: 'https://ui-avatars.com/api/?name=John+Doe&background=random' },
  { id: 4, name: 'Jane Smith', email: 'jane@example.com', event: 'Workshop A', status: 'checked_in', date: '2026-01-08', photo: 'https://ui-avatars.com/api/?name=Jane+Smith&background=random' },
  { id: 5, name: 'วิชัย มั่นคง', email: 'wichai@example.com', event: 'ACCP 2026', status: 'confirmed', date: '2026-01-07', photo: 'https://ui-avatars.com/api/?name=Wichai+Munkong&background=random' },
];

const statusColors: { [key: string]: string } = {
  confirmed: 'badge-success',
  pending: 'badge-warning',
  checked_in: 'badge-info',
  cancelled: 'badge-error',
  failed: 'badge-error',
};

export default function DashboardPage() {
  return (
    <AdminLayout title="Dashboard">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="stat-card">
              <div className="stat-icon" style={{ background: stat.bg, color: stat.fg }}>
                <Icon size={22} stroke={1.5} />
              </div>
              <div>
                <p className="stat-value">{stat.value}</p>
                <p className="stat-label">{stat.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-8">
        <div className="card lg:col-span-3">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-bold text-zinc-900">Registrations</h3>
            <span className="text-xs text-zinc-400">Last 7 days</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={registrationData}>
                <defs>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#059669" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#a1a1aa', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#a1a1aa', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e4e4e7', boxShadow: '0 4px 12px rgba(0,0,0,.08)', fontSize: '13px' }}
                  cursor={{ stroke: '#059669', strokeWidth: 1, strokeDasharray: '4 4' }}
                />
                <Area type="monotone" dataKey="count" stroke="#059669" strokeWidth={2} fillOpacity={1} fill="url(#colorCount)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-2 grid grid-rows-2 gap-4">
          <div className="card">
            <h3 className="text-sm font-bold text-zinc-900 mb-3">Revenue</h3>
            <div className="h-20">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueData}>
                  <XAxis dataKey="name" hide />
                  <Tooltip
                    cursor={{ fill: '#fafaf9' }}
                    contentStyle={{ borderRadius: '12px', border: '1px solid #e4e4e7', boxShadow: '0 4px 12px rgba(0,0,0,.08)', fontSize: '13px' }}
                  />
                  <Bar dataKey="amount" fill="#18181b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-between items-end mt-3">
              <div>
                <p className="text-xl font-extrabold text-zinc-900 tracking-tight">฿467k</p>
                <p className="text-xs text-zinc-400 mt-0.5">This week</p>
              </div>
              <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">+12.5%</span>
            </div>
          </div>

          <div className="card">
            <h3 className="text-sm font-bold text-zinc-900 mb-3">Tickets</h3>
            <div className="flex items-center gap-4">
              <div className="w-24 h-24 relative">
                <ResponsiveContainer width={96} height={96}>
                  <PieChart>
                    <Pie data={ticketTypeData} innerRadius={28} outerRadius={42} paddingAngle={4} dataKey="value">
                      {ticketTypeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-1.5">
                {ticketTypeData.map((entry, index) => (
                  <div key={entry.name} className="flex items-center justify-between text-[13px]">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: COLORS[index] }} />
                      <span className="text-zinc-500">{entry.name}</span>
                    </div>
                    <span className="font-semibold text-zinc-800">{entry.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Registrations */}
      <div className="card">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-bold text-zinc-900">Recent Registrations</h2>
          <a href="/registrations" className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition-colors">
            View all →
          </a>
        </div>
        <div className="overflow-x-auto -mx-6">
          <table className="data-table">
            <thead>
              <tr>
                <th className="pl-6">Name</th>
                <th>Email</th>
                <th>Event</th>
                <th>Status</th>
                <th className="pr-6">Date</th>
              </tr>
            </thead>
            <tbody>
              {recentRegistrations.map((reg) => (
                <tr key={reg.id}>
                  <td className="pl-6 font-semibold text-zinc-800">{reg.name}</td>
                  <td>{reg.email}</td>
                  <td>{reg.event}</td>
                  <td>
                    <span className={`badge ${statusColors[reg.status] || 'badge-info'}`}>
                      {reg.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="pr-6 text-zinc-400">{reg.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        {[
          { href: '/events/create', icon: IconCalendarEvent, label: 'Create Event', desc: 'Add a new conference event', bg: '#ecfdf5', fg: '#059669' },
          { href: '/checkin', icon: IconQrcode, label: 'Check-in', desc: 'Scan QR codes for check-in', bg: '#f4f4f5', fg: '#18181b' },
          { href: '/reports', icon: IconChartBar, label: 'Reports', desc: 'Analytics and statistics', bg: '#fffbeb', fg: '#d97706' },
        ].map((action) => {
          const Icon = action.icon;
          return (
            <a key={action.href} href={action.href} className="card group hover:shadow-md transition-all hover:-translate-y-0.5">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: action.bg, color: action.fg }}>
                  <Icon size={20} stroke={1.5} />
                </div>
                <div>
                  <h3 className="font-bold text-zinc-900 text-sm">{action.label}</h3>
                  <p className="text-xs text-zinc-400 mt-0.5">{action.desc}</p>
                </div>
              </div>
            </a>
          );
        })}
      </div>
    </AdminLayout>
  );
}
