'use client';

import { useState } from 'react';
import { AdminLayout } from '@/components/layout';
import {
    IconSettings,
    IconBuildingSkyscraper,
    IconMail,
    IconPalette,
    IconBell,
    IconShield,
    IconCheck,
    IconUpload,
} from '@tabler/icons-react';
import toast from 'react-hot-toast';

export default function SettingsPage() {
    const [activeTab, setActiveTab] = useState('general');

    // General Settings
    const [generalSettings, setGeneralSettings] = useState({
        organizationName: 'ACCP Thailand',
        eventName: 'ACCP Annual Conference 2026',
        contactEmail: 'info@accp2026.org',
        supportPhone: '02-123-4567',
        timezone: 'Asia/Bangkok',
        currency: 'THB',
    });

    // Email Settings
    const [emailSettings, setEmailSettings] = useState({
        smtpHost: 'smtp.example.com',
        smtpPort: '587',
        smtpUser: 'noreply@accp2026.org',
        smtpPassword: '••••••••',
        senderName: 'ACCP 2026',
        senderEmail: 'noreply@accp2026.org',
    });

    // Appearance Settings
    const [appearanceSettings, setAppearanceSettings] = useState({
        primaryColor: '#3b82f6',
        accentColor: '#8b5cf6',
        logoUrl: '',
        faviconUrl: '',
    });

    // Notification Settings
    const [notifications, setNotifications] = useState({
        emailOnRegistration: true,
        emailOnPayment: true,
        emailOnCheckIn: false,
        adminDailyDigest: true,
        lowStockAlert: true,
    });

    const handleSave = () => {
        toast.success('Settings saved successfully!');
    };

    const tabs = [
        { id: 'general', label: 'General', icon: IconBuildingSkyscraper },
        { id: 'email', label: 'Email', icon: IconMail },
        { id: 'appearance', label: 'Appearance', icon: IconPalette },
        { id: 'notifications', label: 'Notifications', icon: IconBell },
        { id: 'security', label: 'Security', icon: IconShield },
    ];

    return (
        <AdminLayout title="Settings">
            <div className="flex flex-col lg:flex-row gap-6">
                {/* Sidebar Tabs */}
                <div className="lg:w-64 flex-shrink-0">
                    <div className="card p-2">
                        {tabs.map(tab => {
                            const Icon = tab.icon;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${activeTab === tab.id
                                            ? 'bg-blue-50 text-blue-600'
                                            : 'text-gray-600 hover:bg-gray-50'
                                        }`}
                                >
                                    <Icon size={20} />
                                    <span className="font-medium">{tab.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1">
                    {/* General Settings */}
                    {activeTab === 'general' && (
                        <div className="card">
                            <h2 className="text-lg font-semibold text-gray-800 mb-6 flex items-center gap-2">
                                <IconBuildingSkyscraper size={20} className="text-blue-600" />
                                General Settings
                            </h2>
                            <div className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Organization Name</label>
                                        <input
                                            type="text"
                                            className="input-field"
                                            value={generalSettings.organizationName}
                                            onChange={(e) => setGeneralSettings({ ...generalSettings, organizationName: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Event Name</label>
                                        <input
                                            type="text"
                                            className="input-field"
                                            value={generalSettings.eventName}
                                            onChange={(e) => setGeneralSettings({ ...generalSettings, eventName: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Contact Email</label>
                                        <input
                                            type="email"
                                            className="input-field"
                                            value={generalSettings.contactEmail}
                                            onChange={(e) => setGeneralSettings({ ...generalSettings, contactEmail: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Support Phone</label>
                                        <input
                                            type="tel"
                                            className="input-field"
                                            value={generalSettings.supportPhone}
                                            onChange={(e) => setGeneralSettings({ ...generalSettings, supportPhone: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
                                        <select
                                            className="input-field"
                                            value={generalSettings.timezone}
                                            onChange={(e) => setGeneralSettings({ ...generalSettings, timezone: e.target.value })}
                                        >
                                            <option value="Asia/Bangkok">Asia/Bangkok (GMT+7)</option>
                                            <option value="Asia/Singapore">Asia/Singapore (GMT+8)</option>
                                            <option value="UTC">UTC (GMT+0)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                                        <select
                                            className="input-field"
                                            value={generalSettings.currency}
                                            onChange={(e) => setGeneralSettings({ ...generalSettings, currency: e.target.value })}
                                        >
                                            <option value="THB">THB - Thai Baht</option>
                                            <option value="USD">USD - US Dollar</option>
                                            <option value="SGD">SGD - Singapore Dollar</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Email Settings */}
                    {activeTab === 'email' && (
                        <div className="card">
                            <h2 className="text-lg font-semibold text-gray-800 mb-6 flex items-center gap-2">
                                <IconMail size={20} className="text-blue-600" />
                                Email Configuration
                            </h2>
                            <div className="space-y-6">
                                <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                                    <p className="text-sm text-blue-700">
                                        Configure your SMTP server to send emails for registration confirmations, payment receipts, and notifications.
                                    </p>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">SMTP Host</label>
                                        <input
                                            type="text"
                                            className="input-field"
                                            value={emailSettings.smtpHost}
                                            onChange={(e) => setEmailSettings({ ...emailSettings, smtpHost: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">SMTP Port</label>
                                        <input
                                            type="text"
                                            className="input-field"
                                            value={emailSettings.smtpPort}
                                            onChange={(e) => setEmailSettings({ ...emailSettings, smtpPort: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">SMTP Username</label>
                                        <input
                                            type="text"
                                            className="input-field"
                                            value={emailSettings.smtpUser}
                                            onChange={(e) => setEmailSettings({ ...emailSettings, smtpUser: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">SMTP Password</label>
                                        <input
                                            type="password"
                                            className="input-field"
                                            value={emailSettings.smtpPassword}
                                            onChange={(e) => setEmailSettings({ ...emailSettings, smtpPassword: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <hr />
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Sender Name</label>
                                        <input
                                            type="text"
                                            className="input-field"
                                            value={emailSettings.senderName}
                                            onChange={(e) => setEmailSettings({ ...emailSettings, senderName: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Sender Email</label>
                                        <input
                                            type="email"
                                            className="input-field"
                                            value={emailSettings.senderEmail}
                                            onChange={(e) => setEmailSettings({ ...emailSettings, senderEmail: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <button className="btn-secondary">Test Email Configuration</button>
                            </div>
                        </div>
                    )}

                    {/* Appearance Settings */}
                    {activeTab === 'appearance' && (
                        <div className="card">
                            <h2 className="text-lg font-semibold text-gray-800 mb-6 flex items-center gap-2">
                                <IconPalette size={20} className="text-blue-600" />
                                Appearance
                            </h2>
                            <div className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Primary Color</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="color"
                                                className="w-12 h-10 rounded border cursor-pointer"
                                                value={appearanceSettings.primaryColor}
                                                onChange={(e) => setAppearanceSettings({ ...appearanceSettings, primaryColor: e.target.value })}
                                            />
                                            <input
                                                type="text"
                                                className="input-field flex-1"
                                                value={appearanceSettings.primaryColor}
                                                onChange={(e) => setAppearanceSettings({ ...appearanceSettings, primaryColor: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Accent Color</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="color"
                                                className="w-12 h-10 rounded border cursor-pointer"
                                                value={appearanceSettings.accentColor}
                                                onChange={(e) => setAppearanceSettings({ ...appearanceSettings, accentColor: e.target.value })}
                                            />
                                            <input
                                                type="text"
                                                className="input-field flex-1"
                                                value={appearanceSettings.accentColor}
                                                onChange={(e) => setAppearanceSettings({ ...appearanceSettings, accentColor: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Logo</label>
                                    <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center hover:border-blue-400 transition-colors cursor-pointer">
                                        <IconUpload size={32} className="mx-auto text-gray-400 mb-2" />
                                        <p className="text-sm text-gray-500">Click to upload or drag and drop</p>
                                        <p className="text-xs text-gray-400 mt-1">PNG, JPG up to 2MB</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Notification Settings */}
                    {activeTab === 'notifications' && (
                        <div className="card">
                            <h2 className="text-lg font-semibold text-gray-800 mb-6 flex items-center gap-2">
                                <IconBell size={20} className="text-blue-600" />
                                Notification Preferences
                            </h2>
                            <div className="space-y-4">
                                {[
                                    { key: 'emailOnRegistration', label: 'Send confirmation email on registration', description: 'Attendees will receive a confirmation email immediately after registering.' },
                                    { key: 'emailOnPayment', label: 'Send receipt on successful payment', description: 'Payment receipts will be sent to the attendee email.' },
                                    { key: 'emailOnCheckIn', label: 'Send notification on check-in', description: 'Attendees will be notified when they check in at the venue.' },
                                    { key: 'adminDailyDigest', label: 'Admin daily digest', description: 'Admins will receive a daily summary email with registration stats.' },
                                    { key: 'lowStockAlert', label: 'Low ticket stock alert', description: 'Get notified when ticket availability falls below 10%.' },
                                ].map(item => (
                                    <div key={item.key} className="flex items-start justify-between p-4 bg-gray-50 rounded-lg">
                                        <div>
                                            <p className="font-medium text-gray-800">{item.label}</p>
                                            <p className="text-sm text-gray-500">{item.description}</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                className="sr-only peer"
                                                checked={(notifications as Record<string, boolean>)[item.key]}
                                                onChange={(e) => setNotifications({ ...notifications, [item.key]: e.target.checked })}
                                            />
                                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-100 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                        </label>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Security Settings */}
                    {activeTab === 'security' && (
                        <div className="card">
                            <h2 className="text-lg font-semibold text-gray-800 mb-6 flex items-center gap-2">
                                <IconShield size={20} className="text-blue-600" />
                                Security Settings
                            </h2>
                            <div className="space-y-6">
                                <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-100">
                                    <p className="text-sm text-yellow-700">
                                        ⚠️ Be careful when changing security settings. Incorrect configuration may lock you out of the system.
                                    </p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Session Timeout (minutes)</label>
                                    <input type="number" className="input-field w-32" defaultValue={30} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Max Login Attempts</label>
                                    <input type="number" className="input-field w-32" defaultValue={5} />
                                </div>
                                <div className="flex items-center gap-3">
                                    <input type="checkbox" id="2fa" className="w-4 h-4 text-blue-600 rounded" />
                                    <label htmlFor="2fa" className="text-sm text-gray-700">Require 2FA for admin accounts</label>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Save Button */}
                    <div className="mt-6 flex justify-end">
                        <button onClick={handleSave} className="btn-primary flex items-center gap-2">
                            <IconCheck size={18} /> Save Changes
                        </button>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}
