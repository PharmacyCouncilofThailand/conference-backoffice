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

const COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b'];

// Mock data for dashboard
const stats = [
  { label: 'Total Events', value: '12', icon: IconCalendarEvent, change: '+2', color: 'bg-blue-500' },
  { label: 'Registrations', value: '1,234', icon: IconFileText, change: '+156', color: 'bg-green-500' },
  { label: 'Revenue', value: '฿890,500', icon: IconCash, change: '+฿45,200', color: 'bg-purple-500' },
  { label: 'Checked In', value: '856', icon: IconCheck, change: '69.4%', color: 'bg-orange-500' },
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
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="card flex items-center gap-4">
              <div className={`w-14 h-14 ${stat.color} rounded-xl flex items-center justify-center text-white`}>
                <Icon size={28} stroke={1.5} />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-800">{stat.value}</p>
                <p className="text-sm text-gray-500">{stat.label}</p>
                <p className="text-xs text-green-600 font-medium">{stat.change}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Registration Trend */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Registration Trend (Last 7 Days)</h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={registrationData}>
                <defs>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6b7280' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280' }} />
                <Tooltip
                  contentStyle={{ borderRadius: '0.5rem', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                  cursor={{ stroke: '#3b82f6', strokeWidth: 1 }}
                />
                <Area type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorCount)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Revenue & Distribution */}
        <div className="grid grid-rows-2 gap-6">
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Revenue Overview</h3>
            <div className="h-32 w-full">
              <ResponsiveContainer width="100%" height={128}>
                <BarChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="name" hide />
                  <Tooltip
                    cursor={{ fill: '#f3f4f6' }}
                    contentStyle={{ borderRadius: '0.5rem', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                  />
                  <Bar dataKey="amount" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-between items-end mt-2">
              <div>
                <p className="text-2xl font-bold text-gray-800">฿467,000</p>
                <p className="text-sm text-gray-500">This Week</p>
              </div>
              <div className="text-right">
                <p className="text-green-600 font-medium text-sm">+12.5%</p>
                <p className="text-xs text-gray-400">vs last week</p>
              </div>
            </div>
          </div>

          <div className="card flex flex-col justify-center">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold text-gray-800">Ticket Distribution</h3>
            </div>
            <div className="flex items-center gap-4 h-full">
              <div className="w-32 h-32 relative">
                <ResponsiveContainer width={128} height={128}>
                  <PieChart>
                    <Pie
                      data={ticketTypeData}
                      innerRadius={35}
                      outerRadius={55}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {ticketTypeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span className="text-xs text-gray-400 font-medium">Types</span>
                </div>
              </div>
              <div className="flex-1 space-y-2">
                {ticketTypeData.map((entry, index) => (
                  <div key={entry.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index] }} />
                      <span className="text-gray-600">{entry.name}</span>
                    </div>
                    <span className="font-medium text-gray-800">{entry.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Registrations */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-800">Recent Registrations</h2>
          <a href="/registrations" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
            View All →
          </a>
        </div>

        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Event</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {recentRegistrations.map((reg) => (
                <tr key={reg.id}>
                  <td className="font-medium text-gray-800">{reg.name}</td>
                  <td className="text-gray-600">{reg.email}</td>
                  <td className="text-gray-600">{reg.event}</td>
                  <td>
                    <span className={`badge ${statusColors[reg.status] || 'badge-info'}`}>
                      {reg.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="text-gray-500">{reg.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
        <a href="/events/create" className="card hover:shadow-md transition-shadow cursor-pointer group">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 group-hover:bg-blue-500 group-hover:text-white transition-colors">
              <IconCalendarEvent size={24} stroke={1.5} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-800">Create Event</h3>
              <p className="text-sm text-gray-500">Add a new conference event</p>
            </div>
          </div>
        </a>

        <a href="/checkin" className="card hover:shadow-md transition-shadow cursor-pointer group">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center text-green-600 group-hover:bg-green-500 group-hover:text-white transition-colors">
              <IconQrcode size={24} stroke={1.5} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-800">Check-in Scanner</h3>
              <p className="text-sm text-gray-500">Scan QR codes for check-in</p>
            </div>
          </div>
        </a>

        <a href="/reports" className="card hover:shadow-md transition-shadow cursor-pointer group">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center text-purple-600 group-hover:bg-purple-500 group-hover:text-white transition-colors">
              <IconChartBar size={24} stroke={1.5} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-800">View Reports</h3>
              <p className="text-sm text-gray-500">Analytics and statistics</p>
            </div>
          </div>
        </a>
      </div>
    </AdminLayout>
  );
}
