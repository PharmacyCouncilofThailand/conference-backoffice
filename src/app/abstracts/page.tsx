"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AdminLayout } from "@/components/layout";
import { api } from "@/lib/api";
import { exportToExcel } from "@/lib/exportExcel";
import { useAuth } from "@/contexts/AuthContext";
import { useDebounce } from "@/hooks/useDebounce";
import { Pagination } from "@/components/common";
import { RevisionRequestModal } from "@/components/abstracts/RevisionRequestModal";
import toast from "react-hot-toast";
import {
  IconFileText,
  IconClock,
  IconCheck,
  IconX,
  IconSearch,
  IconEye,
  IconDownload,
  IconLoader2,
  IconPencil,
  IconMail,
  IconCircleCheck,
} from "@tabler/icons-react";

const statusColors: { [key: string]: string } = {
  pending: "badge-warning",
  accepted: "badge-success",
  rejected: "badge-error",
  revision: "badge-info",
  under_review: "badge-info",
};

const statusLabels: Record<string, string> = {
  pending: "Pending",
  accepted: "Accepted",
  rejected: "Rejected",
  revision: "Revision Requested",
};

// Derive a richer status label that distinguishes accepted-and-confirmed from
// accepted-but-still-awaiting-confirmation (the new approval-confirmation flow).
function deriveStatusBadge(abs: { status: string; confirmedAt?: string | null }) {
  if (abs.status === "accepted") {
    if (abs.confirmedAt) {
      return { label: "Confirmed", className: "bg-emerald-100 text-emerald-800" };
    }
    return { label: "Accepted (awaiting confirmation)", className: "bg-blue-100 text-blue-800" };
  }
  return null;
}

// Map backend categories to colors if needed, or use generic
const topicColors: { [key: string]: string } = {
  clinical_pharmacy: "bg-emerald-50 text-teal-900",
  social_administrative: "bg-green-100 text-green-800",
  community_pharmacy: "bg-purple-100 text-purple-800",
  pharmacology_toxicology: "bg-red-100 text-red-800",
  pharmacy_education: "bg-yellow-100 text-yellow-800",
  digital_pharmacy: "bg-indigo-100 text-indigo-800",
  Research: "bg-emerald-50 text-teal-900",
  "Case Report": "bg-purple-100 text-purple-800",
  Review: "bg-green-100 text-green-800",
  Other: "bg-zinc-100 text-zinc-800",
};

// NOTE: Abstract categories are fetched dynamically per-event from
// `api.abstractCategories.list(token, "eventId=X")`. The legacy hardcoded
// list was removed.

// Presentation types for filter dropdown
const presentationTypes = [
  { id: "poster", label: "Poster" },
  { id: "oral", label: "Oral Presentation" },
];

const getBackofficeToken = () =>
  localStorage.getItem("backoffice_token") ||
  sessionStorage.getItem("backoffice_token") ||
  "";

interface AbstractFile {
  id: number;
  abstractId?: number;
  fileName: string;
  fileUrl: string;
  fileType?: string | null;
  fileSize?: number | null;
  sortOrder?: number | null;
  createdAt?: string;
}

interface Abstract {
  id: number;
  trackingId: string | null;
  title: string;
  category: string;
  presentationType: string | null;
  keywords: string | null;
  background: string;
  methods: string;
  results: string;
  conclusion: string;
  status: string;
  fullPaperUrl: string | null;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  confirmedAt?: string | null;
  reviewComment?: string | null;
  files?: AbstractFile[];
  createdAt: string;
  author: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    country: string | null;
    institution: string | null;
  } | null;
  event: {
    name: string;
    code: string;
  };
}

const getAttachedFiles = (abs: Pick<Abstract, "files" | "fullPaperUrl">) => {
  const files = Array.isArray(abs.files)
    ? abs.files.filter((file) => file.fileUrl)
    : [];

  if (files.length > 0) return files;

  return abs.fullPaperUrl
    ? [
        {
          id: 0,
          fileName: "Full Paper",
          fileUrl: abs.fullPaperUrl,
          sortOrder: 0,
        },
      ]
    : [];
};

export default function AbstractsPage() {
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const [abstracts, setAbstracts] = useState<Abstract[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [presentationTypeFilter, setPresentationTypeFilter] = useState("");
  const [eventFilter, setEventFilter] = useState("");
  const [eventOptions, setEventOptions] = useState<{ id: number; name: string }[]>([]);
  const [eventSelected, setEventSelected] = useState(false);
  // Dynamic abstract categories for the currently selected event
  const [eventCategoryList, setEventCategoryList] = useState<{ id: number; name: string }[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Debounce search term to avoid API calls on every keystroke
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Fetch events for filter dropdown
  // - Admin sees all events from API
  // - Non-admin (reviewer/staff/etc.) sees only their assignedEvents from auth context
  useEffect(() => {
    if (isAdmin) {
      const token = getBackofficeToken();
      api.backofficeEvents.list(token, "limit=100").then((res) => {
        setEventOptions((res.events as any[]).map((e) => ({ id: e.id as number, name: e.eventName as string })));
      }).catch(() => {});
      return;
    }
    if (user && user.assignedEvents && user.assignedEvents.length > 0) {
      setEventOptions(user.assignedEvents.map((e) => ({ id: e.id, name: e.name })));
    }
  }, [isAdmin, user]);

  // Auto-select when only one event is available (e.g. reviewer assigned to a single event)
  // → skip the manual "select event" gate and load data immediately
  useEffect(() => {
    if (eventOptions.length === 1 && !eventFilter) {
      const onlyId = String(eventOptions[0].id);
      setEventFilter(onlyId);
      setEventSelected(true);
    }
  }, [eventOptions, eventFilter]);

  // Fetch abstract categories for the currently selected event
  useEffect(() => {
    if (!eventFilter) {
      setEventCategoryList([]);
      return;
    }
    const token = getBackofficeToken();
    api.abstractCategories
      .list(token, `eventId=${eventFilter}`)
      .then((res) => {
        setEventCategoryList(
          ((res.categories as Record<string, unknown>[]) || []).map((c) => ({
            id: c.id as number,
            name: c.name as string,
          })),
        );
        // Reset category filter when event changes (avoid stale value)
        setCategoryFilter("");
      })
      .catch(() => setEventCategoryList([]));
  }, [eventFilter]);

  // Filter categories based on user role
  // - Admin/other roles see all categories defined for the selected event
  // - Reviewer sees only categories they are assigned to (by name)
  const availableCategories = useMemo(() => {
    if (isAdmin || !user || user.role !== "reviewer") {
      return eventCategoryList;
    }
    const assignedCats = user.assignedCategories || [];
    if (assignedCats.length === 0) return eventCategoryList;
    return eventCategoryList.filter((c) => assignedCats.includes(c.name));
  }, [user, isAdmin, eventCategoryList]);

  // Filter presentation types based on user role
  // Admin sees all, Reviewer sees only assigned presentation types
  const availablePresentationTypes = useMemo(() => {
    if (isAdmin || !user || user.role !== "reviewer") {
      // Admin and other roles see all presentation types
      return presentationTypes;
    }
    // Reviewer only sees assigned presentation types
    const assignedTypes = user.assignedPresentationTypes || [];
    if (assignedTypes.length === 0) {
      // If no types assigned, show all
      return presentationTypes;
    }
    return presentationTypes.filter((type) => assignedTypes.includes(type.id));
  }, [user, isAdmin]);

  const handleExport = async () => {
    if (!eventFilter) return;
    setIsExporting(true);
    try {
      const token = getBackofficeToken();
      const params: any = { page: 1, limit: 1000 };
      if (statusFilter) params.status = statusFilter;
      if (categoryFilter) {
        if (/^\d+$/.test(categoryFilter)) {
          params.categoryId = categoryFilter;
        } else {
          params.category = categoryFilter;
        }
      }
      if (presentationTypeFilter) params.presentationType = presentationTypeFilter;
      if (eventFilter) params.eventId = eventFilter;
      if (searchTerm) params.search = searchTerm;

      const res = await api.abstracts.list(token, new URLSearchParams(params).toString());
      const eventName = eventOptions.find(e => String(e.id) === eventFilter)?.name || 'event';

      const rows = (res.abstracts as unknown as Abstract[]).map((a) => {
        const attachedFiles = getAttachedFiles(a);

        return {
          'Tracking ID': a.trackingId || '',
          'Title': a.title,
          'Category': a.category,
          'Presentation Type': a.presentationType || '',
          'Status': a.status,
          'Author First Name': a.author?.firstName || '',
          'Author Last Name': a.author?.lastName || '',
          'Author Email': a.author?.email || '',
          'Author Phone': a.author?.phone || '',
          'Author Institution': a.author?.institution || '',
          'Author Country': a.author?.country || '',
          'Keywords': a.keywords || '',
          'Background': a.background || '',
          'Methods': a.methods || '',
          'Results': a.results || '',
          'Conclusion': a.conclusion || '',
          'Abstract File Count': attachedFiles.length,
          'Abstract Files': attachedFiles
            .map((file, index) => `${index + 1}. ${file.fileName}: ${file.fileUrl}`)
            .join('\n'),
          'Submitted At': new Date(a.createdAt).toLocaleString('th-TH'),
        };
      });

      exportToExcel(rows, `abstracts_${eventName.replace(/\s+/g, '_')}`);
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  const [selectedAbstract, setSelectedAbstract] = useState<Abstract | null>(
    null,
  );
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reviewComment, setReviewComment] = useState("");

  useEffect(() => {
    if (!eventSelected) return;
    fetchAbstracts();
  }, [page, debouncedSearchTerm, statusFilter, categoryFilter, presentationTypeFilter, eventFilter, eventSelected]);

  const fetchAbstracts = async () => {
    setIsLoading(true);
    try {
      const token = getBackofficeToken();
      const params: any = { page, limit };
      if (statusFilter) params.status = statusFilter;
      if (categoryFilter) {
        if (/^\d+$/.test(categoryFilter)) {
          params.categoryId = categoryFilter;
        } else {
          params.category = categoryFilter;
        }
      }
      if (presentationTypeFilter) params.presentationType = presentationTypeFilter;
      if (eventFilter) params.eventId = eventFilter;
      if (searchTerm) params.search = searchTerm;

      const res = await api.abstracts.list(
        token,
        new URLSearchParams(params).toString(),
      );
      setAbstracts(res.abstracts as unknown as Abstract[]);
      setTotalCount(res.pagination.total);
      setTotalPages(res.pagination.totalPages);
    } catch (error) {
      console.error("Failed to fetch abstracts:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateStatus = async (status: string, comment?: string) => {
    if (!selectedAbstract) return;
    setIsSubmitting(true);
    try {
      const token = getBackofficeToken();
      await api.abstracts.updateStatus(
        token,
        selectedAbstract.id,
        status,
        comment,
      );

      // Refresh list
      fetchAbstracts();

      // Close modals
      setShowApproveModal(false);
      setShowRejectModal(false);
      setSelectedAbstract(null);
      setReviewComment("");

      toast.success(
        `Abstract ${status === "accepted" ? "approved" : status} successfully!`,
      );
    } catch (error) {
      console.error(error);
      toast.error(`Failed to ${status} abstract`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendConfirmation = async (abs: Abstract) => {
    if (isSubmitting) return;
    if (!confirm(`Resend approval-confirmation email to ${abs.author?.email ?? "the author"}?\nA new secure link will be issued and any previous link will be invalidated.`)) return;
    setIsSubmitting(true);
    try {
      const token = getBackofficeToken();
      const res = await api.abstracts.resendConfirmation(token, abs.id);
      const deadline = res.deadline ? new Date(res.deadline).toLocaleDateString("th-TH") : `${res.deadlineDays} days`;
      toast.success(`Confirmation email sent. Deadline: ${deadline}`);
      await fetchAbstracts();
    } catch (error) {
      console.error(error);
      toast.error("Failed to resend confirmation email");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleManualConfirm = async (abs: Abstract) => {
    if (isSubmitting) return;
    if (!confirm(`Manually mark this abstract as confirmed (admin override)?\n\n"${abs.title.substring(0, 80)}"`)) return;
    setIsSubmitting(true);
    try {
      const token = getBackofficeToken();
      const res = await api.abstracts.manualConfirm(token, abs.id);
      if (res.alreadyConfirmed) {
        toast.success("Already confirmed.");
      } else {
        toast.success("Marked as confirmed.");
      }
      await fetchAbstracts();
    } catch (error) {
      console.error(error);
      toast.error("Failed to mark as confirmed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestRevision = async (payload: { topic: string; comment: string; file: File | null }) => {
    if (!selectedAbstract) return;
    setIsSubmitting(true);
    try {
      const token = getBackofficeToken();
      await api.abstracts.requestRevision(token, selectedAbstract.id, payload);

      await fetchAbstracts();

      setShowRevisionModal(false);
      setSelectedAbstract(null);
      toast.success("Revise request sent successfully!");
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Failed to request revise");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AdminLayout title="Abstract Submissions">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="card py-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
              <IconFileText size={24} stroke={1.5} />
            </div>
            <div>
              <p className="text-2xl font-bold text-zinc-800">
                {isLoading ? "-" : totalCount}
              </p>
              <p className="text-sm text-zinc-400">Total Submissions</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="card">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
          <h2 className="text-lg font-semibold text-zinc-800">
            All Submissions
          </h2>
          <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto lg:min-w-[640px]">
            <div className="relative flex-1">
              <IconSearch
                className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
                size={18}
              />
              <input
                type="text"
                placeholder="Search by title, author, or ID..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                className="input-field-search w-full"
              />
            </div>
            <button
              onClick={handleExport}
              disabled={!eventSelected || isExporting}
              className="btn-secondary flex items-center justify-center gap-2 whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isExporting ? <IconLoader2 size={18} className="animate-spin" /> : <IconDownload size={18} />}
              Export Excel
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
          <select
            value={eventFilter}
            onChange={(e) => { setEventFilter(e.target.value); setEventSelected(!!e.target.value); setPage(1); }}
            className="input-field w-full"
          >
            <option value="">-- เลือก Event --</option>
            {eventOptions.map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setPage(1);
            }}
            className="input-field w-full"
            disabled={!eventFilter || availableCategories.length === 0 || availableCategories.length === 1}
          >
            {!eventFilter ? (
              <option value="">Select an event first</option>
            ) : availableCategories.length === 0 ? (
              <option value="">No categories available</option>
            ) : availableCategories.length === 1 ? (
              <option value="">{availableCategories[0].name}</option>
            ) : (
              <>
                <option value="">
                  {isAdmin || availableCategories.length === eventCategoryList.length
                    ? "All Categories"
                    : `All (${availableCategories.map((c) => c.name).join(", ")})`}
                </option>
                {availableCategories.map((cat) => (
                  <option key={cat.id} value={cat.name}>
                    {cat.name}
                  </option>
                ))}
              </>
            )}
          </select>

          <select
            value={presentationTypeFilter}
            onChange={(e) => {
              setPresentationTypeFilter(e.target.value);
              setPage(1);
            }}
            className="input-field w-full"
            disabled={availablePresentationTypes.length === 1}
          >
            {availablePresentationTypes.length === 1 ? (
              // Single presentation type - show only that one
              <option value="">{availablePresentationTypes[0].label}</option>
            ) : (
              // Multiple presentation types - show "All Presentation Types"
              <>
                <option value="">All Presentation Types</option>
                {availablePresentationTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.label}
                  </option>
                ))}
              </>
            )}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="input-field w-full"
          >
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="accepted">Accepted</option>
            <option value="rejected">Rejected</option>
            <option value="revision">Revision Requested</option>
          </select>
        </div>

        {/* Table */}
        {!eventSelected ? (
          <div className="text-center py-16 text-zinc-400">
            <IconFileText size={40} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">กรุณาเลือก Event เพื่อดูข้อมูล</p>
          </div>
        ) : isLoading ? (
          <div className="flex justify-center py-12">
            <IconLoader2 size={32} className="animate-spin text-emerald-600" />
          </div>
        ) : abstracts.length === 0 ? (
          <div className="text-center py-12 text-zinc-400">
            No abstracts found.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
            <table className="w-full">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-200">
                  <th className="px-4 py-3 text-center text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    Tracking ID
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider min-w-[300px]">
                    Title & Author
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    Presentation
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    Files
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    Submitted
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-zinc-500 uppercase tracking-wider w-[120px]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {abstracts.map((abs) => (
                  <tr
                    key={abs.id}
                    className="hover:bg-zinc-50 transition-colors"
                  >
                    <td className="px-4 py-4 text-center">
                      <span className="font-mono text-sm text-zinc-400 bg-zinc-100 px-2 py-1 rounded">
                        {abs.trackingId || abs.id}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <h5 className="font-medium text-zinc-900 mb-1 line-clamp-2">
                        {abs.title}
                      </h5>
                      <p className="text-sm text-zinc-400">
                        {abs.author?.firstName} {abs.author?.lastName}
                      </p>
                      {abs.author?.institution && (
                        <p className="text-xs text-zinc-400">
                          {abs.author.institution}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span
                        className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${abs.presentationType === "oral" ? "bg-orange-100 text-orange-800" : "bg-cyan-100 text-cyan-800"}`}
                      >
                        {abs.presentationType === "oral" ? "Oral" : "Poster"}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span
                        className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${topicColors[abs.category] || "bg-zinc-100 text-zinc-600"}`}
                      >
                        {abs.category.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      {(() => {
                        const derived = deriveStatusBadge(abs);
                        if (derived) {
                          return (
                            <span
                              className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${derived.className}`}
                              title={
                                abs.confirmedAt
                                  ? `Confirmed at ${new Date(abs.confirmedAt).toLocaleString("th-TH")}`
                                  : abs.approvedAt
                                    ? `Approved at ${new Date(abs.approvedAt).toLocaleString("th-TH")}`
                                    : undefined
                              }
                            >
                              {derived.label}
                            </span>
                          );
                        }
                        return (
                          <span
                            className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[abs.status] || "bg-zinc-100 text-zinc-600"}`}
                          >
                            {statusLabels[abs.status] ||
                              abs.status.charAt(0).toUpperCase() +
                                abs.status.slice(1)}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-xs font-medium text-slate-700">
                        <IconFileText size={14} />
                        {getAttachedFiles(abs).length}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className="text-sm text-zinc-500">
                        {new Date(abs.createdAt).toLocaleDateString("th-TH", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <div className="flex gap-1 justify-center items-center">
                        <button
                          className="p-2 hover:bg-emerald-50 rounded-lg text-zinc-400 hover:text-emerald-600 transition-colors"
                          title="View Details"
                          onClick={() => router.push(`/abstracts/${abs.id}`)}
                        >
                          <IconEye size={18} />
                        </button>
                        <button
                          className={`p-2 rounded-lg transition-colors ${abs.status === "pending" ? "hover:bg-amber-50 text-zinc-400 hover:text-amber-600" : "text-gray-200 cursor-not-allowed"}`}
                          title="Request Revise"
                          onClick={() => {
                            if (abs.status === "pending") {
                              setSelectedAbstract(abs);
                              setShowRevisionModal(true);
                            }
                          }}
                          disabled={abs.status !== "pending"}
                        >
                          <IconPencil size={18} />
                        </button>
                        <button
                          className={`p-2 rounded-lg transition-colors ${abs.status === "pending" ? "hover:bg-green-50 text-zinc-400 hover:text-green-600" : "text-gray-200 cursor-not-allowed"}`}
                          title="Approve"
                          onClick={() => {
                            if (abs.status === "pending") {
                              setSelectedAbstract(abs);
                              setShowApproveModal(true);
                            }
                          }}
                          disabled={abs.status !== "pending"}
                        >
                          <IconCheck size={18} />
                        </button>
                        <button
                          className={`p-2 rounded-lg transition-colors ${abs.status === "pending" ? "hover:bg-red-50 text-zinc-400 hover:text-red-600" : "text-gray-200 cursor-not-allowed"}`}
                          title="Reject"
                          onClick={() => {
                            if (abs.status === "pending") {
                              setSelectedAbstract(abs);
                              setShowRejectModal(true);
                            }
                          }}
                          disabled={abs.status !== "pending"}
                        >
                          <IconX size={18} />
                        </button>
                        {abs.status === "accepted" && !abs.confirmedAt && (
                          <>
                            <button
                              className="p-2 rounded-lg transition-colors hover:bg-blue-50 text-zinc-400 hover:text-blue-600"
                              title="Resend confirmation email"
                              onClick={() => handleResendConfirmation(abs)}
                              disabled={isSubmitting}
                            >
                              <IconMail size={18} />
                            </button>
                            <button
                              className="p-2 rounded-lg transition-colors hover:bg-emerald-50 text-zinc-400 hover:text-emerald-600"
                              title="Manually confirm (admin override)"
                              onClick={() => handleManualConfirm(abs)}
                              disabled={isSubmitting}
                            >
                              <IconCircleCheck size={18} />
                            </button>
                          </>
                        )}
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
              pageSize={limit}
              onPageChange={setPage}
              onPageSizeChange={setLimit}
              itemName="abstracts"
            />
          </div>
        )}
      </div>

      {/* Approve Modal */}
      {showApproveModal && selectedAbstract && (
        <div className="modal-overlay">
          <div className="bg-white rounded-2xl max-w-md w-full">
            <div className="p-6 bg-green-600 rounded-t-2xl">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <IconCheck size={20} /> Approve Abstract
              </h3>
            </div>
            <div className="p-6 text-center">
              <p className="mb-2 text-zinc-500">Approve this abstract?</p>
              <p className="font-semibold text-zinc-800">
                {selectedAbstract.title.substring(0, 50)}...
              </p>

              <div className="mt-4 text-left">
                <label className="block text-sm font-medium text-zinc-600 mb-1">
                  Comments (optional)
                </label>
                <textarea
                  className="input-field h-20"
                  placeholder="Reviewer comments..."
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                ></textarea>
              </div>
            </div>
            <div className="p-6 border-t border-zinc-100 flex gap-3 justify-end">
              <button
                onClick={() => setShowApproveModal(false)}
                className="btn-secondary"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                onClick={() => handleUpdateStatus("accepted", reviewComment)}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2"
                disabled={isSubmitting}
              >
                {isSubmitting && (
                  <IconLoader2 size={18} className="animate-spin" />
                )}
                Approve
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedAbstract && (
        <div className="modal-overlay">
          <div className="bg-white rounded-2xl max-w-md w-full">
            <div className="p-6 bg-red-600 rounded-t-2xl">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <IconX size={20} /> Reject Abstract
              </h3>
            </div>
            <div className="p-6 text-center">
              <p className="mb-2 text-zinc-500">Reject this abstract?</p>
              <p className="font-semibold text-zinc-800">
                {selectedAbstract.title.substring(0, 50)}...
              </p>

              <div className="mt-4 text-left">
                <label className="block text-sm font-medium text-zinc-600 mb-1">
                  Reason / Comments
                </label>
                <textarea
                  className="input-field h-20"
                  placeholder="Provide feedback to the author..."
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                ></textarea>
              </div>
            </div>
            <div className="p-6 border-t border-zinc-100 flex gap-3 justify-end">
              <button
                onClick={() => setShowRejectModal(false)}
                className="btn-secondary"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                onClick={() => handleUpdateStatus("rejected", reviewComment)}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 flex items-center gap-2"
                disabled={isSubmitting}
              >
                {isSubmitting && (
                  <IconLoader2 size={18} className="animate-spin" />
                )}
                Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {showRevisionModal && selectedAbstract && (
        <RevisionRequestModal
          abstractTitle={selectedAbstract.title}
          isSubmitting={isSubmitting}
          onClose={() => {
            if (isSubmitting) return;
            setShowRevisionModal(false);
            setSelectedAbstract(null);
          }}
          onSubmit={handleRequestRevision}
        />
      )}
    </AdminLayout>
  );
}
