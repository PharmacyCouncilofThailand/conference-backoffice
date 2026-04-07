'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Scanner } from '@yudiel/react-qr-scanner';
import { AdminLayout } from '@/components/layout';
import { useAuth, type AssignedSession } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import {
    IconScan,
    IconCheck,
    IconX,
    IconAlertTriangle,
    IconRefresh,
    IconCamera,
    IconKeyboard,
    IconUser,
    IconTicket,
    IconCalendarEvent,
    IconLoader2,
    IconDoor,
    IconArrowBack,
    IconVolume,
    IconVolumeOff,
    IconArrowsExchange,
} from '@tabler/icons-react';

// ─── Types ───
type ScanResult = null | {
    status: 'success' | 'error' | 'duplicate' | 'no_access';
    code: string;
    name?: string;
    ticketType?: string;
    message: string;
    eventName?: string;
    registrationSessionId?: number;
};

interface EventOption {
    id: number;
    eventName: string;
}

interface SessionBreakdownItem {
    sessionId: number;
    sessionName: string;
    sessionType?: string;
    room?: string;
    total: number;
    checkedIn: number;
    remaining: number;
    percentage: number;
}

interface SessionInfo {
    id: number;
    sessionId: number;
    sessionName: string;
    sessionType?: string;
    ticketName: string;
    checkedInAt: string | null;
}

interface PendingRegistration {
    id: number;
    regCode: string;
    firstName: string;
    lastName: string;
    email: string;
    ticketName: string;
    eventName: string;
}

interface RecentCheckin {
    id: number;
    regCode: string;
    firstName: string;
    lastName: string;
    ticketName: string;
    sessionName?: string;
    scannedAt: string;
}

// ─── Sound helpers ───
function playSuccessSound() {
    try {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 880;
        osc.type = 'sine';
        gain.gain.value = 0.3;
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
        osc.stop(ctx.currentTime + 0.15);
    } catch {}
}

function playErrorSound() {
    try {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 200;
        osc.type = 'square';
        gain.gain.value = 0.2;
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.stop(ctx.currentTime + 0.3);
    } catch {}
}

function playDuplicateSound() {
    try {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 440;
        osc.type = 'triangle';
        gain.gain.value = 0.2;
        osc.start();
        setTimeout(() => { osc.frequency.value = 440; }, 100);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
        osc.stop(ctx.currentTime + 0.25);
    } catch {}
}

const getBackofficeToken = () =>
    localStorage.getItem('backoffice_token') ||
    sessionStorage.getItem('backoffice_token') ||
    '';

export default function CheckinPage() {
    const { user, isAdmin } = useAuth();

    // ─── Event & Session selection ───
    const [selectedEvent, setSelectedEvent] = useState<EventOption | null>(null);
    const [activeSession, setActiveSession] = useState<AssignedSession | null>(null);
    const [showSessionPicker, setShowSessionPicker] = useState(true);
    const [events, setEvents] = useState<EventOption[]>([]);
    const [eventSessions, setEventSessions] = useState<AssignedSession[]>([]);
    const [loadingEvents, setLoadingEvents] = useState(false);

    // ─── Scanner state ───
    const [scanMode, setScanMode] = useState<'camera' | 'manual'>('manual');
    const [manualCode, setManualCode] = useState('');
    const [scanResult, setScanResult] = useState<ScanResult>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [cameraSupported, setCameraSupported] = useState(true);

    // Check HTTPS / secure context on mount
    useEffect(() => {
        if (typeof window !== 'undefined' && !window.isSecureContext) {
            setCameraSupported(false);
        }
    }, []);

    // Session selection state (multi-session flow for non-assigned mode)
    const [pendingSessions, setPendingSessions] = useState<SessionInfo[] | null>(null);
    const [pendingRegistration, setPendingRegistration] = useState<PendingRegistration | null>(null);

    // QR scanner
    const lastScannedRef = useRef<string>('');

    // Data stats
    const [stats, setStats] = useState({ total: 0, checkedIn: 0, remaining: 0, percentage: 0 });
    const [sessionBreakdown, setSessionBreakdown] = useState<SessionBreakdownItem[]>([]);
    const [recentCheckins, setRecentCheckins] = useState<RecentCheckin[]>([]);

    // Input ref for auto-focus
    const manualInputRef = useRef<HTMLInputElement>(null);

    // ─── Determine assigned sessions for current user ───
    const assignedSessions = user?.assignedSessions || [];
    const hasAssignedSessions = assignedSessions.length > 0;

    // Auto-select if staff has exactly 1 session
    useEffect(() => {
        if (hasAssignedSessions && assignedSessions.length === 1) {
            setActiveSession(assignedSessions[0]);
            setShowSessionPicker(false);
        }
    }, [hasAssignedSessions, assignedSessions.length]);

    // ─── Fetch events for admin/multi-event roles ───
    useEffect(() => {
        if (isAdmin && showSessionPicker) {
            const fetchEvents = async () => {
                setLoadingEvents(true);
                try {
                    const token = getBackofficeToken();
                    const res = await api.backofficeEvents.list(token, 'limit=100');
                    setEvents((res.events || []).map((e: any) => ({ id: e.id, eventName: e.eventName })));
                } catch (error) {
                    console.error('Failed to fetch events:', error);
                } finally {
                    setLoadingEvents(false);
                }
            };
            fetchEvents();
        }
    }, [isAdmin, showSessionPicker]);

    // ─── Fetch sessions when admin selects an event ───
    useEffect(() => {
        if (selectedEvent && isAdmin) {
            const fetchSessions = async () => {
                try {
                    const token = getBackofficeToken();
                    const res = await api.backofficeEvents.getSessions(token, selectedEvent.id);
                    setEventSessions((res.sessions || []).map((s: any) => ({
                        sessionId: s.id,
                        sessionName: s.sessionName,
                        sessionType: s.sessionType,
                        room: s.room,
                        startTime: s.startTime || '',
                        endTime: s.endTime || '',
                        eventId: selectedEvent.id,
                        eventName: selectedEvent.eventName,
                    })));
                } catch (error) {
                    console.error('Failed to fetch sessions:', error);
                }
            };
            fetchSessions();
        }
    }, [selectedEvent, isAdmin]);

    // ─── Fetch stats (filtered by event/session) ───
    const fetchData = useCallback(async () => {
        try {
            const token = getBackofficeToken();

            // Build stats query
            const statsParams: string[] = [];
            if (activeSession) {
                statsParams.push(`sessionId=${activeSession.sessionId}`);
            } else if (selectedEvent) {
                statsParams.push(`eventId=${selectedEvent.id}`);
            }
            const statsQuery = statsParams.join('&');

            const statsRes: any = await api.checkins.stats(token, statsQuery);
            setStats(statsRes);
            setSessionBreakdown(statsRes.sessionBreakdown || []);

            // Fetch recent check-ins
            const listParams: string[] = ['limit=10'];
            if (activeSession) {
                listParams.push(`sessionId=${activeSession.sessionId}`);
            } else if (selectedEvent) {
                listParams.push(`eventId=${selectedEvent.id}`);
            }
            const listQuery = listParams.join('&');
            const checkinRes = await api.checkins.list(token, listQuery);

            setRecentCheckins(checkinRes.checkins.map((c: any) => ({
                id: c.id,
                regCode: c.regCode,
                firstName: c.firstName,
                lastName: c.lastName,
                ticketName: c.ticketName,
                sessionName: c.sessionName,
                scannedAt: new Date(c.scannedAt).toLocaleTimeString("en-US", { timeZone: "Asia/Bangkok" }),
            })));
        } catch (error) {
            console.error('Failed to fetch stats:', error);
        }
    }, [activeSession, selectedEvent]);

    useEffect(() => {
        if (!showSessionPicker) {
            fetchData();
        }
    }, [showSessionPicker, fetchData]);

    // ─── QR Scanner handler ───
    const handleQrScan = useCallback((results: { rawValue: string }[]) => {
        if (!results || results.length === 0) return;
        const scannedCode = results[0].rawValue.trim().toUpperCase();
        if (scannedCode && scannedCode !== lastScannedRef.current) {
            lastScannedRef.current = scannedCode;
            processScan(scannedCode);
            setTimeout(() => { lastScannedRef.current = ''; }, 3000);
        }
    }, []);

    // Auto-focus manual input
    useEffect(() => {
        if (scanMode === 'manual' && !scanResult && !pendingSessions && !showSessionPicker) {
            setTimeout(() => manualInputRef.current?.focus(), 100);
        }
    }, [scanMode, scanResult, pendingSessions, showSessionPicker]);

    // ─── Process scan ───
    const processScan = async (code: string) => {
        setIsLoading(true);
        setScanResult(null);
        setPendingSessions(null);
        setPendingRegistration(null);
        try {
            const token = getBackofficeToken();

            // If we have an active (assigned) session, use Mode 4: fast scan
            if (activeSession) {
                const res = await api.checkins.create(token, {
                    regCode: code,
                    assignedSessionId: activeSession.sessionId,
                });

                if (res.success) {
                    if (soundEnabled) playSuccessSound();
                    setScanResult({
                        status: 'success',
                        code,
                        name: `${res.registration.firstName} ${res.registration.lastName}`,
                        ticketType: res.registration.ticketName,
                        eventName: res.registration.eventName,
                        message: `Checked in: ${res.checkedInSession?.sessionName}`,
                        registrationSessionId: undefined,
                    });
                    fetchData();
                }
            } else {
                // No assigned session → use original flow
                const res = await api.checkins.create(token, { regCode: code });

                if (res.sessions) {
                    // Case 3: multiple sessions → show picker
                    setPendingRegistration(res.registration);
                    setPendingSessions(res.sessions);
                    setIsLoading(false);
                    return;
                }

                if (res.success) {
                    if (soundEnabled) playSuccessSound();
                    setScanResult({
                        status: 'success',
                        code,
                        name: `${res.registration.firstName} ${res.registration.lastName}`,
                        ticketType: res.registration.ticketName,
                        eventName: res.registration.eventName,
                        message: res.checkedInCount
                            ? `Checked in ${res.checkedInCount} sessions!`
                            : 'Check-in successful!',
                    });
                    fetchData();
                }
            }
        } catch (error: any) {
            const msg = error.message || 'Scan failed';
            if (msg.includes('เช็คอินแล้ว') || msg.includes('Already checked in') || msg.includes('already checked')) {
                if (soundEnabled) playDuplicateSound();
                setScanResult({ status: 'duplicate', code, message: 'Already checked in' });
            } else if (msg.includes('ไม่มีสิทธิ์') || msg.includes('NO_ACCESS') || msg.includes('No access')) {
                if (soundEnabled) playErrorSound();
                setScanResult({ status: 'no_access', code, message: 'No access to this session' });
            } else if (msg.includes('Not found') || msg.includes('not found') || msg.includes('404')) {
                if (soundEnabled) playErrorSound();
                setScanResult({ status: 'error', code, message: 'Invalid registration code' });
            } else {
                if (soundEnabled) playErrorSound();
                setScanResult({ status: 'error', code, message: msg });
            }
        } finally {
            setIsLoading(false);
        }
    };

    // ─── Check-in specific session (from session picker) ───
    const checkInSession = async (sessionId: number) => {
        if (!pendingRegistration) return;
        setIsLoading(true);
        try {
            const token = getBackofficeToken();
            const res = await api.checkins.create(token, {
                regCode: pendingRegistration.regCode,
                sessionId,
            });
            if (res.success) {
                if (soundEnabled) playSuccessSound();
                setPendingSessions(prev =>
                    prev?.map(s => s.sessionId === sessionId
                        ? { ...s, checkedInAt: new Date().toISOString() }
                        : s
                    ) || null
                );
                toast.success(`Checked in: ${res.checkedInSession?.sessionName}`);
                fetchData();
            }
        } catch (error: any) {
            if (soundEnabled) playErrorSound();
            toast.error(error.message || 'Check-in failed');
        } finally {
            setIsLoading(false);
        }
    };

    const checkInAllSessions = async () => {
        if (!pendingRegistration) return;
        setIsLoading(true);
        try {
            const token = getBackofficeToken();
            const res = await api.checkins.create(token, {
                regCode: pendingRegistration.regCode,
                checkInAll: true,
            });
            if (res.success) {
                if (soundEnabled) playSuccessSound();
                setScanResult({
                    status: 'success',
                    code: pendingRegistration.regCode,
                    name: `${pendingRegistration.firstName} ${pendingRegistration.lastName}`,
                    ticketType: pendingRegistration.ticketName,
                    eventName: pendingRegistration.eventName,
                    message: `Checked in ${res.checkedInCount} sessions!`,
                });
                setPendingSessions(null);
                setPendingRegistration(null);
                fetchData();
            }
        } catch (error: any) {
            if (soundEnabled) playErrorSound();
            toast.error(error.message || 'Check-in failed');
        } finally {
            setIsLoading(false);
        }
    };

    // ─── Undo check-in ───
    const handleUndo = async (registrationSessionId: number) => {
        try {
            const token = getBackofficeToken();
            const res = await api.checkins.undo(token, registrationSessionId);
            if (res.success) {
                toast.success(`Undo: ${res.undone.name} — ${res.undone.sessionName}`);
                fetchData();
            }
        } catch (error: any) {
            toast.error(error.message || 'Undo failed');
        }
    };

    const handleManualSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (manualCode.trim()) {
            processScan(manualCode.trim().toUpperCase());
            setManualCode('');
        }
    };

    const clearResult = () => {
        setScanResult(null);
        setPendingSessions(null);
        setPendingRegistration(null);
        // Re-focus input
        setTimeout(() => manualInputRef.current?.focus(), 100);
    };

    // Auto-clear result after 3 seconds in fast scan mode
    useEffect(() => {
        if (scanResult && activeSession && scanMode === 'camera') {
            const timer = setTimeout(clearResult, 3000);
            return () => clearTimeout(timer);
        }
    }, [scanResult, activeSession, scanMode]);

    const handleSelectSession = (session: AssignedSession) => {
        setActiveSession(session);
        setShowSessionPicker(false);
    };

    const handleEnterFreeMode = () => {
        setActiveSession(null);
        setShowSessionPicker(false);
    };

    // ─── SESSION PICKER SCREEN ───
    if (showSessionPicker) {
        return (
            <AdminLayout title="Check-in Scanner">
                <div className="max-w-lg mx-auto py-8">
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
                            <IconScan size={32} className="text-blue-600" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-800 mb-2">Select Check-in Mode</h2>
                        <p className="text-gray-500">
                            {user?.firstName && `สวัสดี ${user.firstName},`} เลือก session ที่ต้องการ check-in
                        </p>
                    </div>

                    {/* Assigned sessions (for staff/verifier) */}
                    {hasAssignedSessions && (
                        <div className="mb-6">
                            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                                Your Assigned Sessions
                            </h3>
                            <div className="space-y-3">
                                {assignedSessions.map((session) => (
                                    <button
                                        key={session.sessionId}
                                        onClick={() => handleSelectSession(session)}
                                        className="w-full p-4 rounded-xl border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50 text-left transition-all group"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="font-semibold text-gray-800 group-hover:text-blue-700">
                                                    {session.sessionName}
                                                </p>
                                                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                                                    {session.room && <span>Room: {session.room}</span>}
                                                    {session.sessionType && <span className="capitalize">{session.sessionType.replace('_', ' ')}</span>}
                                                </div>
                                            </div>
                                            <IconDoor size={24} className="text-gray-300 group-hover:text-blue-500" />
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Admin/multi-event: Event picker → then session picker */}
                    {isAdmin && !selectedEvent && (
                        <div>
                            {hasAssignedSessions && (
                                <div className="relative my-6">
                                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
                                    <div className="relative flex justify-center"><span className="bg-white px-3 text-sm text-gray-400">or select event</span></div>
                                </div>
                            )}
                            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                                Select Event
                            </h3>
                            {loadingEvents ? (
                                <div className="flex items-center justify-center py-8 text-gray-400">
                                    <IconLoader2 size={24} className="animate-spin mr-2" /> Loading events...
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {events.map((event) => (
                                        <button
                                            key={event.id}
                                            onClick={() => setSelectedEvent(event)}
                                            className="w-full p-4 rounded-xl border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50 text-left transition-all group"
                                        >
                                            <div className="flex items-center justify-between">
                                                <p className="font-semibold text-gray-800 group-hover:text-blue-700">
                                                    {event.eventName}
                                                </p>
                                                <IconCalendarEvent size={24} className="text-gray-300 group-hover:text-blue-500" />
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Admin: Session picker after event is selected */}
                    {isAdmin && selectedEvent && (
                        <div>
                            <div className="flex items-center gap-2 mb-4">
                                <button
                                    onClick={() => { setSelectedEvent(null); setEventSessions([]); }}
                                    className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
                                >
                                    <IconArrowBack size={18} />
                                </button>
                                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
                                    {selectedEvent.eventName}
                                </h3>
                            </div>

                            {/* All Sessions option (event-level scan) */}
                            <button
                                onClick={() => {
                                    setActiveSession(null);
                                    setShowSessionPicker(false);
                                }}
                                className="w-full p-4 rounded-xl border-2 border-blue-200 bg-blue-50 hover:border-blue-400 text-left transition-all group mb-3"
                            >
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-semibold text-blue-700">All Sessions</p>
                                        <p className="text-xs text-blue-500 mt-1">Scan and choose sessions manually</p>
                                    </div>
                                    <IconCalendarEvent size={24} className="text-blue-400" />
                                </div>
                            </button>

                            {/* Individual sessions */}
                            <div className="space-y-3">
                                {eventSessions.map((session) => (
                                    <button
                                        key={session.sessionId}
                                        onClick={() => handleSelectSession(session)}
                                        className="w-full p-4 rounded-xl border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50 text-left transition-all group"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="font-semibold text-gray-800 group-hover:text-blue-700">
                                                    {session.sessionName}
                                                </p>
                                                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                                                    {session.room && <span>Room: {session.room}</span>}
                                                    {session.sessionType && <span className="capitalize">{session.sessionType.replace('_', ' ')}</span>}
                                                </div>
                                            </div>
                                            <IconDoor size={24} className="text-gray-300 group-hover:text-blue-500" />
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Non-admin without assigned sessions → Free mode */}
                    {!isAdmin && !hasAssignedSessions && (
                        <button
                            onClick={handleEnterFreeMode}
                            className="w-full p-4 rounded-xl border-2 border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50 text-center transition-all"
                        >
                            <p className="font-medium text-gray-600">Free Mode (All Sessions)</p>
                            <p className="text-xs text-gray-400 mt-1">Scan and choose sessions manually</p>
                        </button>
                    )}
                </div>
            </AdminLayout>
        );
    }

    // ─── MAIN SCANNER SCREEN ───
    return (
        <AdminLayout title={activeSession ? `Check-in: ${activeSession.sessionName}` : 'Check-in Scanner'}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Scanner Area */}
                <div className="lg:col-span-2">
                    <div className="card min-h-[500px] flex flex-col">
                        {/* Top bar: mode toggle + controls */}
                        <div className="flex items-center gap-2 mb-4">
                            {/* Back to session picker */}
                            {(hasAssignedSessions || isAdmin) && (
                                <button
                                    onClick={() => { setShowSessionPicker(true); clearResult(); }}
                                    className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
                                    title="Switch Session"
                                >
                                    <IconArrowsExchange size={20} />
                                </button>
                            )}

                            <button
                                onClick={() => {
                                    if (!cameraSupported) {
                                        toast.error('Camera requires HTTPS. Please access via a secure URL.');
                                        return;
                                    }
                                    setScanMode('camera');
                                }}
                                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium transition-colors text-sm ${
                                    !cameraSupported
                                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                        : scanMode === 'camera'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                                title={!cameraSupported ? 'Camera requires HTTPS' : 'Camera'}
                            >
                                <IconCamera size={18} /> Camera
                                {!cameraSupported && <span className="text-xs">(HTTPS only)</span>}
                            </button>
                            <button
                                onClick={() => setScanMode('manual')}
                                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium transition-colors text-sm ${scanMode === 'manual'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                            >
                                <IconKeyboard size={18} /> Manual
                            </button>

                            {/* Sound toggle */}
                            <button
                                onClick={() => setSoundEnabled(!soundEnabled)}
                                className={`p-2 rounded-lg transition-colors ${soundEnabled ? 'bg-gray-100 text-gray-600' : 'bg-red-100 text-red-600'}`}
                                title={soundEnabled ? 'Mute' : 'Unmute'}
                            >
                                {soundEnabled ? <IconVolume size={20} /> : <IconVolumeOff size={20} />}
                            </button>
                        </div>

                        {/* Active session badge */}
                        {activeSession && (
                            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 mb-4 flex items-center gap-2">
                                <IconDoor size={16} className="text-blue-600" />
                                <span className="text-sm font-medium text-blue-800">{activeSession.sessionName}</span>
                                {activeSession.room && <span className="text-xs text-blue-500">— {activeSession.room}</span>}
                                <span className="ml-auto text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full">Fast Scan</span>
                            </div>
                        )}

                        {/* Loading State */}
                        {isLoading && (
                            <div className="flex-1 flex flex-col items-center justify-center text-blue-600">
                                <IconLoader2 size={48} className="animate-spin mb-4" />
                                <p className="text-lg font-medium">Processing...</p>
                            </div>
                        )}

                        {/* HTTPS warning banner */}
                        {!cameraSupported && (
                            <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                                <IconAlertTriangle size={18} className="text-amber-500 mt-0.5 flex-shrink-0" />
                                <div>
                                    <p className="text-sm font-medium text-amber-800">Camera requires HTTPS</p>
                                    <p className="text-xs text-amber-600 mt-0.5">Access this page via a secure URL (https://) to use the camera scanner. Manual entry is available below.</p>
                                </div>
                            </div>
                        )}

                        {/* Camera Mode */}
                        {!isLoading && scanMode === 'camera' && !scanResult && !pendingSessions && (
                            <div className="flex-1 flex flex-col items-center justify-center">
                                <div className="w-full max-w-sm mx-auto rounded-xl overflow-hidden">
                                    <Scanner
                                        onScan={handleQrScan}
                                        onError={(err: unknown) => {
                                            console.error('Scanner error:', err);
                                            const msg = err instanceof Error ? err.message : String(err);
                                            if (msg.toLowerCase().includes('secure') || msg.toLowerCase().includes('https')) {
                                                setCameraSupported(false);
                                                setScanMode('manual');
                                            } else if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('notallowed')) {
                                                toast.error('Camera permission denied.');
                                                setScanMode('manual');
                                            } else {
                                                toast.error('Cannot access camera. Using manual entry.');
                                                setScanMode('manual');
                                            }
                                        }}
                                        constraints={{ facingMode: 'environment' }}
                                        styles={{ container: { borderRadius: '0.75rem', overflow: 'hidden' } }}
                                    />
                                </div>
                                <p className="text-xs text-gray-400 mt-3 text-center">Point camera at QR code</p>
                            </div>
                        )}

                        {/* Manual Mode */}
                        {!isLoading && scanMode === 'manual' && !scanResult && !pendingSessions && (
                            <div className="flex-1 flex flex-col items-center justify-center py-8">
                                <form onSubmit={handleManualSubmit} className="max-w-md w-full mx-auto">
                                    <label className="block text-sm font-medium text-gray-700 mb-2 text-center">
                                        Enter Registration Code
                                    </label>
                                    <div className="flex gap-2 mb-2">
                                        <input
                                            ref={manualInputRef}
                                            type="text"
                                            className="input-field text-center text-xl font-mono uppercase tracking-wider"
                                            placeholder="REG-XXXX"
                                            value={manualCode}
                                            onChange={(e) => setManualCode(e.target.value)}
                                            autoFocus
                                        />
                                        <button type="submit" className="btn-primary px-6">
                                            <IconCheck size={24} />
                                        </button>
                                    </div>
                                    <p className="text-xs text-gray-400 text-center">Press Enter to submit</p>
                                </form>
                            </div>
                        )}

                        {/* Session Selection (multi-session flow) */}
                        {!isLoading && pendingSessions && pendingRegistration && (
                            <div className="flex-1 flex flex-col py-6 animate-fade-in">
                                <div className="max-w-md w-full mx-auto">
                                    <div className="bg-white rounded-xl p-5 shadow-sm border mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                                                <IconUser size={20} className="text-blue-600" />
                                            </div>
                                            <div>
                                                <p className="font-semibold text-gray-800">
                                                    {pendingRegistration.firstName} {pendingRegistration.lastName}
                                                </p>
                                                <p className="text-xs text-gray-500 font-mono">{pendingRegistration.regCode}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                                        <IconDoor size={20} className="text-blue-600" />
                                        Select Session to Check-in
                                    </h3>

                                    <div className="space-y-2 mb-4">
                                        {pendingSessions.map(session => (
                                            <button
                                                key={session.id}
                                                disabled={!!session.checkedInAt || isLoading}
                                                onClick={() => checkInSession(session.sessionId)}
                                                className={`w-full p-4 rounded-lg border text-left transition-colors ${
                                                    session.checkedInAt
                                                        ? 'bg-green-50 border-green-200 cursor-default'
                                                        : 'bg-white border-gray-200 hover:border-blue-400 hover:bg-blue-50 cursor-pointer'
                                                }`}
                                            >
                                                <div className="flex justify-between items-center">
                                                    <div>
                                                        <p className="font-medium text-gray-800">{session.sessionName}</p>
                                                        <p className="text-xs text-gray-500">{session.ticketName}</p>
                                                    </div>
                                                    {session.checkedInAt ? (
                                                        <span className="text-green-600 flex items-center gap-1 text-sm font-medium">
                                                            <IconCheck size={16} /> Done
                                                        </span>
                                                    ) : (
                                                        <span className="text-blue-600 text-sm">Tap to check-in</span>
                                                    )}
                                                </div>
                                            </button>
                                        ))}
                                    </div>

                                    <div className="flex gap-2">
                                        <button
                                            onClick={checkInAllSessions}
                                            disabled={pendingSessions.every(s => !!s.checkedInAt) || isLoading}
                                            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white py-3 rounded-lg font-medium transition-colors"
                                        >
                                            Check-in All Sessions
                                        </button>
                                        <button
                                            onClick={clearResult}
                                            className="px-4 py-3 bg-gray-100 rounded-lg hover:bg-gray-200 text-gray-600 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Scan Result */}
                        {!isLoading && scanResult && (
                            <div className="flex-1 flex flex-col items-center justify-center py-8 animate-fade-in">
                                <div className={`w-full max-w-md mx-auto rounded-2xl p-8 text-center ${
                                    scanResult.status === 'success'
                                        ? 'bg-green-50 border-2 border-green-200'
                                        : scanResult.status === 'duplicate'
                                            ? 'bg-yellow-50 border-2 border-yellow-200'
                                            : 'bg-red-50 border-2 border-red-200'
                                }`}>
                                    <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-4 ${
                                        scanResult.status === 'success'
                                            ? 'bg-green-500'
                                            : scanResult.status === 'duplicate'
                                                ? 'bg-yellow-500'
                                                : 'bg-red-500'
                                    }`}>
                                        {scanResult.status === 'success' ? (
                                            <IconCheck size={40} className="text-white" />
                                        ) : scanResult.status === 'duplicate' ? (
                                            <IconAlertTriangle size={40} className="text-white" />
                                        ) : (
                                            <IconX size={40} className="text-white" />
                                        )}
                                    </div>

                                    <h3 className={`text-2xl font-bold mb-2 ${
                                        scanResult.status === 'success' ? 'text-green-700'
                                        : scanResult.status === 'duplicate' ? 'text-yellow-700'
                                        : 'text-red-700'
                                    }`}>
                                        {scanResult.status === 'success' ? 'Check-in Successful!'
                                            : scanResult.status === 'duplicate' ? 'Already Checked In'
                                            : scanResult.status === 'no_access' ? 'No Access'
                                            : 'Check-in Failed'}
                                    </h3>
                                    <p className={`text-sm mb-4 ${
                                        scanResult.status === 'success' ? 'text-green-600'
                                        : scanResult.status === 'duplicate' ? 'text-yellow-600'
                                        : 'text-red-600'
                                    }`}>
                                        {scanResult.message}
                                    </p>

                                    {scanResult.name && (
                                        <div className="bg-white rounded-lg p-4 mb-4 text-left shadow-sm">
                                            <div className="flex items-center gap-3 mb-2">
                                                <IconUser size={18} className="text-gray-400" />
                                                <span className="font-medium text-gray-800">{scanResult.name}</span>
                                            </div>
                                            {scanResult.ticketType && (
                                                <div className="flex items-center gap-3 mb-2">
                                                    <IconTicket size={18} className="text-gray-400" />
                                                    <span className="text-gray-600">{scanResult.ticketType}</span>
                                                </div>
                                            )}
                                            <div className="flex items-center gap-3">
                                                <IconScan size={18} className="text-gray-400" />
                                                <span className="font-mono text-gray-600">{scanResult.code}</span>
                                            </div>
                                        </div>
                                    )}

                                    <button
                                        onClick={clearResult}
                                        className={`px-6 py-2 rounded-lg font-medium flex items-center gap-2 mx-auto transition-colors ${
                                            scanResult.status === 'success' ? 'bg-green-600 hover:bg-green-700 text-white'
                                            : scanResult.status === 'duplicate' ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                                            : 'bg-red-600 hover:bg-red-700 text-white'
                                        }`}
                                    >
                                        <IconRefresh size={18} /> Scan Next
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    {/* Overall Stats */}
                    <div className="card">
                        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                            <IconCalendarEvent size={20} className="text-blue-600" />
                            {activeSession ? activeSession.sessionName
                                : selectedEvent ? selectedEvent.eventName
                                : 'Check-in Stats'}
                        </h3>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="text-gray-600">Total Registered</span>
                                <span className="font-bold text-gray-800">{stats.total}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-gray-600">Checked In</span>
                                <span className="font-bold text-green-600">{stats.checkedIn}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-gray-600">Remaining</span>
                                <span className="font-bold text-yellow-600">{stats.remaining}</span>
                            </div>
                            {stats.total > 0 && (
                                <div className="pt-2">
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-gray-500">Progress</span>
                                        <span className="font-medium text-gray-700">{stats.percentage}%</span>
                                    </div>
                                    <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-blue-500 to-green-500 rounded-full transition-all duration-1000"
                                            style={{ width: `${stats.percentage}%` }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Per-session breakdown */}
                    {sessionBreakdown.length > 0 && (
                        <div className="card">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                                <IconDoor size={20} className="text-blue-600" />
                                Session Breakdown
                            </h3>
                            <div className="space-y-4">
                                {sessionBreakdown.map((s) => (
                                    <div key={s.sessionId} className="border border-gray-100 rounded-lg p-3">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <p className="font-medium text-gray-800 text-sm">{s.sessionName}</p>
                                                {s.room && <p className="text-xs text-gray-400">{s.room}</p>}
                                            </div>
                                            <span className="text-xs font-medium text-gray-500">
                                                {s.checkedIn}/{s.total}
                                            </span>
                                        </div>
                                        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all duration-700 ${
                                                    s.percentage === 100 ? 'bg-green-500'
                                                    : s.percentage >= 50 ? 'bg-blue-500'
                                                    : 'bg-amber-500'
                                                }`}
                                                style={{ width: `${s.percentage}%` }}
                                            />
                                        </div>
                                        <div className="flex justify-between text-xs mt-1">
                                            <span className="text-green-600">{s.checkedIn} in</span>
                                            <span className="text-gray-400">{s.remaining} left</span>
                                            <span className="font-medium text-gray-600">{s.percentage}%</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Recent Check-ins */}
                    <div className="card">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-gray-800">Recent Scans</h3>
                            <button onClick={fetchData} className="p-1 hover:bg-gray-100 rounded text-gray-500">
                                <IconRefresh size={16} />
                            </button>
                        </div>
                        <div className="space-y-3">
                            {recentCheckins.length === 0 ? (
                                <p className="text-center text-gray-500 py-4">No recent scans</p>
                            ) : (
                                recentCheckins.map((checkin) => (
                                    <div
                                        key={checkin.id}
                                        className="flex items-center justify-between p-3 rounded-lg bg-green-50"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full flex items-center justify-center bg-green-500 text-white">
                                                <IconCheck size={16} />
                                            </div>
                                            <div>
                                                <p className="font-medium text-gray-800 text-sm truncate max-w-[120px]" title={`${checkin.firstName} ${checkin.lastName}`}>
                                                    {checkin.firstName} {checkin.lastName}
                                                </p>
                                                <p className="text-xs text-gray-500 font-mono">{checkin.regCode}</p>
                                                {checkin.sessionName && (
                                                    <p className="text-xs text-gray-400">{checkin.sessionName}</p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-gray-400">{checkin.scannedAt}</span>
                                            <button
                                                onClick={() => handleUndo(checkin.id)}
                                                className="p-1 rounded hover:bg-red-100 text-gray-400 hover:text-red-600 transition-colors"
                                                title="Undo check-in"
                                            >
                                                <IconArrowBack size={14} />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}
