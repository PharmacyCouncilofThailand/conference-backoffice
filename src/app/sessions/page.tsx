'use client';

import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/layout';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import {
    IconCalendarEvent,
    IconPlus,
    IconClock,
    IconMapPin,
    IconUsers,
    IconPencil,
    IconTrash,
    IconSearch,
    IconFilter,
    IconLayoutList,
    IconTimeline,
    IconVideo,
    IconLoader2,
    IconX,
    IconMicrophone,
    IconTargetArrow,
    IconStar,
} from '@tabler/icons-react';

const getBackofficeToken = () =>
    localStorage.getItem('backoffice_token') ||
    sessionStorage.getItem('backoffice_token') ||
    '';

interface Session {
    id: number;
    eventId: number;
    sessionCode: string;
    sessionName: string;
    sessionType: string;
    description: string;
    room: string;
    startTime: string;
    endTime: string;
    speakers: string[]; // Aggregated names from backend
    speakerIds?: number[]; // New way: link to speakers table
    maxCapacity: number;
    enrolledCount: number;
    eventCode?: string;
    tags?: string[]; // Not in schema, mocked or derived
    isMainSession?: boolean; // Added for Main Session Logic
    agenda?: { time: string; topic: string }[] | null;
}

interface EventOption {
    id: number;
    code: string;
    name: string;
}

interface Speaker {
    id: number;
    firstName: string;
    lastName: string;
    organization: string | null;
}

export default function SessionsPage() {
    const [viewMode, setViewMode] = useState<'list' | 'timeline'>('list');
    const [sessions, setSessions] = useState<Session[]>([]);
    const [events, setEvents] = useState<EventOption[]>([]);
    const [speakers, setSpeakers] = useState<Speaker[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [eventFilter, setEventFilter] = useState<number | ''>('');
    const [page, setPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [totalPages, setTotalPages] = useState(1);

    // Modals
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showViewModal, setShowViewModal] = useState(false);
    const [selectedSession, setSelectedSession] = useState<Session | null>(null);

    // Enrollments for View Details
    interface Enrollment {
        id: number;
        regCode: string;
        email: string;
        firstName: string;
        lastName: string;
        status: string;
        createdAt: string;
        ticketName: string | null;
    }
    const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
    const [enrollmentsLoading, setEnrollmentsLoading] = useState(false);

    const [formData, setFormData] = useState({
        eventId: 0,
        sessionCode: '',
        sessionName: '',
        sessionType: 'other' as string,
        description: '',
        room: '',
        startTime: '',
        endTime: '',
        selectedSpeakerIds: [] as number[],
        maxCapacity: 100,
        isMainSession: false, // Added for Main Session Logic
        agenda: [] as { time: string; topic: string }[],
    });

    const [eventSessions, setEventSessions] = useState<Session[]>([]); // To track siblings for locking logic
    const [isSessionsLoading, setIsSessionsLoading] = useState(false); // To prevent logic flicker while loading sibling data

    useEffect(() => {
        fetchEvents();
        fetchSpeakers();
    }, []);

    useEffect(() => {
        fetchSessions();
    }, [page, searchTerm, eventFilter]);

    // Fetch sibling sessions when event changes (for locking logic)
    useEffect(() => {
        if (formData.eventId) {
            fetchEventSessions(formData.eventId);
        }
    }, [formData.eventId]);

    const fetchEvents = async () => {
        try {
            const token = getBackofficeToken();
            const res = await api.backofficeEvents.list(token, 'limit=100');
            const mappedEvents = res.events.map((e: Record<string, unknown>) => ({
                id: e.id as number,
                code: e.eventCode as string,
                name: e.eventName as string
            }));
            setEvents(mappedEvents);
            if (mappedEvents.length > 0 && formData.eventId === 0) {
                setFormData(prev => ({ ...prev, eventId: mappedEvents[0].id }));
            }
        } catch (error) {
            console.error('Failed to fetch events:', error);
        }
    };

    const fetchSpeakers = async () => {
        try {
            const token = getBackofficeToken();
            const res = await api.speakers.list(token);
            setSpeakers((res.speakers || []) as unknown as Speaker[]);
        } catch (error) {
            console.error('Failed to fetch speakers:', error);
        }
    };

    const fetchEventSessions = async (eventId: number) => {
        if (!eventId) return;
        setEventSessions([]); // Clear previous event sessions while loading
        setIsSessionsLoading(true);
        try {
            const token = getBackofficeToken();
            const res = await api.backofficeEvents.get(token, eventId);
            if (res.sessions) {
                const mapped: Session[] = res.sessions.map((s: any) => ({
                    id: s.id,
                    eventId: eventId,
                    sessionCode: s.sessionCode,
                    sessionName: s.sessionName,
                    sessionType: s.sessionType,
                    description: s.description,
                    room: s.room,
                    startTime: s.startTime,
                    endTime: s.endTime,
                    speakers: s.speakers || [],
                    speakerIds: s.speakerIds || [],
                    maxCapacity: s.maxCapacity,
                    enrolledCount: s.enrolledCount || 0,
                    isMainSession: s.isMainSession || false
                }));
                setEventSessions(mapped);
            } else {
                setEventSessions([]);
            }
        } catch (error) {
            console.error('Failed to fetch event sessions:', error);
            setEventSessions([]);
        } finally {
            setIsSessionsLoading(false);
        }
    };

    const fetchSessions = async () => {
        setIsLoading(true);
        try {
            const token = getBackofficeToken();
            const params: any = { page, limit: 12 }; // Grid view needs roughly 12
            if (eventFilter) params.eventId = eventFilter;
            if (searchTerm) params.search = searchTerm;

            const res = await api.sessions.list(token, new URLSearchParams(params).toString());

            const mappedSessions: Session[] = res.sessions.map((s: any) => {
                // Parse speakers from JSON string if needed
                let speakersArray: string[] = [];
                if (s.speakers) {
                    try {
                        speakersArray = typeof s.speakers === 'string' ? JSON.parse(s.speakers) : s.speakers;
                    } catch { speakersArray = []; }
                }

                return {
                    id: s.id,
                    eventId: s.eventId,
                    sessionCode: s.sessionCode,
                    sessionName: s.sessionName,
                    sessionType: s.sessionType || 'other',
                    description: s.description || '',
                    room: s.room || '',
                    startTime: s.startTime,
                    endTime: s.endTime,
                    speakers: s.speakers || [],
                    speakerIds: s.speakerIds || [],
                    maxCapacity: s.maxCapacity || 100,
                    enrolledCount: s.enrolledCount || 0,
                    eventCode: s.eventCode,
                    isMainSession: s.isMainSession || false,
                    agenda: s.agenda || null
                };
            });

            // For detailed edit, I'll need to maybe fetch session details?
            // sessions.ts doesn't have get-session-by-id global endpoint.
            // But I can fetch via api.backofficeEvents.getSessions(eventId) and find it, or update session.ts.
            // Wait, backoffice events has specific getSession/tickets nested?
            // api.backofficeEvents.getSessions returns list for event.
            // It doesn't seem to have a single getSession by ID?
            // Wait, api.ts has updateSession(eventId, sessionId).
            // To fill the form, I might need the data.
            // I'll just use what I have or fetch list context.
            // Actually, if `sessions.list` doesn't return speakers/description, I can't edit them properly.
            // I should update `sessions.ts` to return more fields OR simply fetch defaults.
            // I will update `sessions.ts` to include description and speakers in the select if possible in next iteration, 
            // but for now I'll proceed. The form will use empty values if missing.

            setSessions(mappedSessions);
            setTotalCount(res.pagination.total);
            setTotalPages(res.pagination.totalPages);
        } catch (error) {
            console.error('Failed to fetch sessions:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreate = async () => {
        if (!formData.eventId) { toast.error('Select an event'); return; }
        setIsSubmitting(true);
        try {
            const token = getBackofficeToken();
            // Get speaker names from selected IDs
            const speakerNames = formData.selectedSpeakerIds.map(id => {
                const speaker = speakers.find(s => s.id === id);
                return speaker ? `${speaker.firstName} ${speaker.lastName}` : '';
            }).filter(Boolean);

            // Build payload matching backend schema
            const payload = {
                sessionCode: formData.sessionCode,
                sessionName: formData.sessionName,
                sessionType: formData.sessionType,
                description: formData.description || undefined,
                room: formData.room || undefined,
                startTime: new Date(formData.startTime).toISOString(),
                endTime: new Date(formData.endTime).toISOString(),
                speakerIds: formData.selectedSpeakerIds,
                maxCapacity: formData.maxCapacity || 100,
                isMainSession: formData.isMainSession,
                agenda: formData.agenda && formData.agenda.length > 0 ? formData.agenda : undefined,
            };
            await api.backofficeEvents.createSession(token, formData.eventId, payload);
            toast.success('Session created successfully!');
            setShowCreateModal(false);
            fetchSessions();
        } catch (error) {
            console.error(error);
            toast.error('Failed to create session');
            setIsSubmitting(false);
        }
    };

    const handleUpdate = async () => {
        if (!selectedSession || !formData.eventId) return;
        setIsSubmitting(true);
        try {
            const token = getBackofficeToken();
            // Get speaker names from selected IDs
            const speakerNames = formData.selectedSpeakerIds.map(id => {
                const speaker = speakers.find(s => s.id === id);
                return speaker ? `${speaker.firstName} ${speaker.lastName}` : '';
            }).filter(Boolean);

            // Build payload matching backend schema
            const payload = {
                sessionCode: formData.sessionCode,
                sessionName: formData.sessionName,
                sessionType: formData.sessionType,
                description: formData.description || undefined,
                room: formData.room || undefined,
                startTime: new Date(formData.startTime).toISOString(),
                endTime: new Date(formData.endTime).toISOString(),
                speakerIds: formData.selectedSpeakerIds,
                maxCapacity: formData.maxCapacity || 100,
                isMainSession: formData.isMainSession,
                agenda: formData.agenda && formData.agenda.length > 0 ? formData.agenda : undefined,
            };
            await api.backofficeEvents.updateSession(token, formData.eventId, selectedSession.id, payload);
            toast.success('Session updated successfully!');
            setShowEditModal(false);
            fetchSessions();
        } catch (error) {
            console.error(error);
            toast.error('Failed to update session');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!selectedSession) return;
        setIsSubmitting(true);
        try {
            const token = getBackofficeToken();
            await api.backofficeEvents.deleteSession(token, selectedSession.eventId, selectedSession.id);
            toast.success('Session deleted successfully!');
            setShowDeleteModal(false);
            fetchSessions();
        } catch (error) {
            console.error(error);
            toast.error('Failed to delete session');
        } finally {
            setIsSubmitting(false);
        }
    };

    const openViewModal = async (session: Session) => {
        setSelectedSession(session);
        setShowViewModal(true);
        setEnrollmentsLoading(true);
        try {
            const token = getBackofficeToken();
            const res = await api.backofficeEvents.getSessionEnrollments(token, session.eventId, session.id);
            setEnrollments(res.enrollments);
        } catch (error) {
            console.error('Failed to fetch enrollments:', error);
            setEnrollments([]);
        } finally {
            setEnrollmentsLoading(false);
        }
    };

    const resetForm = () => {
        setFormData({
            eventId: Number(eventFilter) || (events.length > 0 ? events[0].id : 0),
            sessionCode: '',
            sessionName: '',
            sessionType: 'other',
            description: '',
            room: '',
            startTime: '',
            endTime: '',
            selectedSpeakerIds: [],
            maxCapacity: 100,
            isMainSession: false,
            agenda: [],
        });
        setSelectedSession(null);
    };

    const openEditModal = (session: Session) => {
        setSelectedSession(session);
        const formatDateTime = (dateStr: string) => {
            if (!dateStr) return '';
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return '';
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const hours = String(d.getHours()).padStart(2, '0');
            const minutes = String(d.getMinutes()).padStart(2, '0');
            return `${year}-${month}-${day}T${hours}:${minutes}`;
        };

        // Match speaker names to IDs
        const speakerIds = (session.speakers || []).map(name => {
            const speaker = speakers.find(s => `${s.firstName} ${s.lastName}` === name);
            return speaker?.id;
        }).filter((id): id is number => id !== undefined);

        setFormData({
            eventId: session.eventId,
            sessionCode: session.sessionCode,
            sessionName: session.sessionName,
            sessionType: session.sessionType || 'other',
            description: session.description || '',
            room: session.room,
            startTime: formatDateTime(session.startTime),
            endTime: formatDateTime(session.endTime),
            selectedSpeakerIds: session.speakerIds || [],
            maxCapacity: session.maxCapacity || 100,
            isMainSession: session.isMainSession || false,
            agenda: session.agenda || [],
        });
        fetchEventSessions(session.eventId); // Fetch siblings for locking logic
        setShowEditModal(true);
    };

    // Helper to render a session card (to avoid duplication in layout split)
    const renderSessionCard = (session: Session, index: number, isMain: boolean) => {
        const colors = isMain ? ['#8B5CF6'] : ['#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#6366F1'];
        const sessionColor = colors[index % colors.length];
        const capacityPercentage = session.maxCapacity > 0 ? Math.min((session.enrolledCount / session.maxCapacity) * 100, 100) : 0;

        return (
            <div
                key={session.id}
                className={`group relative bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 animate-fade-in border-2 ${isMain ? 'border-purple-200' : 'border-transparent'}`}
                style={{ marginBottom: '0', display: 'flex', flexDirection: 'column', height: '100%' }}
            >
                {/* Header with gradient */}
                <div
                    style={{
                        background: isMain
                            ? `linear-gradient(135deg, #7C3AED 0%, #8B5CF6 100%)`
                            : `linear-gradient(135deg, ${sessionColor} 0%, ${sessionColor}dd 100%)`,
                        color: 'white',
                        padding: '25px'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '15px' }}>
                        <div
                            style={{
                                width: '50px',
                                height: '50px',
                                backgroundColor: 'rgba(255,255,255,0.2)',
                                borderRadius: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                            }}
                        >
                            {isMain ? <IconStar size={24} /> : <IconCalendarEvent size={22} />}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="flex items-center gap-2 mb-1">
                                <span
                                    style={{
                                        backgroundColor: 'rgba(255,255,255,0.2)',
                                        padding: '3px 10px',
                                        borderRadius: '10px',
                                        fontSize: '11px',
                                        fontWeight: 600
                                    }}
                                >
                                    {session.sessionCode}
                                </span>
                                {isMain && (
                                    <span className="bg-white/90 text-purple-700 text-[10px] px-2 py-0.5 rounded-full uppercase font-bold shadow-sm">
                                        MAIN SESSION
                                    </span>
                                )}
                                <span className="bg-white/20 text-white text-[10px] px-2 py-0.5 rounded-full uppercase font-bold">
                                    {session.sessionType?.replace('_', ' ') || 'OTHER'}
                                </span>
                            </div>
                            <h5
                                style={{
                                    color: 'white',
                                    margin: '5px 0 0 0',
                                    fontSize: '17px',
                                    fontWeight: 600,
                                    lineHeight: 1.3
                                }}
                                title={session.sessionName}
                            >
                                {session.sessionName}
                            </h5>
                        </div>
                        {/* Actions */}
                        <div className="flex gap-2">
                            <button
                                onClick={() => openEditModal(session)}
                                className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors border border-white/10"
                            >
                                <IconPencil size={16} />
                            </button>
                            <button
                                onClick={() => { setSelectedSession(session); setShowDeleteModal(true); }}
                                className="p-2 bg-white/20 hover:bg-red-500 rounded-lg transition-colors border border-white/10"
                            >
                                <IconTrash size={16} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div style={{ padding: '25px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                    {/* Info Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                        <div>
                            <p style={{ margin: '0 0 3px 0', fontSize: '11px', color: '#999', textTransform: 'uppercase', fontWeight: 600 }}>
                                Session Date
                            </p>
                            <p style={{ margin: 0, fontWeight: 600, fontSize: '13px', color: '#333' }}>
                                {new Date(session.startTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Bangkok' })}
                                <br />
                                {new Date(session.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Bangkok' })} - {new Date(session.endTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Bangkok' })}
                            </p>
                        </div>
                        <div>
                            <p style={{ margin: '0 0 3px 0', fontSize: '11px', color: '#999', textTransform: 'uppercase', fontWeight: 600 }}>
                                Duration
                            </p>
                            <p style={{ margin: 0, fontWeight: 600, fontSize: '13px', color: '#333' }}>
                                {(() => {
                                    const start = new Date(session.startTime);
                                    const end = new Date(session.endTime);
                                    const diffMs = end.getTime() - start.getTime();
                                    const diffMins = Math.round(diffMs / 60000);
                                    const hours = Math.floor(diffMins / 60);
                                    const mins = diffMins % 60;
                                    return hours > 0 ? `${hours}h ${mins > 0 ? mins + 'm' : ''}` : `${mins}m`;
                                })()}
                            </p>
                        </div>
                        <div>
                            <p style={{ margin: '0 0 3px 0', fontSize: '11px', color: '#999', textTransform: 'uppercase', fontWeight: 600 }}>
                                Room
                            </p>
                            <p style={{ margin: 0, fontWeight: 600, fontSize: '13px', color: '#333' }}>
                                {session.room || 'TBA'}
                            </p>
                        </div>
                        <div>
                            <p style={{ margin: '0 0 3px 0', fontSize: '11px', color: '#999', textTransform: 'uppercase', fontWeight: 600 }}>
                                Session Price
                            </p>
                            <p style={{ margin: 0, fontWeight: 700, fontSize: '16px', color: isMain ? '#7C3AED' : sessionColor }}>
                                Included
                            </p>
                        </div>
                    </div>

                    {/* Time & Agenda */}
                    {session.agenda && session.agenda.length > 0 && (
                        <div style={{ marginBottom: '20px' }}>
                            <p style={{ margin: '0 0 10px 0', fontSize: '11px', color: '#999', textTransform: 'uppercase', fontWeight: 600 }}>
                                <IconClock size={14} style={{ display: 'inline', marginRight: '5px', verticalAlign: 'middle' }} />
                                Time & Agenda
                            </p>
                            <div
                                style={{
                                    backgroundColor: '#f8f9fa',
                                    borderRadius: '10px',
                                    padding: '14px 16px',
                                    borderLeft: `3px solid ${sessionColor}`,
                                }}
                            >
                                {session.agenda.map((item, i) => (
                                    <div
                                        key={i}
                                        style={{
                                            display: 'flex',
                                            gap: '10px',
                                            marginBottom: i < (session.agenda?.length || 0) - 1 ? '10px' : 0,
                                            paddingBottom: i < (session.agenda?.length || 0) - 1 ? '10px' : 0,
                                            borderBottom: i < (session.agenda?.length || 0) - 1 ? '1px dashed #e0e0e0' : 'none',
                                        }}
                                    >
                                        <span
                                            style={{
                                                fontSize: '12px',
                                                fontWeight: 700,
                                                color: sessionColor,
                                                whiteSpace: 'nowrap',
                                                minWidth: '120px',
                                            }}
                                        >
                                            {item.time}
                                        </span>
                                        <span
                                            style={{
                                                fontSize: '12px',
                                                color: '#444',
                                                lineHeight: 1.4,
                                            }}
                                        >
                                            {item.topic}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Instructors (Speakers) */}
                    <div style={{ marginBottom: '20px' }}>
                        <p style={{ margin: '0 0 10px 0', fontSize: '11px', color: '#999', textTransform: 'uppercase', fontWeight: 600 }}>
                            <IconMicrophone size={14} style={{ display: 'inline', marginRight: '5px', verticalAlign: 'middle' }} />
                            Instructor(s)
                        </p>
                        {(session.speakers || []).length > 0 ? (
                            (session.speakers || []).map((speaker, i) => (
                                <div key={i} style={{ marginBottom: '8px' }}>
                                    <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#333' }}>{speaker}</p>
                                </div>
                            ))
                        ) : (
                            <p style={{ margin: 0, fontSize: '13px', color: '#999', fontStyle: 'italic' }}>No instructors assigned</p>
                        )}
                    </div>

                    {/* Learning Objectives (Description) */}
                    <div style={{ marginBottom: '20px' }}>
                        <p style={{ margin: '0 0 10px 0', fontSize: '11px', color: '#999', textTransform: 'uppercase', fontWeight: 600 }}>
                            <IconTargetArrow size={14} style={{ display: 'inline', marginRight: '5px', verticalAlign: 'middle' }} />
                            Learning Objectives
                        </p>
                        {session.description ? (
                            <p style={{ margin: 0, fontSize: '13px', color: '#555', lineHeight: 1.5, whiteSpace: 'pre-line' }}>
                                {session.description}
                            </p>
                        ) : (
                            <p style={{ margin: 0, fontSize: '13px', color: '#999', fontStyle: 'italic' }}>No objectives specified</p>
                        )}
                    </div>

                    {/* Footer - Enrolled */}
                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '15px',
                            borderTop: '1px solid #eee',
                            paddingTop: '20px',
                            marginTop: 'auto'
                        }}
                    >
                        <div>
                            <span style={{ fontSize: '12px', color: '#666' }}>
                                <IconUsers size={14} style={{ display: 'inline', marginRight: '5px', verticalAlign: 'middle' }} />
                                {session.enrolledCount}/{session.maxCapacity || '∞'} enrolled
                            </span>
                            {session.maxCapacity > 0 && (
                                <div
                                    style={{
                                        backgroundColor: '#e0e0e0',
                                        height: '6px',
                                        width: '100px',
                                        borderRadius: '3px',
                                        marginTop: '5px'
                                    }}
                                >
                                    <div
                                        style={{
                                            backgroundColor: isMain ? '#7C3AED' : sessionColor,
                                            height: '100%',
                                            width: `${capacityPercentage}%`,
                                            borderRadius: '3px'
                                        }}
                                    />
                                </div>
                            )}
                        </div>
                        <button
                            onClick={() => openViewModal(session)}
                            style={{
                                backgroundColor: isMain ? '#7C3AED' : sessionColor,
                                color: 'white',
                                padding: '10px 20px',
                                borderRadius: '8px',
                                fontSize: '13px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                border: 'none'
                            }}
                        >
                            View Details
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <AdminLayout title="Global Sessions Manager">
            {/* Event Filter - Above Content */}
            <div className="mb-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-4 flex items-center gap-3">
                <div className="bg-blue-100 p-2 rounded-lg">
                    <IconCalendarEvent className="text-blue-600" size={20} />
                </div>
                <span className="text-sm font-medium text-gray-700">Select Event:</span>
                <select
                    value={eventFilter}
                    onChange={(e) => { setEventFilter(e.target.value ? Number(e.target.value) : ''); setPage(1); }}
                    className="input-field pr-8 min-w-[250px] font-semibold bg-white"
                >
                    <option value="">All Events</option>
                    {events.map((event) => (
                        <option key={event.id} value={event.id}>{event.name}</option>
                    ))}
                </select>
            </div>

            {/* Header Actions */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-4">
                    <h2 className="text-lg font-semibold text-gray-800">
                        {eventFilter ? `Sessions for ${events.find(e => e.id === eventFilter)?.name || 'Event'}` : 'All Sessions'}
                    </h2>
                    <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg">
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-2 rounded-md transition-colors ${viewMode === 'list' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <IconLayoutList size={20} />
                        </button>
                        <button
                            onClick={() => setViewMode('timeline')}
                            className={`p-2 rounded-md transition-colors ${viewMode === 'timeline' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <IconTimeline size={20} />
                        </button>
                    </div>
                </div>

                <div className="flex gap-4 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search sessions..."
                            value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                            className="input-field-search h-10"
                        />
                    </div>
                    <button
                        onClick={() => { resetForm(); setShowCreateModal(true); }}
                        className="btn-primary flex items-center gap-2 whitespace-nowrap h-10"
                    >
                        <IconPlus size={18} /> Add Session
                    </button>
                </div>
            </div>

            {/* Content */}
            {isLoading ? (
                <div className="flex justify-center py-20">
                    <IconLoader2 size={40} className="animate-spin text-blue-600" />
                </div>
            ) : sessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                    <IconCalendarEvent size={64} className="mb-4 opacity-50" />
                    <p className="text-lg">No sessions found</p>
                </div>
            ) : viewMode === 'list' ? (
                // List View - Workshop-style Cards (Grouped by Main/Sub)
                <div className="space-y-12">
                    {/* Main Sessions Section */}
                    {sessions.filter(s => s.isMainSession).length > 0 && (
                        <div>
                            <div className="flex items-center gap-3 mb-6">
                                <span className="p-2 bg-purple-100 text-purple-600 rounded-lg">
                                    <IconStar size={24} />
                                </span>
                                <div>
                                    <h2 className="text-xl font-bold text-gray-900 leading-tight">Main Sessions</h2>
                                    <p className="text-sm text-gray-500">Keynotes and Plenary sessions</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {sessions.filter(s => s.isMainSession).map((session, index) => renderSessionCard(session, index, true))}
                            </div>
                        </div>
                    )}

                    {/* Sub Sessions Section */}
                    {sessions.filter(s => !s.isMainSession).length > 0 && (
                        <div>
                            <div className="flex items-center gap-3 mb-6">
                                <span className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                                    <IconLayoutList size={24} />
                                </span>
                                <div>
                                    <h2 className="text-xl font-bold text-gray-900 leading-tight">Sub Sessions / Breakouts</h2>
                                    <p className="text-sm text-gray-500">Regular sessions, workshops, and other activities</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {sessions.filter(s => !s.isMainSession).map((session, index) => renderSessionCard(session, index, false))}
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                // Timeline View
                <div className="space-y-4">
                    {sessions.map((session) => (
                        <div key={session.id} className="card flex flex-col md:flex-row gap-4 p-4 animate-fade-in hover:bg-gray-50 transition-colors">
                            <div className="md:w-48 shrink-0 flex flex-row md:flex-col justify-between md:justify-start gap-2 md:border-r md:border-gray-100 md:pr-4">
                                <div>
                                    <p className="font-bold text-gray-800 text-lg">
                                        {new Date(session.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Bangkok' })}
                                    </p>
                                    <p className="text-sm text-gray-500">
                                        {new Date(session.startTime).toLocaleDateString('en-US', { timeZone: 'Asia/Bangkok' })}
                                    </p>
                                </div>
                                <div className="text-right md:text-left">
                                    <p className="text-sm text-gray-400">
                                        to {new Date(session.endTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Bangkok' })}
                                    </p>
                                </div>
                            </div>
                            <div className="flex-1">
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs font-semibold inline-block">
                                                {session.eventCode}
                                            </span>
                                            {session.isMainSession && (
                                                <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-[10px] uppercase font-bold border border-purple-200 flex items-center gap-1">
                                                    <IconStar size={10} /> MAIN
                                                </span>
                                            )}
                                            <span className="bg-gray-100 text-gray-600 text-[10px] px-1.5 py-0.5 rounded uppercase font-bold border border-gray-200">
                                                {session.sessionType?.replace('_', ' ') || 'OTHER'}
                                            </span>
                                        </div>
                                        <h3 className="text-lg font-bold text-gray-800">{session.sessionName}</h3>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => openEditModal(session)} className="text-blue-600 hover:text-blue-800 transition-colors p-1 hover:bg-blue-50 rounded"><IconPencil size={18} /></button>
                                        <button onClick={() => { setSelectedSession(session); setShowDeleteModal(true); }} className="text-red-600 hover:text-red-800 transition-colors p-1 hover:bg-red-50 rounded"><IconTrash size={18} /></button>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 mt-1">
                                    <p className="text-gray-600 text-sm flex items-center gap-1"><IconMapPin size={14} className="text-gray-400" /> {session.room || 'TBA'}</p>
                                    <p className="text-gray-600 text-sm flex items-center gap-1"><IconMicrophone size={14} className="text-gray-400" /> {(session.speakers || []).length} Instructor(s)</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Pagination */}
            {
                totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-8">
                        <button
                            className="px-3 py-1 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:text-gray-400"
                            disabled={page <= 1}
                            onClick={() => setPage(p => p - 1)}
                        >
                            Previous
                        </button>
                        <span className="text-sm text-gray-600">Page {page} of {totalPages}</span>
                        <button
                            className="px-3 py-1 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:text-gray-400"
                            disabled={page >= totalPages}
                            onClick={() => setPage(p => p + 1)}
                        >
                            Next
                        </button>
                    </div>
                )
            }

            {/* Create/Edit Modal */}
            {
                (showCreateModal || showEditModal) && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                                <h3 className="text-xl font-bold text-gray-800">{showCreateModal ? 'Create Session' : 'Edit Session'}</h3>
                                <button onClick={() => { setShowCreateModal(false); setShowEditModal(false); }} className="text-gray-400 hover:text-gray-600">
                                    <IconX size={24} />
                                </button>
                            </div>
                            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Main Session Checkbox - Logic: Show ONLY if it IS Main, OR if No Main exists */}
                                <div className="col-span-2">
                                    {!isSessionsLoading && (formData.isMainSession || !eventSessions.some(s => s.isMainSession && s.id !== selectedSession?.id)) && (
                                        <div className="mb-2">
                                            <label className="flex items-center gap-2 cursor-pointer p-3 border rounded-lg hover:bg-gray-50 bg-blue-50/50 border-blue-100/50">
                                                <input
                                                    type="checkbox"
                                                    className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                                    checked={formData.isMainSession || false}
                                                    onChange={(e) => setFormData({ ...formData, isMainSession: e.target.checked })}
                                                    disabled={formData.isMainSession} // Lock if checked
                                                />
                                                <div>
                                                    <div className="font-medium text-gray-900">
                                                        Main session
                                                        {formData.isMainSession && (
                                                            <span className="ml-2 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                                                                Default (Locked)
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-gray-500">Main sessions appear prominently and are auto-linked to Primary tickets.</div>
                                                </div>
                                            </label>
                                        </div>
                                    )}
                                </div>
                                {/* Event Selection */}
                                <div className="col-span-2 md:col-span-1">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Event *</label>
                                    <select
                                        className="input-field"
                                        value={formData.eventId}
                                        onChange={(e) => setFormData({ ...formData, eventId: Number(e.target.value) })}
                                        disabled={!showCreateModal}
                                    >
                                        {events.map((e) => (
                                            <option key={e.id} value={e.id}>{e.code}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Session Code */}
                                <div className="col-span-2 md:col-span-1">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Session Code *</label>
                                    <input
                                        type="text"
                                        className="input-field"
                                        placeholder="S-001"
                                        value={formData.sessionCode}
                                        onChange={(e) => setFormData({ ...formData, sessionCode: e.target.value })}
                                    />
                                </div>

                                {/* Session Name */}
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Session Name *</label>
                                    <input
                                        type="text"
                                        className="input-field"
                                        placeholder="Enter session name"
                                        value={formData.sessionName}
                                        onChange={(e) => setFormData({ ...formData, sessionName: e.target.value })}
                                    />
                                </div>

                                {/* Session Type */}
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Session Type *</label>
                                    <select
                                        className="input-field"
                                        value={formData.sessionType}
                                        onChange={(e) => setFormData({ ...formData, sessionType: e.target.value })}
                                    >
                                        <option value="workshop">Workshop</option>
                                        <option value="gala_dinner">Gala Dinner</option>
                                        <option value="lecture">Lecture</option>
                                        <option value="ceremony">Ceremony</option>
                                        <option value="break">Break</option>
                                        <option value="other">Other</option>
                                    </select>
                                    <p className="text-xs text-gray-400 mt-1">Select the type of session for proper categorization</p>
                                </div>


                                {/* Session Date - Start Time */}
                                <div className="col-span-2 md:col-span-1">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Time *</label>
                                    <DatePicker
                                        selected={formData.startTime ? new Date(formData.startTime) : null}
                                        onChange={(date: Date | null) => setFormData({ ...formData, startTime: date ? date.toISOString() : '' })}
                                        showTimeSelect
                                        dateFormat="d MMM yyyy, h:mm aa"
                                        className="input-field w-full"
                                        placeholderText="Select start time"
                                        wrapperClassName="w-full"
                                    />
                                </div>

                                {/* Session Date - End Time */}
                                <div className="col-span-2 md:col-span-1">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">End Time *</label>
                                    <DatePicker
                                        selected={formData.endTime ? new Date(formData.endTime) : null}
                                        onChange={(date: Date | null) => setFormData({ ...formData, endTime: date ? date.toISOString() : '' })}
                                        showTimeSelect
                                        dateFormat="d MMM yyyy, h:mm aa"
                                        className="input-field w-full"
                                        placeholderText="Select end time"
                                        wrapperClassName="w-full"
                                    />
                                </div>

                                {/* Room */}
                                <div className="col-span-2 md:col-span-1">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Room</label>
                                    <input
                                        type="text"
                                        className="input-field"
                                        placeholder="Meeting Room 1"
                                        value={formData.room}
                                        onChange={(e) => setFormData({ ...formData, room: e.target.value })}
                                    />
                                </div>

                                {/* Max Capacity (Enrolled) */}
                                <div className="col-span-2 md:col-span-1">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Max Capacity</label>
                                    <input
                                        type="number"
                                        className="input-field"
                                        placeholder="100"
                                        min="0"
                                        value={formData.maxCapacity}
                                        onChange={(e) => setFormData({ ...formData, maxCapacity: Number(e.target.value) })}
                                    />
                                    <p className="text-xs text-gray-400 mt-1">Set to 0 for unlimited capacity</p>
                                </div>

                                {/* Time & Agenda */}
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        <IconClock size={16} className="inline mr-1" /> Time & Agenda
                                    </label>
                                    <p className="text-xs text-gray-500 mb-2">
                                        Add agenda items with time slots (e.g. &quot;1:30 – 2:00 PM&quot; and topic).
                                    </p>
                                    {(formData.agenda || []).map((item, idx) => (
                                        <div key={idx} className="flex items-start gap-2 mb-2">
                                            <div className="w-[30%]">
                                                <input
                                                    type="text"
                                                    className="input-field w-full"
                                                    placeholder="1:30 – 2:00 PM"
                                                    value={item.time}
                                                    onChange={(e) => {
                                                        const updated = [...(formData.agenda || [])];
                                                        updated[idx] = { ...updated[idx], time: e.target.value };
                                                        setFormData({ ...formData, agenda: updated });
                                                    }}
                                                />
                                            </div>
                                            <div className="w-[70%]">
                                                <input
                                                    type="text"
                                                    className="input-field w-full"
                                                    placeholder="Topic description"
                                                    value={item.topic}
                                                    onChange={(e) => {
                                                        const updated = [...(formData.agenda || [])];
                                                        updated[idx] = { ...updated[idx], topic: e.target.value };
                                                        setFormData({ ...formData, agenda: updated });
                                                    }}
                                                />
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const updated = (formData.agenda || []).filter((_, i) => i !== idx);
                                                    setFormData({ ...formData, agenda: updated });
                                                }}
                                                className="text-red-400 hover:text-red-600 mt-2"
                                            >
                                                <IconTrash size={16} />
                                            </button>
                                        </div>
                                    ))}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setFormData({
                                                ...formData,
                                                agenda: [...(formData.agenda || []), { time: '', topic: '' }],
                                            });
                                        }}
                                        className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1 mt-1"
                                    >
                                        <IconPlus size={14} /> Add agenda item
                                    </button>
                                </div>

                                {/* Instructor(s) - formerly Speakers */}
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        <IconMicrophone size={16} className="inline mr-1" /> Instructor(s)
                                    </label>
                                    <div className="border border-gray-200 rounded-lg max-h-40 overflow-y-auto">
                                        {speakers.length === 0 ? (
                                            <p className="p-3 text-sm text-gray-400">No instructors available</p>
                                        ) : (
                                            speakers.map(speaker => (
                                                <label key={speaker.id} className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0">
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.selectedSpeakerIds.includes(speaker.id)}
                                                        onChange={() => {
                                                            const ids = formData.selectedSpeakerIds.includes(speaker.id)
                                                                ? formData.selectedSpeakerIds.filter(id => id !== speaker.id)
                                                                : [...formData.selectedSpeakerIds, speaker.id];
                                                            setFormData({ ...formData, selectedSpeakerIds: ids });
                                                        }}
                                                        className="w-4 h-4 text-blue-600 rounded"
                                                    />
                                                    <div>
                                                        <p className="font-medium text-sm">{speaker.firstName} {speaker.lastName}</p>
                                                        {speaker.organization && (
                                                            <p className="text-xs text-gray-500">{speaker.organization}</p>
                                                        )}
                                                    </div>
                                                </label>
                                            ))
                                        )}
                                    </div>
                                    <p className="text-xs text-gray-400 mt-1">
                                        Selected: {formData.selectedSpeakerIds.length} instructor(s)
                                    </p>
                                </div>

                                {/* Learning Objectives - formerly Description */}
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        <IconTargetArrow size={16} className="inline mr-1" /> Learning Objectives
                                    </label>
                                    <textarea
                                        className="input-field h-24"
                                        placeholder="Describe the learning objectives for this session..."
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    />
                                </div>                               
                            </div>
                            <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
                                <button onClick={() => { setShowCreateModal(false); setShowEditModal(false); }} className="btn-secondary" disabled={isSubmitting}>Cancel</button>
                                <button
                                    onClick={showCreateModal ? handleCreate : handleUpdate}
                                    className="btn-primary"
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? 'Saving...' : showCreateModal ? 'Create Session' : 'Save Changes'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Delete Modal */}
            {
                showDeleteModal && selectedSession && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-2xl max-w-md w-full">
                            <div className="p-6 bg-red-600 rounded-t-2xl text-white">
                                <h3 className="text-lg font-bold flex items-center gap-2">
                                    <IconTrash size={24} /> Delete Session
                                </h3>
                            </div>
                            <div className="p-6 text-center">
                                <p className="mb-2 text-gray-900 font-medium">Are you sure you want to delete this session?</p>
                                <p className="font-bold text-gray-900 text-lg">{selectedSession.sessionName}</p>
                                <p className="text-gray-700 text-sm mb-4">{selectedSession.sessionCode}</p>
                            </div>
                            <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
                                <button onClick={() => setShowDeleteModal(false)} className="btn-secondary" disabled={isSubmitting}>Cancel</button>
                                <button onClick={handleDelete} className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700" disabled={isSubmitting}>
                                    {isSubmitting ? 'Deleting...' : 'Delete Session'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* View Details Modal - Read Only */}
            {
                showViewModal && selectedSession && (() => {
                    const colors = ['#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#6366F1'];
                    const sessionIndex = sessions.findIndex(s => s.id === selectedSession.id);
                    const sessionColor = colors[sessionIndex % colors.length];
                    const start = new Date(selectedSession.startTime);
                    const end = new Date(selectedSession.endTime);
                    const diffMs = end.getTime() - start.getTime();
                    const diffMins = Math.round(diffMs / 60000);
                    const hours = Math.floor(diffMins / 60);
                    const mins = diffMins % 60;
                    const duration = hours > 0 ? `${hours}h ${mins > 0 ? mins + 'm' : ''}` : `${mins}m`;

                    return (
                        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                                {/* Header with gradient */}
                                <div
                                    style={{
                                        background: `linear-gradient(135deg, ${sessionColor} 0%, ${sessionColor}dd 100%)`,
                                        color: 'white',
                                        padding: '25px'
                                    }}
                                    className="rounded-t-2xl"
                                >
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '15px' }}>
                                        <div
                                            style={{
                                                width: '50px',
                                                height: '50px',
                                                backgroundColor: 'rgba(255,255,255,0.2)',
                                                borderRadius: '12px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                flexShrink: 0
                                            }}
                                        >
                                            <IconCalendarEvent size={22} />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <span
                                                style={{
                                                    backgroundColor: 'rgba(255,255,255,0.2)',
                                                    padding: '3px 10px',
                                                    borderRadius: '10px',
                                                    fontSize: '11px',
                                                    fontWeight: 600
                                                }}
                                            >
                                                {selectedSession.sessionCode}
                                            </span>
                                            <h3 className="text-xl font-bold mt-2">{selectedSession.sessionName}</h3>
                                        </div>
                                        <button
                                            onClick={() => setShowViewModal(false)}
                                            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                                        >
                                            <IconX size={20} />
                                        </button>
                                    </div>
                                </div>

                                {/* Content */}
                                <div className="p-6">
                                    {/* Info Grid */}
                                    <div className="grid grid-cols-2 gap-4 mb-6">
                                        <div className="bg-gray-50 p-4 rounded-lg">
                                            <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Session Date</p>
                                            <p className="font-semibold text-gray-800">
                                                {start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Bangkok' })}
                                            </p>
                                            <p className="text-sm text-gray-600">
                                                {start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Bangkok' })} - {end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Bangkok' })}
                                            </p>
                                        </div>
                                        <div className="bg-gray-50 p-4 rounded-lg">
                                            <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Duration</p>
                                            <p className="font-semibold text-gray-800">{duration}</p>
                                        </div>
                                        <div className="bg-gray-50 p-4 rounded-lg">
                                            <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Room</p>
                                            <p className="font-semibold text-gray-800">{selectedSession.room || 'TBA'}</p>
                                        </div>
                                        <div className="bg-gray-50 p-4 rounded-lg">
                                            <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Session Price</p>
                                            <p className="font-bold text-lg" style={{ color: sessionColor }}>Included</p>
                                        </div>
                                    </div>

                                    {/* Instructors */}
                                    <div className="mb-6">
                                        <p className="text-xs text-gray-500 uppercase font-semibold mb-3 flex items-center gap-2">
                                            <IconMicrophone size={14} /> Instructor(s)
                                        </p>
                                        <div className="bg-gray-50 p-4 rounded-lg">
                                            {(selectedSession.speakers || []).length > 0 ? (
                                                <div className="space-y-2">
                                                    {selectedSession.speakers.map((speaker, i) => (
                                                        <p key={i} className="font-semibold text-gray-800">{speaker}</p>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-gray-400 italic">No instructors assigned</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Learning Objectives */}
                                    <div className="mb-6">
                                        <p className="text-xs text-gray-500 uppercase font-semibold mb-3 flex items-center gap-2">
                                            <IconTargetArrow size={14} /> Learning Objectives
                                        </p>
                                        <div className="bg-gray-50 p-4 rounded-lg">
                                            {selectedSession.description ? (
                                                <p className="text-gray-700 leading-relaxed" style={{ whiteSpace: 'pre-line' }}>{selectedSession.description}</p>
                                            ) : (
                                                <p className="text-gray-400 italic">No objectives specified</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Enrollment Info */}
                                    <div className="mb-6">
                                        <p className="text-xs text-gray-500 uppercase font-semibold mb-3 flex items-center gap-2">
                                            <IconUsers size={14} /> Enrollment ({enrollments.length}/{selectedSession.maxCapacity || '∞'})
                                        </p>
                                        <div className="bg-gray-50 p-4 rounded-lg">
                                            {/* Progress bar */}
                                            {selectedSession.maxCapacity > 0 && (
                                                <div className="mb-4">
                                                    <div className="flex justify-between text-sm mb-1">
                                                        <span className="font-semibold text-gray-700">{enrollments.length} enrolled</span>
                                                        <span className="text-gray-500">{selectedSession.maxCapacity} max</span>
                                                    </div>
                                                    <div className="bg-gray-200 h-2 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full rounded-full transition-all"
                                                            style={{
                                                                width: `${Math.min(100, (enrollments.length / selectedSession.maxCapacity) * 100)}%`,
                                                                backgroundColor: sessionColor
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            {/* Enrolled Users List */}
                                            {enrollmentsLoading ? (
                                                <div className="text-center py-4">
                                                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-blue-600"></div>
                                                    <p className="text-gray-500 text-sm mt-2">Loading enrolled users...</p>
                                                </div>
                                            ) : enrollments.length > 0 ? (
                                                <div className="space-y-2 max-h-60 overflow-y-auto">
                                                    {enrollments.map((enrollment, idx) => (
                                                        <div
                                                            key={enrollment.id}
                                                            className="flex items-center justify-between bg-white p-3 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors"
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <div
                                                                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
                                                                    style={{ backgroundColor: sessionColor }}
                                                                >
                                                                    {idx + 1}
                                                                </div>
                                                                <div>
                                                                    <p className="font-semibold text-gray-800">
                                                                        {enrollment.firstName} {enrollment.lastName}
                                                                    </p>
                                                                    <p className="text-xs text-gray-500">{enrollment.email}</p>
                                                                </div>
                                                            </div>
                                                            <div className="text-right">
                                                                <span className={`inline-block px-2 py-1 text-xs rounded-full font-medium ${enrollment.status === 'confirmed'
                                                                    ? 'bg-green-100 text-green-700'
                                                                    : 'bg-gray-100 text-gray-600'
                                                                    }`}>
                                                                    {enrollment.status}
                                                                </span>
                                                                <p className="text-xs text-gray-400 mt-1">{enrollment.regCode}</p>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-gray-400 italic text-center py-4">No one enrolled yet</p>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Footer */}
                                <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
                                    <button
                                        onClick={() => setShowViewModal(false)}
                                        className="btn-secondary"
                                    >
                                        Close
                                    </button>
                                    <button
                                        onClick={() => {
                                            setShowViewModal(false);
                                            openEditModal(selectedSession);
                                        }}
                                        className="btn-primary flex items-center gap-2"
                                    >
                                        <IconPencil size={16} /> Edit Session
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })()
            }

        </AdminLayout >
    );
}
