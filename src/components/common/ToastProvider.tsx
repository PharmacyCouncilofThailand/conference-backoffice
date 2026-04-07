'use client';

import { Toaster } from 'react-hot-toast';

export function ToastProvider() {
    return (
        <Toaster 
            position="top-right"
            toastOptions={{
                duration: 4000,
                style: {
                    background: '#1f2937',
                    color: '#fff',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    fontSize: '14px',
                },
                success: {
                    style: { background: '#059669' },
                    iconTheme: {
                        primary: '#fff',
                        secondary: '#059669',
                    },
                },
                error: {
                    style: { background: '#dc2626' },
                    iconTheme: {
                        primary: '#fff',
                        secondary: '#dc2626',
                    },
                },
            }}
        />
    );
}
