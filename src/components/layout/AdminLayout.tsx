'use client';

import { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

interface AdminLayoutProps {
    children: React.ReactNode;
    title?: string;
}

export function AdminLayout({ children, title }: AdminLayoutProps) {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-zinc-900/40 backdrop-blur-sm z-40 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}
            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
            <div className="lg:ml-64">
                <Header title={title} onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
                <main className="p-5 md:p-8 lg:p-10 max-w-[1600px]">
                    {children}
                </main>
            </div>
        </div>
    );
}
