"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { AdminLayout } from "@/components/layout";
import { api } from "@/lib/api";
import { useDebounce } from "@/hooks/useDebounce";
import toast from "react-hot-toast";
import { Pagination } from "@/components/common";
import {
  IconCalendarEvent,
  IconCheck,
  IconFileText,
  IconUsers,
  IconSearch,
  IconEye,
  IconPencil,
  IconTrash,
  IconPlus,
  IconX,
  IconAlertTriangle,
  IconLoader2,
} from "@tabler/icons-react";

const statusColors: { [key: string]: string } = {
  published: "badge-success",
  draft: "badge-warning",
  cancelled: "badge-error",
  completed: "badge-info",
};

const typeLabels: { [key: string]: { label: string; className: string } } = {
  multi_session: {
    label: "Multi Session",
    className: "bg-purple-100 text-purple-800",
  },
  single_room: { label: "Single Room", className: "bg-gray-100 text-gray-800" },
};

const getBackofficeToken = () =>
  localStorage.getItem("backoffice_token") ||
  sessionStorage.getItem("backoffice_token") ||
  "";

interface Event {
  id: number;
  eventCode: string;
  eventName: string;
  location: string | null;
  startDate: string;
  endDate: string;
  eventType: string;
  maxCapacity: number | null;
  status: string;
  imageUrl: string | null;
}

// Helper function to format date
const formatDate = (dateStr: string): string => {
  if (!dateStr) return "-";
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "Asia/Bangkok",
    });
  } catch {
    return dateStr;
  }
};

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Debounce search term to avoid API calls on every keystroke
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Fetch events
  useEffect(() => {
    const fetchEvents = async () => {
      setIsLoading(true);
      setError("");
      try {
        const token = getBackofficeToken();
        const params: any = { page, limit: 10 };
        if (statusFilter) params.status = statusFilter;
        if (typeFilter) params.eventType = typeFilter;
        if (debouncedSearchTerm) params.search = debouncedSearchTerm;

        const response = await api.backofficeEvents.list(
          token,
          new URLSearchParams(params).toString(),
        );
        setEvents(response.events as unknown as Event[]);
        setTotalPages(response.pagination.totalPages);
        setTotalCount(response.pagination.total);
      } catch (err: any) {
        setError(err.message || "Failed to fetch events");
      } finally {
        setIsLoading(false);
      }
    };

    fetchEvents();
  }, [page, statusFilter, typeFilter, debouncedSearchTerm]);

  // Calculate stats (published/draft are page-level counts)
  const stats = {
    total: totalCount,
    published: events.filter((e) => e.status === "published").length,
    draft: events.filter((e) => e.status === "draft").length,
    showing: events.length,
  };

  const handleDelete = async () => {
    if (!selectedEvent) return;
    setIsDeleting(true);
    try {
      const token = getBackofficeToken();
      await api.backofficeEvents.delete(token, selectedEvent.id);
      setEvents(events.filter((e) => e.id !== selectedEvent.id));
      setShowDeleteModal(false);
      setSelectedEvent(null);
      toast.success("Event deleted successfully");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete event");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AdminLayout title="Events Management">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="card py-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
              <IconCalendarEvent size={24} stroke={1.5} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
              <p className="text-sm text-gray-500">Total Events</p>
            </div>
          </div>
        </div>
        <div className="card py-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center text-green-600">
              <IconCheck size={24} stroke={1.5} />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">
                {stats.published}
              </p>
              <p className="text-sm text-gray-500">Published (this page)</p>
            </div>
          </div>
        </div>
        <div className="card py-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center text-yellow-600">
              <IconFileText size={24} stroke={1.5} />
            </div>
            <div>
              <p className="text-2xl font-bold text-yellow-600">
                {stats.draft}
              </p>
              <p className="text-sm text-gray-500">Draft (this page)</p>
            </div>
          </div>
        </div>
        <div className="card py-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center text-purple-600">
              <IconUsers size={24} stroke={1.5} />
            </div>
            <div>
              <p className="text-2xl font-bold text-purple-600">-</p>
              <p className="text-sm text-gray-500">Total Registrations</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-800">All Events</h2>
          <Link
            href="/events/create"
            className="btn-primary flex items-center gap-2"
          >
            <IconPlus size={18} /> Create Event
          </Link>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <IconSearch
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              size={18}
            />
            <input
              type="text"
              placeholder="Search events..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="input-field-search"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="input-field w-auto"
          >
            <option value="">All Status</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
            <option value="cancelled">Cancelled</option>
            <option value="completed">Completed</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
            className="input-field w-auto"
          >
            <option value="">All Types</option>
            <option value="single_room">Single Room</option>
            <option value="multi_session">Multi Session</option>
          </select>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-4">
            {error}
          </div>
        )}

        {/* Loading State */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <IconLoader2 size={32} className="animate-spin text-blue-600" />
            <span className="ml-2 text-gray-500">Loading events...</span>
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No events found.{" "}
            <Link
              href="/events/create"
              className="text-blue-600 hover:underline"
            >
              Create one
            </Link>
          </div>
        ) : (
          /* Table */
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider w-16">
                    ID
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Event
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Capacity
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider w-[120px]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {events.map((event) => (
                  <tr
                    key={event.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-4 text-center">
                      <span className="font-mono text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
                        {event.id}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
                          <IconCalendarEvent size={20} stroke={1.5} />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {event.eventName}
                          </p>
                          <p className="text-sm text-gray-500">
                            {event.eventCode}
                          </p>
                          {event.location && (
                            <p className="text-xs text-gray-400">
                              {event.location}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className="text-sm text-gray-600">
                        {formatDate(event.startDate)}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span
                        className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${typeLabels[event.eventType]?.className || "bg-gray-100 text-gray-700"}`}
                      >
                        {typeLabels[event.eventType]?.label || event.eventType}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className="text-sm text-gray-600">
                        {event.maxCapacity || "-"}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span
                        className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[event.status] || "bg-gray-100 text-gray-700"}`}
                      >
                        {event.status.charAt(0).toUpperCase() +
                          event.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <div className="flex gap-1 justify-center items-center">
                        <button
                          className="p-2 hover:bg-blue-50 rounded-lg text-gray-500 hover:text-blue-600 transition-colors"
                          title="View Details"
                          onClick={() => {
                            setSelectedEvent(event);
                            setShowViewModal(true);
                          }}
                        >
                          <IconEye size={18} />
                        </button>
                        <Link
                          href={`/events/${event.id}/edit`}
                          className="p-2 hover:bg-yellow-50 rounded-lg text-gray-500 hover:text-yellow-600 transition-colors"
                          title="Edit"
                        >
                          <IconPencil size={18} />
                        </Link>
                        <button
                          className="p-2 hover:bg-red-50 rounded-lg text-gray-500 hover:text-red-600 transition-colors"
                          title="Delete"
                          onClick={() => {
                            setSelectedEvent(event);
                            setShowDeleteModal(true);
                          }}
                        >
                          <IconTrash size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              totalCount={totalCount}
              onPageChange={setPage}
              itemName="events"
            />
          </div>
        )}
      </div>

      {/* View Modal */}
      {showViewModal && selectedEvent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  Event Details
                </h3>
                <button
                  onClick={() => setShowViewModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <IconX size={20} />
                </button>
              </div>
            </div>
            <div className="p-6">
              <div className="flex gap-6">
                <div className="w-32 h-32 bg-gray-100 rounded-xl flex items-center justify-center">
                  <IconCalendarEvent
                    size={48}
                    className="text-gray-400"
                    stroke={1.5}
                  />
                </div>
                <div className="flex-1">
                  <h4 className="text-xl font-semibold text-gray-800">
                    {selectedEvent.eventName}
                  </h4>
                  <p className="text-gray-500 mb-4">
                    {selectedEvent.eventCode}
                  </p>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">Type</p>
                      <p className="font-medium text-gray-900">
                        {typeLabels[selectedEvent.eventType]?.label}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Date</p>
                      <p className="font-medium text-gray-900">
                        {formatDate(selectedEvent.startDate)}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Location</p>
                      <p className="font-medium text-gray-900">
                        {selectedEvent.location || "TBD"}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Capacity</p>
                      <p className="font-medium text-gray-900">
                        {selectedEvent.maxCapacity || "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Status</p>
                      <span
                        className={`badge ${statusColors[selectedEvent.status]}`}
                      >
                        {selectedEvent.status}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 flex gap-3 justify-end">
              <button
                onClick={() => setShowViewModal(false)}
                className="btn-secondary"
              >
                Close
              </button>
              <Link
                href={`/events/${selectedEvent.id}/edit`}
                className="btn-primary flex items-center gap-2"
              >
                <IconPencil size={18} /> Edit Event
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && selectedEvent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full">
            <div className="p-6 bg-red-600 rounded-t-2xl">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <IconTrash size={20} /> Delete Event
              </h3>
            </div>
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <IconAlertTriangle size={32} className="text-red-600" />
              </div>
              <p className="mb-2 text-gray-700">
                Are you sure you want to delete this event?
              </p>
              <p className="font-semibold text-gray-800">
                {selectedEvent.eventName}
              </p>
              <p className="text-sm text-gray-500 mt-4">
                This action cannot be undone. All registrations and related data
                will be permanently deleted.
              </p>
            </div>
            <div className="p-6 border-t border-gray-100 flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="btn-secondary"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
                disabled={isDeleting}
              >
                {isDeleting && (
                  <IconLoader2 size={18} className="animate-spin" />
                )}
                Delete Event
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
