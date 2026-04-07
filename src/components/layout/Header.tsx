'use client';

import { useState } from 'react';
import Image from 'next/image';
import {
    IconSearch,
    IconBell,
    IconChevronDown,
    IconUser,
    IconSettings,
    IconLogout,
    IconMenu2,
    IconBuilding,
} from '@tabler/icons-react';
import { useAuth } from '@/contexts/AuthContext';

interface HeaderProps {
    title?: string;
    onMenuClick?: () => void;
}

export function Header({ title, onMenuClick }: HeaderProps) {
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const [showEventSelector, setShowEventSelector] = useState(false);

    const { user, isAdmin, currentEvent, setCurrentEvent, logout } = useAuth();

    const displayName = user ? `${user.firstName} ${user.lastName}` : '';

    const roleColors: { [key: string]: string } = {
        admin: 'bg-red-100 text-red-800',
        organizer: 'bg-blue-100 text-blue-800',
        reviewer: 'bg-purple-100 text-purple-800',
        staff: 'bg-green-100 text-green-800',
        verifier: 'bg-orange-100 text-orange-800',
    };

    return (
        <header className="bg-white border-b border-gray-200 px-4 md:px-6 py-4 sticky top-0 z-30">
            <div className="flex items-center justify-between">
                {/* Left Side - Menu & Title */}
                <div className="flex items-center gap-4">
                    {/* Mobile Menu Button */}
                    <button
                        onClick={onMenuClick}
                        className="lg:hidden p-2 hover:bg-gray-100 rounded-lg"
                    >
                        <IconMenu2 size={24} className="text-gray-600" />
                    </button>

                    <h1 className="text-lg md:text-xl font-semibold text-gray-800">{title || 'Dashboard'}</h1>

                    {/* Event Selector for non-admin */}
                    {!isAdmin && user && user.assignedEvents.length > 0 && (
                        <div className="relative hidden md:block">
                            <button
                                onClick={() => setShowEventSelector(!showEventSelector)}
                                className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 text-sm"
                            >
                                <IconBuilding size={16} />
                                <span>{currentEvent?.code || 'Select Event'}</span>
                                <IconChevronDown size={14} />
                            </button>

                            {showEventSelector && (
                                <div className="absolute left-0 top-full mt-2 w-72 bg-white rounded-lg shadow-lg border border-gray-100 py-2 z-50">
                                    <p className="px-4 py-2 text-xs text-gray-500 font-semibold uppercase">Your Events</p>
                                    {user.assignedEvents.map(event => (
                                        <button
                                            key={event.id}
                                            onClick={() => { setCurrentEvent(event); setShowEventSelector(false); }}
                                            className={`w-full text-left px-4 py-2 hover:bg-gray-50 ${currentEvent?.id === event.id ? 'bg-blue-50' : ''}`}
                                        >
                                            <p className="font-medium text-gray-800">{event.code}</p>
                                            <p className="text-sm text-gray-500">{event.name}</p>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Admin indicator */}
                    {isAdmin && (
                        <span className="hidden md:inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-lg text-xs font-medium">
                            All Events Access
                        </span>
                    )}

                    {/* Search - Hidden on mobile */}
                    <div className="relative hidden lg:block">
                        <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search..."
                            className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none w-64 text-sm"
                        />
                    </div>
                </div>

                {/* Right Side */}
                <div className="flex items-center gap-2 md:gap-4">
                    {/* Mobile Search Button */}
                    <button className="lg:hidden p-2 hover:bg-gray-100 rounded-lg">
                        <IconSearch size={20} className="text-gray-600" />
                    </button>

                    {/* Notifications */}
                    <button className="relative p-2 hover:bg-gray-100 rounded-lg">
                        <IconBell size={20} className="text-gray-600" />
                        <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                    </button>

                    {/* Profile Dropdown */}
                    <div className="relative">
                        <button
                            onClick={() => setShowProfileMenu(!showProfileMenu)}
                            className="flex items-center gap-2 hover:bg-gray-100 rounded-lg p-2"
                        >
                            <div className="relative w-8 h-8 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
                                <Image
                                    src="https://ui-avatars.com/api/?name=Admin+User&background=0D8ABC&color=fff"
                                    alt="Profile"
                                    fill
                                    className="object-cover"
                                    onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        target.style.display = 'none';
                                        target.parentElement!.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#6b7280" class="w-full h-full p-1"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 4-6 8-6s8 2 8 6"/></svg>';
                                    }}
                                />
                            </div>
                            <div className="hidden md:flex flex-col items-start gap-0.5">
                                <p className="text-sm font-semibold text-gray-700 leading-none">{displayName}</p>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${roleColors[user?.role || 'admin']}`}>
                                    {user?.role}
                                </span>
                            </div>
                            <IconChevronDown size={16} className="text-gray-500 hidden md:block ml-1" />
                        </button>

                        {showProfileMenu && (
                            <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-100 py-2 z-50">
                                <div className="px-4 py-2 border-b border-gray-100">
                                    <p className="font-medium text-gray-800">{displayName}</p>
                                    <p className="text-sm text-gray-500">{user?.email}</p>
                                </div>

                                <a href="/profile" className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 text-gray-700">
                                    <IconUser size={16} /> Profile
                                </a>
                                <a href="/settings" className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 text-gray-700">
                                    <IconSettings size={16} /> Settings
                                </a>
                                <hr className="my-2" />
                                <button
                                    onClick={() => { logout(); window.location.href = '/login'; }}
                                    className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 text-red-600 w-full text-left"
                                >
                                    <IconLogout size={16} /> Logout
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
}
