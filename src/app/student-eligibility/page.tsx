"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminLayout } from "@/components/layout";
import { Pagination } from "@/components/common";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import type { StudentEligibilityRequest, StudentEligibilityStatus } from "@/types/api";
import toast from "react-hot-toast";
import {
  IconCheck,
  IconClock,
  IconEye,
  IconFileCertificate,
  IconFileText,
  IconRefresh,
  IconSearch,
  IconX,
} from "@tabler/icons-react";

type EventOption = {
  id: number;
  eventCode?: string;
  eventName?: string;
};

const statusStyles: Record<StudentEligibilityStatus, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected: "bg-rose-50 text-rose-700 border-rose-200",
  cancelled: "bg-slate-50 text-slate-600 border-slate-200",
};

function getProxyUrl(url: string | null | undefined): string {
  if (!url) return "";
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (url.includes("/api/files/")) {
    const fileId = url.split("/api/files/").pop();
    return `${apiUrl}/api/files/${fileId}`;
  }
  if (url.includes("drive.google.com")) {
    return `${apiUrl}/api/upload/proxy?url=${encodeURIComponent(url)}`;
  }
  return url;
}

function formatFileSize(size?: number | null): string {
  if (!size) return "-";
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

export default function StudentEligibilityPage() {
  const { token } = useAuth();
  const [requests, setRequests] = useState<StudentEligibilityRequest[]>([]);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [eventFilter, setEventFilter] = useState("");
  const [selectedRequest, setSelectedRequest] = useState<StudentEligibilityRequest | null>(null);
  const [reviewMode, setReviewMode] = useState<"approve" | "reject" | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const selectedDocumentUrl = useMemo(
    () => getProxyUrl(selectedRequest?.documentUrl),
    [selectedRequest],
  );

  const fetchEvents = async () => {
    if (!token) return;
    try {
      const data = await api.backofficeEvents.list(token, "limit=100");
      setEvents(
        (data.events || []).map((event) => ({
          id: Number(event.id),
          eventCode: String(event.eventCode || ""),
          eventName: String(event.eventName || ""),
        })),
      );
    } catch {
      toast.error("Failed to load events.");
    }
  };

  const fetchRequests = async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("page", page.toString());
      params.append("limit", "10");
      if (searchTerm) params.append("search", searchTerm);
      if (statusFilter) params.append("status", statusFilter);
      if (eventFilter) params.append("eventId", eventFilter);

      const data = await api.studentEligibilityRequests.list(token, params.toString());
      setRequests(data.requests);
      setTotalCount(data.pagination.total);
      setTotalPages(data.pagination.totalPages);
    } catch (error) {
      console.error("Failed to fetch student eligibility requests:", error);
      toast.error("Failed to load postgraduate eligibility requests.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [token]);

  useEffect(() => {
    fetchRequests();
  }, [token, page, searchTerm, statusFilter, eventFilter]);

  const resetReviewState = () => {
    setReviewMode(null);
    setSelectedRequest(null);
    setReviewNote("");
    setRejectionReason("");
  };

  const submitReview = async () => {
    if (!token || !selectedRequest || !reviewMode) return;
    if (reviewMode === "reject" && !rejectionReason.trim()) {
      toast.error("Please provide a rejection reason.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (reviewMode === "approve") {
        await api.studentEligibilityRequests.review(token, selectedRequest.id, {
          status: "approved",
          reviewNote: reviewNote || undefined,
        });
        toast.success("Postgraduate eligibility approved.");
      } else {
        await api.studentEligibilityRequests.review(token, selectedRequest.id, {
          status: "rejected",
          rejectionReason,
          reviewNote: reviewNote || undefined,
        });
        toast.success("Postgraduate eligibility rejected.");
      }

      resetReviewState();
      fetchRequests();
    } catch (error) {
      console.error("Failed to submit review:", error);
      toast.error("Failed to submit review.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AdminLayout title="Postgraduate Student Eligibility">
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Requests</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{totalCount}</p>
              </div>
              <IconFileCertificate className="text-blue-600" size={32} />
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Pending Review</p>
                <p className="text-3xl font-bold text-amber-600 mt-1">
                  {requests.filter((item) => item.status === "pending").length}
                </p>
              </div>
              <IconClock className="text-amber-500" size={32} />
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Fixed Level</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">Postgraduate</p>
              </div>
              <IconFileText className="text-emerald-600" size={32} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-gray-100">
            <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Pharmacist Postgraduate Requests</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Approval applies only to the selected event and unlocks postgraduate student-rate tickets.
                </p>
              </div>
              <button
                onClick={fetchRequests}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                <IconRefresh size={16} />
                Refresh
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[1fr_180px_240px] gap-3 mt-5">
              <div className="relative">
                <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  value={searchTerm}
                  onChange={(event) => {
                    setPage(1);
                    setSearchTerm(event.target.value);
                  }}
                  placeholder="Search name, email, license, or event..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(event) => {
                  setPage(1);
                  setStatusFilter(event.target.value);
                }}
                className="px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
              >
                <option value="">All Status</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
              <select
                value={eventFilter}
                onChange={(event) => {
                  setPage(1);
                  setEventFilter(event.target.value);
                }}
                className="px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
              >
                <option value="">All Events</option>
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.eventCode || event.eventName || `Event ${event.id}`}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Applicant</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Event</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Document</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-12 text-center text-gray-500">
                      Loading requests...
                    </td>
                  </tr>
                ) : requests.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-12 text-center text-gray-500">
                      No postgraduate eligibility requests found.
                    </td>
                  </tr>
                ) : (
                  requests.map((request) => (
                    <tr key={request.id} className="hover:bg-gray-50">
                      <td className="px-5 py-4">
                        <p className="font-semibold text-gray-900">{request.name}</p>
                        <p className="text-sm text-gray-500">{request.email}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          License: {request.pharmacyLicenseId || "-"}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-semibold text-gray-900">{request.eventCode}</p>
                        <p className="text-sm text-gray-500">{request.eventName}</p>
                        <p className="text-xs text-blue-600 font-semibold mt-1">Postgraduate only</p>
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-sm font-medium text-gray-900 max-w-[220px] truncate">
                          {request.documentFileName}
                        </p>
                        <p className="text-xs text-gray-400">{formatFileSize(request.documentFileSize)}</p>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex px-2.5 py-1 rounded-full border text-xs font-semibold capitalize ${statusStyles[request.status]}`}>
                          {request.status}
                        </span>
                        <p className="text-xs text-gray-400 mt-2">
                          {new Date(request.createdAt).toLocaleString()}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setSelectedRequest(request)}
                            className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100"
                            title="View"
                          >
                            <IconEye size={18} />
                          </button>
                          {request.status === "pending" && (
                            <>
                              <button
                                onClick={() => {
                                  setSelectedRequest(request);
                                  setReviewMode("approve");
                                }}
                                className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                                title="Approve"
                              >
                                <IconCheck size={18} />
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedRequest(request);
                                  setReviewMode("reject");
                                }}
                                className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-rose-600 text-white hover:bg-rose-700"
                                title="Reject"
                              >
                                <IconX size={18} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="p-4 border-t border-gray-100">
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                totalCount={totalCount}
                onPageChange={setPage}
                itemName="requests"
              />
            </div>
          )}
        </div>
      </div>

      {selectedRequest && !reviewMode && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-start justify-between">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Eligibility Request</h3>
                <p className="text-sm text-gray-500 mt-1">{selectedRequest.eventName}</p>
              </div>
              <button onClick={resetReviewState} className="p-2 rounded-lg hover:bg-gray-100">
                <IconX size={20} />
              </button>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase">Applicant</p>
                <p className="font-bold text-gray-900 mt-1">{selectedRequest.name}</p>
                <p className="text-sm text-gray-600">{selectedRequest.email}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase">Pharmacy License</p>
                <p className="font-bold text-gray-900 mt-1">{selectedRequest.pharmacyLicenseId || "-"}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase">Requested Level</p>
                <p className="font-bold text-gray-900 mt-1">Postgraduate</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase">Status</p>
                <span className={`mt-1 inline-flex px-2.5 py-1 rounded-full border text-xs font-semibold capitalize ${statusStyles[selectedRequest.status]}`}>
                  {selectedRequest.status}
                </span>
              </div>
              {selectedRequest.rejectionReason && (
                <div className="md:col-span-2 rounded-xl bg-rose-50 border border-rose-100 p-4">
                  <p className="text-xs font-semibold text-rose-700 uppercase">Rejection Reason</p>
                  <p className="text-sm text-rose-900 mt-1">{selectedRequest.rejectionReason}</p>
                </div>
              )}
              <div className="md:col-span-2 rounded-xl border border-gray-200 p-4">
                <p className="text-xs font-semibold text-gray-500 uppercase">Document</p>
                <div className="mt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <p className="font-semibold text-gray-900">{selectedRequest.documentFileName}</p>
                    <p className="text-sm text-gray-500">{formatFileSize(selectedRequest.documentFileSize)}</p>
                  </div>
                  <a
                    href={selectedDocumentUrl || selectedRequest.documentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800"
                  >
                    <IconEye size={16} />
                    Open Document
                  </a>
                </div>
              </div>
            </div>
            {selectedRequest.status === "pending" && (
              <div className="p-6 border-t border-gray-100 flex flex-col sm:flex-row justify-end gap-3">
                <button
                  onClick={() => setReviewMode("reject")}
                  className="px-5 py-3 rounded-lg bg-rose-600 text-white font-semibold hover:bg-rose-700"
                >
                  Reject
                </button>
                <button
                  onClick={() => setReviewMode("approve")}
                  className="px-5 py-3 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700"
                >
                  Approve
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {selectedRequest && reviewMode && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className={`p-6 text-white ${reviewMode === "approve" ? "bg-emerald-600" : "bg-rose-600"}`}>
              <h3 className="text-xl font-bold">
                {reviewMode === "approve" ? "Approve Eligibility" : "Reject Eligibility"}
              </h3>
              <p className="text-sm text-white/80 mt-1">{selectedRequest.name}</p>
            </div>
            <div className="p-6 space-y-4">
              {reviewMode === "reject" && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Rejection Reason <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    value={rejectionReason}
                    onChange={(event) => setRejectionReason(event.target.value)}
                    rows={4}
                    className="w-full rounded-lg border border-gray-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-rose-100 focus:border-rose-400"
                    placeholder="Explain why this document cannot be approved..."
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Email Comment <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  value={reviewNote}
                  onChange={(event) => setReviewNote(event.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-gray-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
                  placeholder="Optional comment to include in the approval/rejection email..."
                />
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={resetReviewState}
                disabled={isSubmitting}
                className="px-5 py-3 rounded-lg bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={submitReview}
                disabled={isSubmitting || (reviewMode === "reject" && !rejectionReason.trim())}
                className={`px-5 py-3 rounded-lg text-white font-semibold disabled:opacity-60 ${
                  reviewMode === "approve" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"
                }`}
              >
                {isSubmitting ? "Saving..." : reviewMode === "approve" ? "Approve" : "Reject"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
