"use client";

import { useState, useEffect, useRef } from "react";
import { AdminLayout } from "@/components/layout";
import { api } from "@/lib/api";
import toast from "react-hot-toast";
import {
  IconMicrophone,
  IconPlus,
  IconPencil,
  IconTrash,
  IconSearch,
  IconCheck,
  IconX,
  IconBrandLinkedin,
  IconWorld,
  IconLoader2,
  IconPhoto,
  IconCalendarEvent,
  IconUpload,
} from "@tabler/icons-react";
import { useAuth } from "@/contexts/AuthContext";

// Mock stats colors (can be real if we add status to schema later, currently schema doesn't have status for speaker itself, only in relation)
const statusColors: { [key: string]: string } = {
  confirmed: "bg-green-100 text-green-700",
  pending: "bg-yellow-100 text-yellow-700",
  declined: "bg-red-100 text-red-700",
};

interface Speaker {
  id: number;
  firstName: string;
  lastName: string;
  bio: string | null;
  organization: string | null;
  position: string | null;
  photoUrl: string | null;
  createdAt: string;
  // topics? - frontend assumes topics, schema doesn't have it explicitly yet on speaker
  // actually schema: firstName, lastName, ...
}

interface Event {
  id: number;
  eventCode: string;
  eventName: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL;

const getBackofficeToken = () =>
  localStorage.getItem("backoffice_token") ||
  sessionStorage.getItem("backoffice_token") ||
  "";

export default function SpeakersPage() {
  const { isAdmin, user } = useAuth();
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [eventFilter, setEventFilter] = useState<number | null>(null);
  const [sessionFilter, setSessionFilter] = useState<number | null>(null);
  const [allSessions, setAllSessions] = useState<any[]>([]);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedSpeaker, setSelectedSpeaker] = useState<Speaker | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    title: "",
    organization: "",
    bio: "",
    photoUrl: "",
    assignments: [] as { eventId: number; sessionId: number | null }[],
  });

  useEffect(() => {
    fetchSpeakers();
    fetchEvents();
    fetchAllSessions();
  }, [eventFilter, sessionFilter]);

  const fetchEvents = async () => {
    try {
      const token = getBackofficeToken();
      const res = await api.backofficeEvents.list(token);
      setEvents(
        (res.events || []).map((e: Record<string, unknown>) => ({
          id: e.id as number,
          eventCode: e.eventCode as string,
          eventName: e.eventName as string,
        })) as Event[],
      );
    } catch (error) {
      console.error("Failed to fetch events:", error);
    }
  };

  const fetchAllSessions = async () => {
    try {
      const token = getBackofficeToken();
      const res = await api.sessions.list(token, "limit=1000");
      setAllSessions(res.sessions || []);
    } catch (error) {
      console.error("Failed to fetch all sessions:", error);
    }
  };

  const [speakerAssignmentMap, setSpeakerAssignmentMap] = useState<{
    [speakerId: number]: { eventId: number; sessionId: number | null }[];
  }>({});

  const fetchSpeakers = async () => {
    setIsLoading(true);
    try {
      const token = getBackofficeToken();
      const params = new URLSearchParams();
      if (eventFilter) params.append("eventId", eventFilter.toString());
      if (sessionFilter) params.append("sessionId", sessionFilter.toString());

      const data = await api.speakers.list(token, params.toString());
      setSpeakers((data.speakers || []) as unknown as Speaker[]);

      // Build speaker -> assignments map
      const map: {
        [speakerId: number]: { eventId: number; sessionId: number | null }[];
      } = {};
      (data.eventSpeakers || []).forEach((es: any) => {
        if (!map[es.speakerId]) map[es.speakerId] = [];
        map[es.speakerId].push({
          eventId: es.eventId,
          sessionId: es.sessionId,
        });
      });
      setSpeakerAssignmentMap(map);
    } catch (error) {
      console.error("Failed to fetch speakers:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const token = getBackofficeToken();
      const data = await api.uploadFile(token, file, "speakers");
      setFormData({ ...formData, photoUrl: data.url });
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload image");
    } finally {
      setIsUploading(false);
    }
  };

  const filteredSpeakers = speakers.filter((speaker) => {
    const fullName = `${speaker.firstName} ${speaker.lastName}`.toLowerCase();
    const search = searchTerm.toLowerCase();
    return (
      fullName.includes(search) ||
      (speaker.organization?.toLowerCase() || "").includes(search)
    );
  });

  const resetForm = () => {
    setFormData({
      firstName: "",
      lastName: "",
      title: "",
      organization: "",
      bio: "",
      photoUrl: "",
      assignments: [],
    });
  };

  const openEditModal = (speaker: Speaker) => {
    setSelectedSpeaker(speaker);
    setFormData({
      firstName: speaker.firstName,
      lastName: speaker.lastName,
      title: speaker.position || "",
      organization: speaker.organization || "",
      bio: speaker.bio || "",
      photoUrl: speaker.photoUrl || "",
      assignments: speakerAssignmentMap[speaker.id] || [],
    });
    setShowEditModal(true);
  };

  const handleCreate = async () => {
    setIsSubmitting(true);
    try {
      const token = getBackofficeToken();
      const payload = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        organization: formData.organization,
        position: formData.title,
        bio: formData.bio,
        photoUrl: formData.photoUrl,
      };
      const result = await api.speakers.create(token, payload);

      // Assign speaker to sessions/events if any selected
      if (result?.speaker?.id && formData.assignments.length > 0) {
        await api.speakers.assignEvents(
          token,
          result.speaker.id as number,
          formData.assignments,
        );
      }

      await fetchSpeakers();
      setShowCreateModal(false);
      resetForm();
    } catch (error) {
      toast.error("Failed to create speaker");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!selectedSpeaker) return;
    setIsSubmitting(true);
    try {
      const token = getBackofficeToken();
      const payload = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        organization: formData.organization,
        position: formData.title,
        bio: formData.bio,
        photoUrl: formData.photoUrl,
      };
      await api.speakers.update(token, selectedSpeaker.id, payload);

      // Update speaker assignments
      await api.speakers.assignEvents(
        token,
        selectedSpeaker.id,
        formData.assignments,
      );

      await fetchSpeakers();
      setShowEditModal(false);
      setSelectedSpeaker(null);
    } catch (error) {
      toast.error("Failed to update speaker");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedSpeaker) return;
    setIsSubmitting(true);
    try {
      const token = getBackofficeToken();
      await api.speakers.delete(token, selectedSpeaker.id);
      setSpeakers(speakers.filter((s) => s.id !== selectedSpeaker.id));
      setShowDeleteModal(false);
      setSelectedSpeaker(null);
    } catch (error) {
      toast.error("Failed to delete speaker");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper to get reliable image URL from Google Drive via our proxy
  const getSpeakerImageUrl = (url: string) => {
    if (!url) return "";

    // If it's a Google Drive URL, use our proxy
    if (url.includes("drive.google.com")) {
      return `${API_URL}/upload/proxy?url=${encodeURIComponent(url)}`;
    }

    return url;
  };

  return (
    <AdminLayout title="Speakers">
      {/* Event Filter - Above Card */}
      <div className="mb-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-4 flex items-center gap-3">
        <div className="bg-blue-100 p-2 rounded-lg">
          <IconCalendarEvent className="text-blue-600" size={20} />
        </div>
        <span className="text-sm font-medium text-gray-700">Select Event:</span>
        <select
          value={eventFilter || ""}
          onChange={(e) => {
            const val = e.target.value ? parseInt(e.target.value) : null;
            setEventFilter(val);
            setSessionFilter(null);
          }}
          className="input-field pr-8 min-w-[200px] font-semibold bg-white"
        >
          <option value="">All Events</option>
          {events.map((event) => (
            <option key={event.id} value={event.id}>
              {event.eventName}
            </option>
          ))}
        </select>

        <span className="text-sm font-medium text-gray-700 ml-4">
          Select Session:
        </span>
        <select
          value={sessionFilter || ""}
          onChange={(e) =>
            setSessionFilter(e.target.value ? parseInt(e.target.value) : null)
          }
          className="input-field pr-8 min-w-[200px] font-semibold bg-white disabled:opacity-50"
          disabled={!eventFilter}
        >
          <option value="">All Sessions</option>
          {allSessions
            .filter((s) => !eventFilter || s.eventId === eventFilter)
            .map((session) => (
              <option key={session.id} value={session.id}>
                {session.sessionName} ({session.sessionCode})
              </option>
            ))}
        </select>
      </div>

      {/* Main Content */}
      <div className="card">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <IconMicrophone size={20} className="text-blue-600" />
            {eventFilter
              ? `Speakers for ${events.find((e) => e.id === eventFilter)?.eventName || "Event"}`
              : "All Speakers"}
          </h2>
          <button
            onClick={() => {
              resetForm();
              setShowCreateModal(true);
            }}
            className="btn-primary flex items-center gap-2"
          >
            <IconPlus size={18} /> Add Speaker
          </button>
        </div>

        {/* Search Filter */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <IconSearch
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 z-10 pointer-events-none"
              size={18}
            />
            <input
              type="text"
              placeholder="Search speakers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field-search"
            />
          </div>
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <IconLoader2 size={32} className="animate-spin text-blue-600" />
          </div>
        ) : speakers.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No speakers found. Add one to get started.
          </div>
        ) : (
          /* Speaker Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSpeakers.map((speaker) => (
              <div
                key={speaker.id}
                className="border border-gray-100 rounded-xl p-4 hover:shadow-md transition-shadow"
              >
                {/* Event badges - at top for visibility */}
                {speakerAssignmentMap[speaker.id]?.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-1">
                    {speakerAssignmentMap[speaker.id].map((asgn, idx) => {
                      const event = events.find((e) => e.id === asgn.eventId);
                      const session = allSessions.find(
                        (s) => s.id === asgn.sessionId,
                      );
                      return event ? (
                        <span
                          key={`${asgn.eventId}-${asgn.sessionId}-${idx}`}
                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full border border-blue-100"
                          title={
                            session
                              ? `Session: ${session.sessionName}`
                              : "Event assignment"
                          }
                        >
                          <IconCalendarEvent size={12} />
                          {event.eventCode}
                          {session && (
                            <>
                              {" "}
                              -{" "}
                              <span className="font-bold">
                                {session.sessionCode}
                              </span>
                            </>
                          )}
                        </span>
                      ) : null;
                    })}
                  </div>
                )}
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white text-xl font-bold flex-shrink-0 overflow-hidden">
                    {speaker.photoUrl ? (
                      <img
                        src={getSpeakerImageUrl(speaker.photoUrl)}
                        alt={speaker.firstName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      speaker.firstName.charAt(0)
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-gray-800 truncate">
                          {speaker.firstName} {speaker.lastName}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {speaker.position}
                        </p>
                        <p className="text-xs text-gray-400">
                          {speaker.organization}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-4">
                  <p className="text-sm text-gray-600 line-clamp-2">
                    {speaker.bio}
                  </p>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-100 flex justify-end items-center">
                  <div className="flex gap-1">
                    <button
                      onClick={() => openEditModal(speaker)}
                      className="p-1.5 hover:bg-blue-50 rounded text-blue-600"
                      title="Edit"
                    >
                      <IconPencil size={18} />
                    </button>
                    <button
                      onClick={() => {
                        setSelectedSpeaker(speaker);
                        setShowDeleteModal(true);
                      }}
                      className="p-1.5 hover:bg-red-50 rounded text-red-600"
                      title="Delete"
                    >
                      <IconTrash size={18} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {(showCreateModal || showEditModal) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <IconMicrophone size={20} />{" "}
                  {showCreateModal ? "Add Speaker" : "Edit Speaker"}
                </h3>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setShowEditModal(false);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <IconX size={20} />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    First Name *
                  </label>
                  <textarea
                    className="input-field min-h-[42px]"
                    value={formData.firstName}
                    onChange={(e) =>
                      setFormData({ ...formData, firstName: e.target.value })
                    }
                    rows={2}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    value={formData.lastName}
                    onChange={(e) =>
                      setFormData({ ...formData, lastName: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Title/Position
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Dean"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Organization
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="University"
                    value={formData.organization}
                    onChange={(e) =>
                      setFormData({ ...formData, organization: e.target.value })
                    }
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bio
                </label>
                <textarea
                  className="input-field h-24"
                  placeholder="Brief biography..."
                  value={formData.bio}
                  onChange={(e) =>
                    setFormData({ ...formData, bio: e.target.value })
                  }
                />
              </div>

              {/* Image Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <IconPhoto size={16} className="inline mr-1" /> Photo
                </label>
                <div className="flex items-center gap-4">
                  {formData.photoUrl ? (
                    <div className="relative">
                      <img
                        src={formData.photoUrl}
                        alt="Speaker"
                        className="w-20 h-20 rounded-full object-cover border-2 border-gray-200"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setFormData({ ...formData, photoUrl: "" })
                        }
                        className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5"
                      >
                        <IconX size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center text-gray-400">
                      <IconPhoto size={24} />
                    </div>
                  )}
                  <div>
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageUpload(file);
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="btn-secondary flex items-center gap-2 text-sm"
                    >
                      {isUploading ? (
                        <>
                          <IconLoader2 size={16} className="animate-spin" />{" "}
                          Uploading...
                        </>
                      ) : (
                        <>
                          <IconUpload size={16} /> Upload Photo
                        </>
                      )}
                    </button>
                    <p className="text-xs text-gray-400 mt-1">
                      Max 5MB, JPG/PNG
                    </p>
                  </div>
                </div>
              </div>

              {/* Session Assignment */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <IconCalendarEvent size={16} className="inline mr-1" /> Assign
                  to Sessions
                </label>
                <div className="border border-gray-200 rounded-lg max-h-60 overflow-y-auto divide-y divide-gray-100">
                  {events.length === 0 ? (
                    <p className="p-3 text-sm text-gray-400">
                      No events available
                    </p>
                  ) : (
                    events.map((event) => {
                      const eventSessions = allSessions.filter(
                        (s) => s.eventId === event.id,
                      );
                      const isEventSelected = formData.assignments.some(
                        (a) => a.eventId === event.id && a.sessionId === null,
                      );

                      return (
                        <div key={event.id} className="p-3 bg-gray-50/50">
                          <label className="flex items-center gap-3 cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={isEventSelected}
                              onChange={() => {
                                const exists = formData.assignments.some(
                                  (a) =>
                                    a.eventId === event.id &&
                                    a.sessionId === null,
                                );
                                const otherAssignments =
                                  formData.assignments.filter(
                                    (a) =>
                                      !(
                                        a.eventId === event.id &&
                                        a.sessionId === null
                                      ),
                                  );

                                setFormData({
                                  ...formData,
                                  assignments: exists
                                    ? otherAssignments
                                    : [
                                        ...otherAssignments,
                                        { eventId: event.id, sessionId: null },
                                      ],
                                });
                              }}
                              className="w-4 h-4 text-blue-600 rounded border-gray-300"
                            />
                            <div className="flex-1">
                              <p className="font-bold text-sm text-blue-700">
                                {event.eventCode}
                              </p>
                              <p className="text-xs text-gray-500">
                                {event.eventName}
                              </p>
                            </div>
                            <span className="text-[10px] font-bold text-gray-400 border border-gray-200 px-1 rounded bg-white">
                              EVENT
                            </span>
                          </label>

                          {/* Sessions for this event */}
                          {eventSessions.length > 0 && (
                            <div className="mt-2 ml-7 space-y-2 border-l-2 border-gray-100 pl-3">
                              {eventSessions.map((session) => {
                                const isSessionSelected =
                                  formData.assignments.some(
                                    (a) => a.sessionId === session.id,
                                  );
                                return (
                                  <label
                                    key={session.id}
                                    className="flex items-center gap-3 cursor-pointer group"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isSessionSelected}
                                      onChange={() => {
                                        const exists =
                                          formData.assignments.some(
                                            (a) => a.sessionId === session.id,
                                          );
                                        const otherAssignments =
                                          formData.assignments.filter(
                                            (a) => a.sessionId !== session.id,
                                          );

                                        setFormData({
                                          ...formData,
                                          assignments: exists
                                            ? otherAssignments
                                            : [
                                                ...otherAssignments,
                                                {
                                                  eventId: event.id,
                                                  sessionId: session.id,
                                                },
                                              ],
                                        });
                                      }}
                                      className="w-4 h-4 text-indigo-600 rounded border-gray-300"
                                    />
                                    <div>
                                      <p className="text-xs font-semibold text-gray-700">
                                        {session.sessionName}
                                      </p>
                                      <p className="text-[10px] text-gray-400 font-mono">
                                        {session.sessionCode}
                                      </p>
                                    </div>
                                  </label>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Selected: {formData.assignments.length} assignment(s)
                </p>
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setShowEditModal(false);
                }}
                className="btn-secondary"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                onClick={showCreateModal ? handleCreate : handleEdit}
                className="btn-primary flex items-center gap-2"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <IconLoader2 size={18} className="animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <IconCheck size={18} />{" "}
                    {showCreateModal ? "Add Speaker" : "Save Changes"}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && selectedSpeaker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full">
            <div className="p-6 bg-red-600 rounded-t-2xl">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <IconTrash size={20} /> Remove Speaker
              </h3>
            </div>
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <IconTrash size={32} className="text-red-600" />
              </div>
              <p className="mb-2">
                Are you sure you want to remove this speaker?
              </p>
              <p className="font-semibold text-gray-800">
                {selectedSpeaker.firstName} {selectedSpeaker.lastName}
              </p>
              <p className="text-sm text-gray-500">
                {selectedSpeaker.organization}
              </p>
            </div>
            <div className="p-6 border-t border-gray-100 flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="btn-secondary"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 flex items-center gap-2"
                disabled={isSubmitting}
              >
                {isSubmitting && (
                  <IconLoader2 size={18} className="animate-spin" />
                )}
                Remove Speaker
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
