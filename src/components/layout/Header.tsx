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

    return (
        <header className="h-16 bg-white border-b border-zinc-100 px-4 md:px-8 sticky top-0 z-30 flex items-center">
            <div className="flex items-center justify-between w-full">
                {/* Left */}
                <div className="flex items-center gap-4">
                    <button onClick={onMenuClick} className="lg:hidden p-1.5 hover:bg-zinc-100 rounded-lg">
                        <IconMenu2 size={20} className="text-zinc-500" />
                    </button>
                    <h1 className="text-lg font-bold tracking-tight text-zinc-900">{title || 'Dashboard'}</h1>

                    {!isAdmin && user && user.assignedEvents.length > 0 && (
                        <div className="relative hidden md:block">
                            <button
                                onClick={() => setShowEventSelector(!showEventSelector)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                            >
                                <IconBuilding size={14} />
                                <span>{currentEvent?.code || 'Select Event'}</span>
                                <IconChevronDown size={12} />
                            </button>
                            {showEventSelector && (
                                <div className="absolute left-0 top-full mt-1.5 w-64 bg-white rounded-xl shadow-lg border border-zinc-100 py-1.5 z-50">
                                    <p className="px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Your Events</p>
                                    {user.assignedEvents.map(event => (
                                        <button
                                            key={event.id}
                                            onClick={() => { setCurrentEvent(event); setShowEventSelector(false); }}
                                            className={`w-full text-left px-3.5 py-2 text-sm hover:bg-zinc-50 transition-colors ${currentEvent?.id === event.id ? 'bg-emerald-50' : ''}`}
                                        >
                                            <p className="font-semibold text-zinc-800 text-[13px]">{event.code}</p>
                                            <p className="text-xs text-zinc-400">{event.name}</p>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {isAdmin && (
                        <span className="hidden md:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-zinc-100 text-zinc-600">
                            All Events
                        </span>
                    )}
                </div>

                {/* Right */}
                <div className="flex items-center gap-1.5">
                    <div className="relative hidden lg:block mr-2">
                        <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                        <input
                            type="text"
                            placeholder="Search..."
                            className="input-field-search w-56"
                        />
                    </div>

                    <button className="lg:hidden p-2 hover:bg-zinc-100 rounded-lg">
                        <IconSearch size={18} className="text-zinc-400" />
                    </button>

                    <button className="relative p-2 hover:bg-zinc-100 rounded-lg">
                        <IconBell size={18} className="text-zinc-400" />
                        <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                    </button>

                    {/* Profile */}
                    <div className="relative">
                        <button
                            onClick={() => setShowProfileMenu(!showProfileMenu)}
                            className="flex items-center gap-2 hover:bg-zinc-50 rounded-lg p-1.5 ml-1 transition-colors"
                        >
                            <div className="relative w-8 h-8 rounded-full overflow-hidden bg-zinc-200 shrink-0">
                                <Image
                                    src="https://ui-avatars.com/api/?name=Admin+User&background=059669&color=fff&bold=true&font-size=0.4"
                                    alt="Profile"
                                    fill
                                    className="object-cover"
                                    onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        target.style.display = 'none';
                                    }}
                                />
                            </div>
                            <div className="hidden md:flex flex-col items-start">
                                <p className="text-[13px] font-semibold text-zinc-800 leading-tight">{displayName}</p>
                                <p className="text-[10px] text-zinc-400 capitalize">{user?.role}</p>
                            </div>
                            <IconChevronDown size={14} className="text-zinc-400 hidden md:block" />
                        </button>

                        {showProfileMenu && (
                            <div className="absolute right-0 top-full mt-1.5 w-52 bg-white rounded-xl shadow-lg border border-zinc-100 py-1.5 z-50 animate-scale-in">
                                <div className="px-3.5 py-2.5 border-b border-zinc-100">
                                    <p className="font-semibold text-zinc-800 text-[13px]">{displayName}</p>
                                    <p className="text-xs text-zinc-400 mt-0.5">{user?.email}</p>
                                </div>
                                <a href="/profile" className="flex items-center gap-2 px-3.5 py-2 hover:bg-zinc-50 text-zinc-600 text-[13px]">
                                    <IconUser size={15} /> Profile
                                </a>
                                <a href="/settings" className="flex items-center gap-2 px-3.5 py-2 hover:bg-zinc-50 text-zinc-600 text-[13px]">
                                    <IconSettings size={15} /> Settings
                                </a>
                                <div className="border-t border-zinc-100 mt-1 pt-1">
                                    <button
                                        onClick={() => { logout(); window.location.href = '/login'; }}
                                        className="flex items-center gap-2 px-3.5 py-2 hover:bg-red-50 text-red-500 w-full text-left text-[13px]"
                                    >
                                        <IconLogout size={15} /> Logout
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
}
