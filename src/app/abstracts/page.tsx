"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AdminLayout } from "@/components/layout";
import { api } from "@/lib/api";
import { exportToExcel } from "@/lib/exportExcel";
import { useAuth } from "@/contexts/AuthContext";
import { useDebounce } from "@/hooks/useDebounce";
import { Pagination } from "@/components/common";
import {
  IconFileText,
  IconClock,
  IconCheck,
  IconX,
  IconSearch,
  IconEye,
  IconDownload,
  IconLoader2,
} from "@tabler/icons-react";

const statusColors: { [key: string]: string } = {
  pending: "badge-warning",
  accepted: "badge-success",
  rejected: "badge-error",
  under_review: "badge-info",
};

// Map backend categories to colors if needed, or use generic
const topicColors: { [key: string]: string } = {
  clinical_pharmacy: "bg-blue-100 text-blue-800",
  social_administrative: "bg-green-100 text-green-800",
  community_pharmacy: "bg-purple-100 text-purple-800",
  pharmacology_toxicology: "bg-red-100 text-red-800",
  pharmacy_education: "bg-yellow-100 text-yellow-800",
  digital_pharmacy: "bg-indigo-100 text-indigo-800",
  Research: "bg-blue-100 text-blue-800",
  "Case Report": "bg-purple-100 text-purple-800",
  Review: "bg-green-100 text-green-800",
  Other: "bg-gray-100 text-gray-800",
};

// Categories for filter dropdown
const abstractCategories = [
  { id: "clinical_pharmacy", label: "Clinical Pharmacy" },
  { id: "social_administrative", label: "Social & Administrative Pharmacy" },
  { id: "community_pharmacy", label: "Community Pharmacy" },
  { id: "pharmacology_toxicology", label: "Pharmacology & Toxicology" },
  { id: "pharmacy_education", label: "Pharmacy Education" },
  { id: "digital_pharmacy", label: "Digital Pharmacy & Innovation" },
];

// Presentation types for filter dropdown
const presentationTypes = [
  { id: "poster", label: "Poster" },
  { id: "oral", label: "Oral Presentation" },
];

const getBackofficeToken = () =>
  localStorage.getItem("backoffice_token") ||
  sessionStorage.getItem("backoffice_token") ||
  "";

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
  const [isExporting, setIsExporting] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Debounce search term to avoid API calls on every keystroke
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Fetch events for filter dropdown
  useEffect(() => {
    const token = getBackofficeToken();
    api.backofficeEvents.list(token, "limit=100").then((res) => {
      setEventOptions((res.events as any[]).map((e) => ({ id: e.id as number, name: e.eventName as string })));
    }).catch(() => {});
  }, []);

  // Filter categories based on user role
  // Admin sees all, Reviewer sees only assigned categories
  const availableCategories = useMemo(() => {
    if (isAdmin || !user || user.role !== "reviewer") {
      // Admin and other roles see all categories
      return abstractCategories;
    }
    // Reviewer only sees assigned categories
    const assignedCats = user.assignedCategories || [];
    return abstractCategories.filter((cat) => assignedCats.includes(cat.id));
  }, [user, isAdmin]);

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
      if (categoryFilter) params.category = categoryFilter;
      if (presentationTypeFilter) params.presentationType = presentationTypeFilter;
      if (eventFilter) params.eventId = eventFilter;
      if (searchTerm) params.search = searchTerm;

      const res = await api.abstracts.list(token, new URLSearchParams(params).toString());
      const eventName = eventOptions.find(e => String(e.id) === eventFilter)?.name || 'event';

      const rows = (res.abstracts as any[]).map((a) => ({
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
        'Full Paper URL': a.fullPaperUrl || '',
        'Submitted At': new Date(a.createdAt).toLocaleString('th-TH'),
      }));

      exportToExcel(rows, `abstracts_${eventName.replace(/\s+/g, '_')}`);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  const [selectedAbstract, setSelectedAbstract] = useState<Abstract | null>(
    null,
  );
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
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
      const params: any = { page, limit: 10 };
      if (statusFilter) params.status = statusFilter;
      if (categoryFilter) params.category = categoryFilter;
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

      alert(
        `Abstract ${status === "accepted" ? "approved" : status} successfully!`,
      );
    } catch (error) {
      console.error(error);
      alert(`Failed to ${status} abstract`);
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
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
              <IconFileText size={24} stroke={1.5} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">
                {isLoading ? "-" : totalCount}
              </p>
              <p className="text-sm text-gray-500">Total Submissions</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-800">
            All Submissions
          </h2>
          <button
            onClick={handleExport}
            disabled={!eventSelected || isExporting}
            className="btn-secondary flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isExporting ? <IconLoader2 size={18} className="animate-spin" /> : <IconDownload size={18} />}
            Export Excel
          </button>
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
              placeholder="Search by title, author, or ID..."
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
            <option value="pending">Pending</option>
            <option value="accepted">Accepted</option>
            <option value="rejected">Rejected</option>
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setPage(1);
            }}
            className="input-field w-auto"
            disabled={availableCategories.length === 1}
          >
            {availableCategories.length === 1 ? (
              // Single category - show only that one
              <option value="">{availableCategories[0].label}</option>
            ) : (
              // Multiple categories - show "All Categories" if all assigned or if admin
              <>
                <option value="">
                  {isAdmin ||
                    availableCategories.length === abstractCategories.length
                    ? "All Categories"
                    : `All (${availableCategories.map((c) => c.label).join(", ")})`}
                </option>
                {availableCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.label}
                  </option>
                ))}
              </>
            )}
          </select>

          <select
              value={eventFilter}
              onChange={(e) => { setEventFilter(e.target.value); setEventSelected(!!e.target.value); setPage(1); }}
              className="input-field w-auto"
            >
              <option value="">-- เลือก Event --</option>
              {eventOptions.map((e) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>

          <select
            value={presentationTypeFilter}
            onChange={(e) => {
              setPresentationTypeFilter(e.target.value);
              setPage(1);
            }}
            className="input-field w-auto"
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
        </div>

        {/* Table */}
        {!eventSelected ? (
          <div className="text-center py-16 text-gray-400">
            <IconFileText size={40} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">กรุณาเลือก Event เพื่อดูข้อมูล</p>
          </div>
        ) : isLoading ? (
          <div className="flex justify-center py-12">
            <IconLoader2 size={32} className="animate-spin text-blue-600" />
          </div>
        ) : abstracts.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No abstracts found.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Tracking ID
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider min-w-[300px]">
                    Title & Author
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Presentation
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Submitted
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider w-[120px]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {abstracts.map((abs) => (
                  <tr
                    key={abs.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-4 text-center">
                      <span className="font-mono text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
                        {abs.trackingId || abs.id}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <h5 className="font-medium text-gray-900 mb-1 line-clamp-2">
                        {abs.title}
                      </h5>
                      <p className="text-sm text-gray-500">
                        {abs.author?.firstName} {abs.author?.lastName}
                      </p>
                      {abs.author?.institution && (
                        <p className="text-xs text-gray-400">
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
                        className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${topicColors[abs.category] || "bg-gray-100 text-gray-700"}`}
                      >
                        {abs.category.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span
                        className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[abs.status] || "bg-gray-100 text-gray-700"}`}
                      >
                        {abs.status.charAt(0).toUpperCase() +
                          abs.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className="text-sm text-gray-600">
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
                          className="p-2 hover:bg-blue-50 rounded-lg text-gray-500 hover:text-blue-600 transition-colors"
                          title="View Details"
                          onClick={() => router.push(`/abstracts/${abs.id}`)}
                        >
                          <IconEye size={18} />
                        </button>
                        <button
                          className={`p-2 rounded-lg transition-colors ${abs.status === "pending" ? "hover:bg-green-50 text-gray-500 hover:text-green-600" : "text-gray-200 cursor-not-allowed"}`}
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
                          className={`p-2 rounded-lg transition-colors ${abs.status === "pending" ? "hover:bg-red-50 text-gray-500 hover:text-red-600" : "text-gray-200 cursor-not-allowed"}`}
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
              itemName="abstracts"
            />
          </div>
        )}
      </div>

      {/* Approve Modal */}
      {showApproveModal && selectedAbstract && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full">
            <div className="p-6 bg-green-600 rounded-t-2xl">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <IconCheck size={20} /> Approve Abstract
              </h3>
            </div>
            <div className="p-6 text-center">
              <p className="mb-2 text-gray-600">Approve this abstract?</p>
              <p className="font-semibold text-gray-800">
                {selectedAbstract.title.substring(0, 50)}...
              </p>

              <div className="mt-4 text-left">
                <label className="block text-sm font-medium text-gray-700 mb-1">
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
            <div className="p-6 border-t border-gray-100 flex gap-3 justify-end">
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full">
            <div className="p-6 bg-red-600 rounded-t-2xl">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <IconX size={20} /> Reject Abstract
              </h3>
            </div>
            <div className="p-6 text-center">
              <p className="mb-2 text-gray-600">Reject this abstract?</p>
              <p className="font-semibold text-gray-800">
                {selectedAbstract.title.substring(0, 50)}...
              </p>

              <div className="mt-4 text-left">
                <label className="block text-sm font-medium text-gray-700 mb-1">
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
            <div className="p-6 border-t border-gray-100 flex gap-3 justify-end">
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
    </AdminLayout>
  );
}
