"use client";

import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/layout";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { api } from "@/lib/api";
import { Pagination } from "@/components/common";
import {
  IconTicket,
  IconPlus,
  IconPencil,
  IconTrash,
  IconSearch,
  IconCheck,
  IconX,
  IconCopy,
  IconLoader2,
  IconCalendarEvent,
  IconStar,
} from "@tabler/icons-react";
import toast from "react-hot-toast";

const categoryColors: { [key: string]: { bg: string; text: string } } = {
  primary: { bg: "bg-blue-100", text: "text-blue-800" },
  addon: { bg: "bg-purple-100", text: "text-purple-800" },
};

const typeColors: { [key: string]: string } = {
  thstd: "bg-green-100 text-green-800",
  thpro: "bg-blue-100 text-blue-800",
  interstd: "bg-yellow-100 text-yellow-800",
  interpro: "bg-purple-100 text-purple-800",
  guest: "bg-teal-100 text-teal-800",
  general: "bg-gray-100 text-gray-800", // fallback
};

const getBackofficeToken = () =>
  localStorage.getItem("backoffice_token") ||
  sessionStorage.getItem("backoffice_token") ||
  "";

interface Ticket {
  id: number;
  eventId: number;
  name: string; // ticketTypes.name
  category: string;
  priority: string;
  groupName: string | null;
  price: number;
  currency: string;
  originalPrice?: number | null;
  description?: string | null;
  features?: string[];
  badgeText?: string | null;
  quota: number;
  sold: number;
  status?: string;
  startDate?: string; // saleStartDate
  endDate?: string; // saleEndDate
  type: string; // mapped from allowedRoles? or just logic
  allowedRoles: string[];
  displayOrder: number;
  isActive: boolean;
  eventCode?: string;
  sessionIds?: number[];
}

interface EventSession {
  id: number;
  sessionCode: string;
  sessionName: string;
  isMainSession?: boolean;
}

interface EventOption {
  id: number;
  code: string;
  name: string;
}

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [sessions, setSessions] = useState<EventSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filters & Pagination
  const [searchTerm, setSearchTerm] = useState("");
  const [eventFilter, setEventFilter] = useState<number | "">("");
  const [categoryFilter, setCategoryFilter] = useState<
    "primary" | "addon" | ""
  >("");
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    eventId: 0,
    name: "",
    category: "primary",
    groupName: "",
    price: 0,
    currency: "THB",
    originalPrice: "" as string | number,
    description: "",
    features: [] as string[],
    badgeText: "",
    quota: 100,
    saleStartDate: "",
    saleEndDate: "",
    allowedRoles: ["thstd"], // Default
    priority: "regular",
    isActive: true,
    sessionIds: [] as number[],
  });
  const [featureInput, setFeatureInput] = useState("");

  useEffect(() => {
    fetchEvents();
  }, []);

  useEffect(() => {
    if ((showCreateModal || showEditModal) && formData.eventId) {
      fetchSessions(formData.eventId);
    } else {
      setSessions([]);
    }
  }, [formData.eventId, showCreateModal, showEditModal]);

  useEffect(() => {
    fetchTickets();
  }, [page, searchTerm, eventFilter, categoryFilter, roleFilter]);

  const fetchEvents = async () => {
    try {
      const token = getBackofficeToken();
      const res = await api.backofficeEvents.list(token, "limit=100"); // Get enough for dropdown
      const mappedEvents = res.events.map((e: Record<string, unknown>) => ({
        id: e.id as number,
        code: e.eventCode as string,
        name: e.eventName as string,
      }));
      setEvents(mappedEvents);
      if (mappedEvents.length > 0 && formData.eventId === 0) {
        setFormData((prev) => ({ ...prev, eventId: mappedEvents[0].id }));
      }
    } catch (error) {
      console.error("Failed to fetch events:", error);
    }
  };

  const fetchSessions = async (eventId: number) => {
    try {
      const token = getBackofficeToken();
      const res = await api.backofficeEvents.getSessions(token, eventId);
      const mappedSessions = res.sessions.map((s: any) => ({
        id: s.id,
        sessionCode: s.sessionCode,
        sessionName: s.sessionName,
        isMainSession: s.isMainSession || false,
      }));
      setSessions(mappedSessions);

      setFormData((prev) => {
        if (showCreateModal && prev.category === "primary") {
          const mainSessionIds = mappedSessions
            .filter((s: EventSession) => s.isMainSession)
            .map((s: EventSession) => s.id);
          return {
            ...prev,
            sessionIds: Array.from(
              new Set([...prev.sessionIds, ...mainSessionIds]),
            ),
          };
        }
        return prev;
      });
    } catch (error) {
      console.error("Failed to fetch sessions:", error);
      setSessions([]);
    }
  };

  const formatDateTimeLocal = (dateStr: string | null | undefined) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const fetchTickets = async () => {
    setIsLoading(true);
    try {
      const token = getBackofficeToken();
      const params: any = { page, limit: 10 };
      if (eventFilter) params.eventId = eventFilter;
      if (searchTerm) params.search = searchTerm;
      if (categoryFilter) params.category = categoryFilter;
      if (roleFilter) params.role = roleFilter;

      const res = await api.tickets.list(
        token,
        new URLSearchParams(params).toString(),
      );

      const mappedTickets = res.tickets.map((t: any) => {
        // Parse allowedRoles - could be JSON array, CSV string, or JS array
        let roles: string[] = [];
        if (t.allowedRoles) {
          if (Array.isArray(t.allowedRoles)) {
            roles = t.allowedRoles;
          } else if (typeof t.allowedRoles === "string") {
            if (t.allowedRoles.startsWith("[")) {
              try {
                roles = JSON.parse(t.allowedRoles);
              } catch {
                roles = [];
              }
            } else {
              roles = t.allowedRoles
                .split(",")
                .map((r: string) => r.trim())
                .filter(Boolean);
            }
          }
        }
        return {
          id: t.id,
          eventId: t.eventId,
          name: t.name,
          category: t.category,
          priority: t.priority || "regular",
          groupName: t.groupName || null,
          price: parseFloat(t.price),
          currency: t.currency || "THB",
          originalPrice: t.originalPrice ? parseFloat(t.originalPrice) : null,
          description: t.description || null,
          features: t.features || [],
          badgeText: t.badgeText || null,
          quota: t.quota,
          sold: t.sold,
          startDate: t.startDate,
          endDate: t.endDate,
          type: roles.length > 0 ? roles[0] : "general",
          allowedRoles: roles,
          displayOrder: t.displayOrder ?? 0,
          isActive: t.isActive ?? true,
          eventCode: t.eventCode,
          sessionIds: t.sessionIds || [],
        };
      });

      setTickets(mappedTickets);
      setTotalCount(res.pagination.total);
      setTotalPages(res.pagination.totalPages);
    } catch (error) {
      console.error("Failed to fetch tickets:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formData.eventId) {
      toast.error("Please select an event");
      return;
    }
    if (formData.quota < 1) {
      toast.error("Quota must be at least 1");
      return;
    }
    setIsSubmitting(true);
    try {
      const token = getBackofficeToken();
      // Use user-selected sessions for both primary and addon
      const finalSessionIds = formData.sessionIds;

      // Build payload with only schema-valid fields
      const payload: Record<string, unknown> = {
        name: formData.name,
        category: formData.category,
        groupName: formData.groupName || undefined,
        price: String(formData.price),
        currency: formData.currency,
        originalPrice:
          formData.originalPrice !== ""
            ? Number(formData.originalPrice)
            : undefined,
        description: formData.description || undefined,
        features: formData.features.length > 0 ? formData.features : [],
        badgeText: formData.badgeText || undefined,
        quota: formData.quota,
        allowedRoles: JSON.stringify(formData.allowedRoles),
        priority: formData.priority,
        isActive: formData.isActive,
        sessionIds: finalSessionIds,
      };
      // Convert dates to ISO format only if provided
      if (formData.saleStartDate) {
        payload.saleStartDate = new Date(formData.saleStartDate).toISOString();
      }
      if (formData.saleEndDate) {
        payload.saleEndDate = new Date(formData.saleEndDate).toISOString();
      }
      await api.backofficeEvents.createTicket(token, formData.eventId, payload);
      toast.success("Ticket created successfully!");
      setShowCreateModal(false);
      fetchTickets();
    } catch (error) {
      console.error(error);
      toast.error("Failed to create ticket");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!selectedTicket || !formData.eventId) return;
    if (formData.quota < 1) {
      toast.error("Quota must be at least 1");
      return;
    }
    setIsSubmitting(true);
    try {
      const token = getBackofficeToken();
      // Use user-selected sessions for both primary and addon
      const finalSessionIds = formData.sessionIds;

      // Build payload with only schema-valid fields
      const payload: Record<string, unknown> = {
        name: formData.name,
        category: formData.category,
        groupName: formData.groupName || undefined,
        price: String(formData.price),
        currency: formData.currency,
        originalPrice:
          formData.originalPrice !== ""
            ? Number(formData.originalPrice)
            : undefined,
        description: formData.description || undefined,
        features: formData.features.length > 0 ? formData.features : [],
        badgeText: formData.badgeText || undefined,
        quota: formData.quota,
        allowedRoles: JSON.stringify(formData.allowedRoles),
        priority: formData.priority,
        isActive: formData.isActive,
        sessionIds: finalSessionIds,
      };
      // Convert dates to ISO format only if provided
      if (formData.saleStartDate) {
        payload.saleStartDate = new Date(formData.saleStartDate).toISOString();
      }
      if (formData.saleEndDate) {
        payload.saleEndDate = new Date(formData.saleEndDate).toISOString();
      }
      // Use API update
      console.log("[handleEdit] payload:", JSON.stringify(payload, null, 2));
      await api.backofficeEvents.updateTicket(
        token,
        formData.eventId,
        selectedTicket.id,
        payload,
      );
      toast.success("Ticket updated successfully!");
      setShowEditModal(false);
      fetchTickets();
    } catch (error) {
      console.error(error);
      const msg = error instanceof Error ? error.message : "Failed to update ticket";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedTicket) return;
    setIsSubmitting(true);
    try {
      const token = getBackofficeToken();
      await api.backofficeEvents.deleteTicket(
        token,
        selectedTicket.eventId,
        selectedTicket.id,
      );
      toast.success("Ticket deleted successfully!");
      setShowDeleteModal(false);
      fetchTickets();
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete ticket");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDuplicate = (ticket: Ticket) => {
    setFormData({
      eventId: ticket.eventId,
      name: ticket.name + " (Copy)",
      category: ticket.category,
      groupName: ticket.groupName || "",
      price: ticket.price,
      currency: ticket.currency,
      originalPrice: ticket.originalPrice ?? "",
      description: ticket.description || "",
      features: ticket.features || [],
      badgeText: ticket.badgeText || "",
      quota: ticket.quota,
      saleStartDate: formatDateTimeLocal(ticket.startDate),
      saleEndDate: formatDateTimeLocal(ticket.endDate),
      allowedRoles: ticket.allowedRoles,
      priority: ticket.priority || "regular",
      isActive: true,
      sessionIds: ticket.sessionIds || [],
    });
    setShowCreateModal(true);
  };

  const openEditModal = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setFormData({
      eventId: ticket.eventId,
      name: ticket.name,
      category: ticket.category,
      groupName: ticket.groupName || "",
      price: ticket.price,
      currency: ticket.currency,
      originalPrice: ticket.originalPrice ?? "",
      description: ticket.description || "",
      features: ticket.features || [],
      badgeText: ticket.badgeText || "",
      quota: ticket.quota,
      saleStartDate: formatDateTimeLocal(ticket.startDate),
      saleEndDate: formatDateTimeLocal(ticket.endDate),
      allowedRoles:
        ticket.allowedRoles && ticket.allowedRoles.length > 0
          ? ticket.allowedRoles.filter(r => ["thstd", "thpro", "interstd", "interpro", "general"].includes(r))
          : ["general"],
      priority: ticket.priority || "regular",
      isActive: ticket.isActive ?? true,
      sessionIds: ticket.sessionIds || [],
    });
    setShowEditModal(true);
  };

  const resetForm = () => {
    setFormData({
      eventId: events[0]?.id || 1,
      name: "",
      category: "primary",
      groupName: "",
      price: 0,
      currency: "THB",
      originalPrice: "",
      description: "",
      features: [],
      badgeText: "",
      quota: 100,
      saleStartDate: "",
      saleEndDate: "",
      allowedRoles: ["thstd"],
      priority: "regular",
      isActive: true,
      sessionIds: [],
    });
    setFeatureInput("");
  };

  // Calculate stats from loaded tickets (approximate since paginated, but real API would need stat endpoint)
  // We'll hide accurate stats for now unless we fetch all or have a stats endpoint.
  // Displaying simple count from total.
  const stats = {
    total: totalCount,
  };

  return (
    <AdminLayout title="Ticket Management">
      {/* Event Filter - Above Content */}
      <div className="mb-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-4 flex items-center gap-3">
        <div className="bg-blue-100 p-2 rounded-lg">
          <IconCalendarEvent className="text-blue-600" size={20} />
        </div>
        <span className="text-sm font-medium text-gray-700">Select Event:</span>
        <select
          value={eventFilter}
          onChange={(e) => {
            setEventFilter(e.target.value ? Number(e.target.value) : "");
            setPage(1);
          }}
          className="input-field pr-8 min-w-[250px] font-semibold bg-white"
        >
          <option value="">All Events</option>
          {events.map((event) => (
            <option key={event.id} value={event.id}>
              {event.name}
            </option>
          ))}
        </select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="card py-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
              <IconTicket size={24} stroke={1.5} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">
                {isLoading ? "-" : stats.total}
              </p>
              <p className="text-sm text-gray-500">Total Tickets</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Card */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-800">
            {eventFilter
              ? `Tickets for ${events.find((e) => e.id === eventFilter)?.name || "Event"}`
              : "All Tickets"}
          </h2>
          <button
            onClick={() => {
              resetForm();
              setShowCreateModal(true);
            }}
            className="btn-primary flex items-center gap-2"
          >
            <IconPlus size={18} />
            Add Ticket
          </button>
        </div>

        {/* Search & Category Filter */}
        <div className="mb-6 flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <IconSearch
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 z-10 pointer-events-none"
              size={18}
            />
            <input
              type="text"
              placeholder="Search by name..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="input-field-search"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value as "primary" | "addon" | "");
              setPage(1);
            }}
            className="input-field min-w-[150px]"
          >
            <option value="">All Categories</option>
            <option value="primary">Primary</option>
            <option value="addon">Add-on</option>
          </select>
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
            className="input-field min-w-[180px]"
          >
            <option value="">All Roles</option>
            <option value="pharmacist">Pharmacist</option>
            <option value="medical_professional">Medical Professional</option>
            <option value="student">Student</option>
            <option value="general">General</option>
          </select>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <IconLoader2 size={32} className="animate-spin text-blue-600" />
          </div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No tickets found.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Ticket
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Event
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Price
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Quota
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Priority
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Sales Period
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider w-[120px]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tickets.map((ticket) => {
                  const soldPercentage =
                    ticket.quota > 0 ? (ticket.sold / ticket.quota) * 100 : 0;
                  return (
                    <tr
                      key={ticket.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-4">
                        <p className="font-medium text-gray-900">
                          {ticket.name}
                        </p>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                          {ticket.eventCode ||
                            events.find((e) => e.id === ticket.eventId)?.code ||
                            "Unknown"}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span
                            className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${categoryColors[ticket.category]?.bg || "bg-gray-100"} ${categoryColors[ticket.category]?.text || "text-gray-800"}`}
                          >
                            {ticket.category === "primary"
                              ? "Primary"
                              : "Add-on"}
                          </span>
                          {ticket.allowedRoles && ticket.allowedRoles.length > 0 ? (
                            ticket.allowedRoles.map((role) => (
                              <span
                                key={role}
                                className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${typeColors[role] || "bg-gray-100 text-gray-600"}`}
                              >
                                {role === "pharmacist" ? "Pharmacist" : role === "medical_professional" ? "Med. Prof." : role === "student" ? "Student" : "General"}
                              </span>
                            ))
                          ) : (
                            <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                              General
                            </span>
                          )}
                          {ticket.sessionIds &&
                            ticket.sessionIds.length > 0 && (
                              <span
                                className={`text-xs mt-1 ${ticket.category === "primary"
                                  ? "text-blue-600"
                                  : "text-purple-600"
                                  }`}
                              >
                                → {ticket.sessionIds.length} sessions linked
                              </span>
                            )}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <p className="font-semibold text-gray-900">
                          {ticket.currency === "USD" ? "$" : "฿"}
                          {ticket.price.toLocaleString()}
                        </p>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className="w-24 mx-auto">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-gray-600">
                              {ticket.sold}/{ticket.quota}
                            </span>
                            <span
                              className={
                                soldPercentage >= 90
                                  ? "text-red-600"
                                  : soldPercentage >= 70
                                    ? "text-yellow-600"
                                    : "text-green-600"
                              }
                            >
                              {Math.round(soldPercentage)}%
                            </span>
                          </div>
                          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${soldPercentage >= 90 ? "bg-red-500" : soldPercentage >= 70 ? "bg-yellow-500" : "bg-green-500"}`}
                              style={{
                                width: `${Math.min(soldPercentage, 100)}%`,
                              }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ticket.priority === "early_bird"
                            ? "bg-orange-100 text-orange-800"
                            : ticket.priority === "regular"
                              ? "bg-gray-100 text-gray-800"
                              : "bg-gray-100 text-gray-800"
                            }`}
                        >
                          {ticket.priority === "early_bird"
                            ? "Early Bird"
                            : ticket.priority === "regular"
                              ? "Regular"
                              : "Regular"}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <p className="text-sm text-gray-600">
                          {ticket.startDate
                            ? new Date(ticket.startDate).toLocaleDateString(
                              "en-US",
                              { timeZone: "Asia/Bangkok" },
                            )
                            : "N/A"}
                        </p>
                        <p className="text-xs text-gray-400">
                          to{" "}
                          {ticket.endDate
                            ? new Date(ticket.endDate).toLocaleDateString(
                              "en-US",
                              { timeZone: "Asia/Bangkok" },
                            )
                            : "N/A"}
                        </p>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className="flex gap-1 justify-center items-center">
                          <button
                            className="p-2 hover:bg-blue-50 rounded-lg text-gray-500 hover:text-blue-600 transition-colors"
                            title="Duplicate"
                            onClick={() => handleDuplicate(ticket)}
                          >
                            <IconCopy size={18} />
                          </button>
                          <button
                            className="p-2 hover:bg-yellow-50 rounded-lg text-gray-500 hover:text-yellow-600 transition-colors"
                            title="Edit"
                            onClick={() => openEditModal(ticket)}
                          >
                            <IconPencil size={18} />
                          </button>
                          <button
                            className="p-2 hover:bg-red-50 rounded-lg text-gray-500 hover:text-red-600 transition-colors"
                            title="Delete"
                            onClick={() => {
                              setSelectedTicket(ticket);
                              setShowDeleteModal(true);
                            }}
                          >
                            <IconTrash size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Pagination */}
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              totalCount={totalCount}
              onPageChange={setPage}
              itemName="tickets"
            />
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {(showCreateModal || showEditModal) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold flex items-center gap-2 text-gray-900">
                  <IconTicket size={20} />{" "}
                  {showCreateModal ? "Create Ticket" : "Edit Ticket"}
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
            <div className="p-6">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Event *
                  </label>
                  <select
                    className="input-field"
                    value={formData.eventId}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        eventId: Number(e.target.value),
                      })
                    }
                    disabled={!showCreateModal}
                  >
                    {events.map((event) => (
                      <option key={event.id} value={event.id}>
                        {event.code}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category *
                  </label>
                  <select
                    className="input-field"
                    value={formData.category}
                    onChange={(e) => {
                      const newCategory = e.target.value;
                      setFormData((prev) => {
                        const newData = { ...prev, category: newCategory };
                        if (newCategory === "primary") {
                          const mainSessionIds = sessions
                            .filter((s) => s.isMainSession)
                            .map((s) => s.id);
                          newData.sessionIds = Array.from(
                            new Set([...prev.sessionIds, ...mainSessionIds]),
                          );
                        }
                        return newData;
                      });
                    }}
                  >
                    <option value="primary">Primary</option>
                    <option value="addon">Add-on</option>
                  </select>
                </div>
              </div>

              {/* Auto-link Notice for Primary Tickets */}
              {formData.category === "primary" && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                  <div className="flex items-start gap-2">
                    <div className="mt-0.5 text-blue-600">
                      <IconCheck size={16} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-blue-900">
                        Main Sessions Auto-selected
                      </p>
                      <p className="text-xs text-blue-700 mt-0.5">
                        Primary tickets typically include all Main Sessions. You
                        can adjust the selection below.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Session Linking */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Link to Sessions/Workshops *
                </label>
                <div className="border rounded-md p-3 max-h-40 overflow-y-auto space-y-2 bg-gray-50">
                  {sessions.length > 0 ? (
                    sessions.map((session) => (
                      <label
                        key={session.id}
                        className="flex items-start gap-2 cursor-pointer hover:bg-gray-100 p-1 rounded"
                      >
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={formData.sessionIds.includes(session.id)}
                          onChange={(e) => {
                            const isChecked = e.target.checked;
                            setFormData((prev) => {
                              const currentIds = prev.sessionIds || [];
                              if (isChecked) {
                                return {
                                  ...prev,
                                  sessionIds: [...currentIds, session.id],
                                };
                              } else {
                                return {
                                  ...prev,
                                  sessionIds: currentIds.filter(
                                    (id) => id !== session.id,
                                  ),
                                };
                              }
                            });
                          }}
                        />
                        <div>
                          <div className="text-sm font-medium flex items-center gap-2">
                            {session.sessionCode}
                            {session.isMainSession && (
                              <span className="flex items-center gap-1 text-[10px] font-bold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-100 uppercase">
                                <IconStar size={10} /> Main
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500">
                            {session.sessionName}
                          </div>
                        </div>
                      </label>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500 italic text-center py-2">
                      No sessions available for this event
                    </p>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Select one or more sessions to link with this ticket
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Target Audience (Role) *
                </label>
                <div className="border rounded-md p-3 max-h-40 overflow-y-auto space-y-2 bg-gray-50">
                  {[
                    { value: "pharmacist", label: "Pharmacist" },
                    { value: "medical_professional", label: "Medical Professional" },
                    { value: "student", label: "Student" },
                    { value: "general", label: "General" },
                  ].map((role) => (
                    <label
                      key={role.value}
                      className="flex items-start gap-2 cursor-pointer hover:bg-gray-100 p-1 rounded"
                    >
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={formData.allowedRoles.includes(role.value)}
                        onChange={(e) => {
                          const isChecked = e.target.checked;
                          setFormData((prev) => {
                            const currentRoles = prev.allowedRoles || [];
                            if (isChecked) {
                              return { ...prev, allowedRoles: [...currentRoles, role.value] };
                            } else {
                              // Ensure at least one role is selected, or allow empty if preferred
                              return { ...prev, allowedRoles: currentRoles.filter(r => r !== role.value) };
                            }
                          });
                        }}
                      />
                      <span className="text-sm font-medium text-gray-700">{role.label}</span>
                    </label>
                  ))}
                </div>
                {formData.allowedRoles.length === 0 && (
                  <p className="text-xs text-red-500 mt-1">Please select at least one target audience.</p>
                )}
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quota *
                </label>
                <input
                  type="number"
                  className="input-field"
                  value={formData.quota || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      quota: Number(e.target.value) || 0,
                    })
                  }
                  placeholder="100"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ticket Priority *
                </label>
                <select
                  className="input-field"
                  value={formData.priority}
                  onChange={(e) =>
                    setFormData({ ...formData, priority: e.target.value })
                  }
                >
                  <option value="early_bird">Early Bird</option>
                  <option value="regular">Regular</option>
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  Display order is auto-calculated from priority + sale start
                  date.
                </p>
              </div>

              <div className="mb-4">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) =>
                      setFormData({ ...formData, isActive: e.target.checked })
                    }
                    className="rounded border-gray-300"
                  />
                  Active (visible to public)
                </label>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ticket Name *
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Early Bird - Member"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  maxLength={255}
                />
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Currency *
                  </label>
                  <select
                    className="input-field"
                    value={formData.currency}
                    onChange={(e) =>
                      setFormData({ ...formData, currency: e.target.value })
                    }
                  >
                    <option value="THB">THB (฿)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Price *
                  </label>
                  <input
                    type="number"
                    className="input-field"
                    value={formData.price}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        price: Number(e.target.value),
                      })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Original Price
                  </label>
                  <input
                    type="number"
                    className="input-field"
                    value={formData.originalPrice}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        originalPrice:
                          e.target.value === "" ? "" : Number(e.target.value),
                      })
                    }
                    placeholder="Show as strikethrough price"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Group Name
                  </label>
                  <select
                    className="input-field"
                    value={formData.groupName}
                    onChange={(e) =>
                      setFormData({ ...formData, groupName: e.target.value })
                    }
                  >
                    <option value="">-- None --</option>
                    <option value="workshop">workshop</option>
                    <option value="gala">gala</option>
                    <option value="registration">registration</option>
                  </select>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Badge Text
                </label>
                <input
                  type="text"
                  className="input-field"
                  value={formData.badgeText}
                  onChange={(e) =>
                    setFormData({ ...formData, badgeText: e.target.value })
                  }
                  placeholder='e.g. "Early Bird", "Best Value"'
                  maxLength={50}
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  className="input-field"
                  rows={2}
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Optional ticket description"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Features
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    className="input-field flex-1"
                    value={featureInput}
                    onChange={(e) => setFeatureInput(e.target.value)}
                    placeholder="Add a feature..."
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && featureInput.trim()) {
                        e.preventDefault();
                        setFormData({
                          ...formData,
                          features: [...formData.features, featureInput.trim()],
                        });
                        setFeatureInput("");
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="btn-secondary text-sm px-3"
                    onClick={() => {
                      if (featureInput.trim()) {
                        setFormData({
                          ...formData,
                          features: [...formData.features, featureInput.trim()],
                        });
                        setFeatureInput("");
                      }
                    }}
                  >
                    Add
                  </button>
                </div>
                {formData.features.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {formData.features.map((f, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700"
                      >
                        {f}
                        <button
                          type="button"
                          onClick={() =>
                            setFormData({
                              ...formData,
                              features: formData.features.filter(
                                (_, idx) => idx !== i,
                              ),
                            })
                          }
                          className="text-gray-400 hover:text-red-500"
                        >
                          <IconX size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sale Start Date & Time
                  </label>
                  <DatePicker
                    selected={
                      formData.saleStartDate
                        ? new Date(formData.saleStartDate)
                        : null
                    }
                    onChange={(date: Date | null) =>
                      setFormData({
                        ...formData,
                        saleStartDate: date ? date.toISOString() : "",
                      })
                    }
                    showTimeSelect
                    dateFormat="d MMM yyyy, h:mm aa"
                    className="input-field w-full"
                    placeholderText="Select start date & time"
                    wrapperClassName="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sale End Date & Time
                  </label>
                  <DatePicker
                    selected={
                      formData.saleEndDate
                        ? new Date(formData.saleEndDate)
                        : null
                    }
                    onChange={(date: Date | null) =>
                      setFormData({
                        ...formData,
                        saleEndDate: date ? date.toISOString() : "",
                      })
                    }
                    showTimeSelect
                    dateFormat="d MMM yyyy, h:mm aa"
                    className="input-field w-full"
                    placeholderText="Select end date & time"
                    wrapperClassName="w-full"
                  />
                </div>
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
                {isSubmitting && (
                  <IconLoader2 size={18} className="animate-spin" />
                )}
                {showCreateModal ? "Create Ticket" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && selectedTicket && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full">
            <div className="p-6 bg-red-600 rounded-t-2xl">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <IconTrash size={20} /> Delete Ticket
              </h3>
            </div>
            <div className="p-6 text-center">
              <p className="mb-2">
                Are you sure you want to delete this ticket?
              </p>
              <p className="font-semibold text-gray-800">
                {selectedTicket.name}
              </p>
              {selectedTicket.sold > 0 && (
                <p className="text-sm text-red-600 mt-2 bg-red-50 p-2 rounded">
                  ⚠️ Warning: {selectedTicket.sold} tickets have been sold!
                </p>
              )}
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
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <IconLoader2 size={18} className="animate-spin" />
                ) : (
                  "Delete Ticket"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
