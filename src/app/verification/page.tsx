"use client";

import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/layout";
import { api } from "@/lib/api";
import { exportToExcel } from "@/lib/exportExcel";
import { useAuth } from "@/contexts/AuthContext";
import { Pagination } from "@/components/common";
import toast from "react-hot-toast";
import {
  IconId,
  IconClock,
  IconCheck,
  IconX,
  IconSearch,
  IconEye,
  IconDownload,
  IconFileText,
  IconPhoto,
} from "@tabler/icons-react";

const roleLabels: { [key: string]: { label: string; className: string } } = {
  pharmacist: {
    label: "Pharmacist",
    className: "bg-green-100 text-green-800",
  },
  medical_professional: {
    label: "Medical Professional",
    className: "bg-indigo-100 text-indigo-800",
  },
  student: {
    label: "Student",
    className: "bg-blue-100 text-blue-800",
  },
  general: {
    label: "General",
    className: "bg-gray-100 text-gray-800",
  },
};

interface Verification {
  id: string;
  name: string;
  email: string;
  university: string;
  studentId: string;
  role: string;
  documentType: string;
  documentUrl: string;
  registrationCode: string;
  status: string;
  submittedAt: string;
  verifiedAt?: string;
  verifiedBy?: string;
  rejectionReason?: string;
  resubmissionCount?: number;
}

interface RejectionHistory {
  id: number;
  reason: string;
  rejectedAt: string;
  rejectedBy: number | null;
  rejectedByName: string | null;
}

// Helper to get proxy URL for Google Drive files
function getProxyUrl(url: string | null | undefined): string {
  if (!url) return "";
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  return `${apiUrl}/upload/proxy?url=${encodeURIComponent(url)}`;
}

export default function VerificationPage() {
  const { token } = useAuth();
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedVerification, setSelectedVerification] =
    useState<Verification | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [approveComment, setApproveComment] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [rejectionHistory, setRejectionHistory] = useState<RejectionHistory[]>(
    [],
  );
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Pagination (Server-side)
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Fetch verifications (Server-side pagination)
  const fetchVerifications = async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("page", page.toString());
      params.append("limit", "10");
      if (searchTerm) params.append("search", searchTerm);
      if (statusFilter) params.append("status", statusFilter);

      const data = await api.verifications.list(token, params.toString());
      setVerifications(data.verifications as unknown as Verification[]);
      setTotalCount(data.pagination.total);
      setTotalPages(data.pagination.totalPages);
    } catch (error) {
      console.error("Failed to fetch verifications:", error);
      toast.error("Failed to load verification requests.");
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch rejection history for a specific user
  const fetchRejectionHistory = async (userId: string) => {
    if (!token) return;
    setIsLoadingHistory(true);
    try {
      const data = await api.verifications.getRejectionHistory(token, userId);
      setRejectionHistory(data.history || []);
    } catch (error) {
      console.error("Failed to fetch rejection history:", error);
      setRejectionHistory([]);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleExport = async () => {
    if (!token) return;
    setIsExporting(true);
    try {
      const params = new URLSearchParams();
      params.append("page", "1");
      params.append("limit", "1000");
      if (searchTerm) params.append("search", searchTerm);
      if (statusFilter) params.append("status", statusFilter);

      const data = await api.verifications.list(token, params.toString());
      const rows = (data.verifications as any[]).map((v) => ({
        'Name': v.name,
        'Email': v.email,
        'University/Institution': v.university || '',
        'Student ID': v.studentId || '',
        'Role': v.role,
        'Document Type': v.documentType || '',
        'Status': v.status,
        'Registration Code': v.registrationCode || '',
        'Submitted At': v.submittedAt ? new Date(v.submittedAt).toLocaleString('th-TH') : '',
        'Verified At': v.verifiedAt ? new Date(v.verifiedAt).toLocaleString('th-TH') : '',
        'Verified By': v.verifiedBy || '',
        'Rejection Reason': v.rejectionReason || '',
        'Resubmission Count': v.resubmissionCount ?? 0,
      }));

      exportToExcel(rows, `verifications_${new Date().toISOString().slice(0,10)}`);
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  // Fetch when page, search, or filter changes
  useEffect(() => {
    if (token) {
      fetchVerifications();
    }
  }, [token, page]);

  // Reset to page 1 when filter changes
  useEffect(() => {
    setPage(1);
    if (token) {
      fetchVerifications();
    }
  }, [searchTerm, statusFilter]);

  // Stats (fetch all for stats, or use separate endpoint)
  const [allVerifications, setAllVerifications] = useState<Verification[]>([]);
  
  const fetchStats = async () => {
    if (!token) return;
    try {
      // Fetch all for stats only (max limit=100)
      const params = new URLSearchParams();
      params.append("page", "1");
      params.append("limit", "100");
      const data = await api.verifications.list(token, params.toString());
      setAllVerifications(data.verifications as unknown as Verification[]);
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    }
  };

  useEffect(() => {
    if (token) {
      fetchStats();
    }
  }, [token]);

  const stats = {
    total: allVerifications.length,
    pending: allVerifications.filter((v) => v.status === "pending").length,
    approved: allVerifications.filter((v) => v.status === "approved").length,
    rejected: allVerifications.filter((v) => v.status === "rejected").length,
  };

  const handleApprove = async () => {
    if (!selectedVerification || !token) return;
    try {
      await api.verifications.approve(
        token,
        selectedVerification.id,
        approveComment || undefined,
      );
      toast.success("Student verification approved!");
      fetchVerifications(); // Refresh list
      setShowApproveModal(false);
      setSelectedVerification(null);
      setApproveComment("");
    } catch (error) {
      console.error("Approval failed:", error);
      toast.error("Failed to approve verification.");
    }
  };

  const handleReject = async () => {
    if (!selectedVerification || !token || !rejectionReason) return;
    try {
      await api.verifications.reject(
        token,
        selectedVerification.id,
        rejectionReason,
      );
      toast.success("Verification rejected.");
      fetchVerifications(); // Refresh list
      setShowRejectModal(false);
      setSelectedVerification(null);
      setRejectionReason("");
    } catch (error) {
      console.error("Rejection failed:", error);
      toast.error("Failed to reject verification.");
    }
  };

  return (
    <AdminLayout title="Student Verification">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="card py-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
              <IconId size={24} stroke={1.5} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
              <p className="text-sm text-gray-500">Total Requests</p>
            </div>
          </div>
        </div>
        <div className="card py-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center text-yellow-600">
              <IconClock size={24} stroke={1.5} />
            </div>
            <div>
              <p className="text-2xl font-bold text-yellow-600">
                {stats.pending}
              </p>
              <p className="text-sm text-gray-500">Pending Review</p>
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
                {stats.approved}
              </p>
              <p className="text-sm text-gray-500">Approved</p>
            </div>
          </div>
        </div>
        <div className="card py-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center text-red-600">
              <IconX size={24} stroke={1.5} />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">
                {stats.rejected}
              </p>
              <p className="text-sm text-gray-500">Rejected</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-800">
            Verification Requests
          </h2>
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="btn-secondary flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isExporting
              ? <span className="animate-spin inline-block w-[18px] h-[18px] border-2 border-current border-t-transparent rounded-full" />
              : <IconDownload size={18} />}
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
              placeholder="Search by name, email, or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field-search"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input-field w-auto"
          >
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-500">Loading verifications...</span>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Student Info
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      University
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Document
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Submitted
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {verifications.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="text-center py-8 text-gray-500"
                      >
                        No verification requests found
                      </td>
                    </tr>
                  ) : (
                    verifications.map((v) => (
                      <tr
                        key={v.id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-4 py-4 text-center">
                          <span className="font-mono text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded">
                            {v.id}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <div>
                            <p className="font-medium text-gray-900">
                              {v.name}
                            </p>
                            <p className="text-sm text-gray-500">{v.email}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${roleLabels[v.role]?.className}`}
                              >
                                {roleLabels[v.role]?.label}
                              </span>
                              {v.resubmissionCount &&
                                v.resubmissionCount > 0 && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200">
                                    🔄 Resubmitted ({v.resubmissionCount})
                                  </span>
                                )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <p className="text-gray-900 font-medium">
                            {v.university}
                          </p>
                          <p className="text-sm text-gray-500 font-mono">
                            ID: {v.studentId}
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <IconFileText size={16} className="text-gray-400" />
                            <span className="text-sm text-gray-600">
                              {v.documentType}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${v.status === "approved"
                              ? "bg-green-50 text-green-700 border-green-200"
                              : v.status === "pending"
                                ? "bg-yellow-50 text-yellow-700 border-yellow-200"
                                : "bg-red-50 text-red-700 border-red-200"
                              }`}
                          >
                            {v.status === "approved" && (
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                            )}
                            {v.status === "pending" && (
                              <span className="w-1.5 h-1.5 rounded-full bg-yellow-500"></span>
                            )}
                            {v.status === "rejected" && (
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                            )}
                            {v.status.charAt(0).toUpperCase() +
                              v.status.slice(1)}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className="text-sm text-gray-600">
                            {new Date(v.submittedAt).toLocaleDateString(
                              "th-TH",
                              {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                                hour: "numeric",
                                minute: "2-digit",
                                hour12: true,
                                timeZone: "Asia/Bangkok",
                              },
                            )}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <div className="flex gap-1 justify-center items-center">
                            <button
                              className="p-2 hover:bg-blue-50 rounded-lg text-gray-500 hover:text-blue-600 transition-colors"
                              title="View Document"
                              onClick={() => {
                                setSelectedVerification(v);
                                setShowViewModal(true);
                                fetchRejectionHistory(v.id);
                              }}
                            >
                              <IconEye size={18} />
                            </button>
                            {v.status === "pending" && (
                              <>
                                <button
                                  className="p-2 hover:bg-green-50 rounded-lg text-gray-500 hover:text-green-600 transition-colors"
                                  title="Approve"
                                  onClick={() => {
                                    setSelectedVerification(v);
                                    setShowApproveModal(true);
                                  }}
                                >
                                  <IconCheck size={18} />
                                </button>
                                <button
                                  className="p-2 hover:bg-red-50 rounded-lg text-gray-500 hover:text-red-600 transition-colors"
                                  title="Reject"
                                  onClick={() => {
                                    setSelectedVerification(v);
                                    setShowRejectModal(true);
                                  }}
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

            {/* Pagination */}
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

      {/* View Modal */}
      {showViewModal && selectedVerification && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold flex items-center gap-2 text-gray-800">
                  <IconId size={20} /> -Verification Details
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
              <div className="flex gap-2 mb-4">
                <span className="font-mono text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded">
                  {selectedVerification.id}
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${selectedVerification.status === "approved"
                    ? "bg-green-50 text-green-700 border-green-200"
                    : selectedVerification.status === "pending"
                      ? "bg-yellow-50 text-yellow-700 border-yellow-200"
                      : "bg-red-50 text-red-700 border-red-200"
                    }`}
                >
                  {selectedVerification.status === "approved" && (
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                  )}
                  {selectedVerification.status === "pending" && (
                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-500"></span>
                  )}
                  {selectedVerification.status === "rejected" && (
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                  )}
                  {selectedVerification.status.charAt(0).toUpperCase() +
                    selectedVerification.status.slice(1)}
                </span>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${roleLabels[selectedVerification.role]?.className}`}
                >
                  {roleLabels[selectedVerification.role]?.label}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-sm text-gray-500">Full Name</p>
                  <p className="font-semibold text-gray-800">
                    {selectedVerification.name}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Email</p>
                  <p className="text-gray-700">{selectedVerification.email}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">University</p>
                  <p className="font-semibold text-gray-800">
                    {selectedVerification.university}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Student ID</p>
                  <p className="font-mono text-gray-700">
                    {selectedVerification.studentId}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Registration Code</p>
                  <p className="font-mono text-gray-700">
                    {selectedVerification.registrationCode}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Submitted</p>
                  <p className="text-gray-700">
                    {new Date(selectedVerification.submittedAt).toLocaleString(
                      "th-TH",
                      { timeZone: "Asia/Bangkok" },
                    )}
                  </p>
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <h5 className="font-semibold mb-3 flex items-center gap-2 text-gray-800">
                  <IconPhoto size={18} /> Uploaded Document
                </h5>
                <p className="text-sm text-gray-600 mb-2">
                  {selectedVerification.documentType}
                </p>
                <div className="border border-gray-200 rounded-lg overflow-hidden bg-white p-8 text-center">
                  {selectedVerification.documentUrl ? (
                    <object
                      data={getProxyUrl(selectedVerification.documentUrl)}
                      className="w-full h-96 object-contain"
                      type="image/jpeg"
                    >
                      <iframe
                        src={getProxyUrl(selectedVerification.documentUrl)}
                        className="w-full h-96"
                        title="Document Preview"
                      />
                    </object>
                  ) : (
                    <div className="w-full h-64 flex items-center justify-center text-gray-400">
                      No document uploaded
                    </div>
                  )}
                </div>
                {selectedVerification.documentUrl && (
                  <a
                    href={selectedVerification.documentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    <IconEye size={16} /> Open in New Tab
                  </a>
                )}
              </div>

              {selectedVerification.status === "rejected" &&
                selectedVerification.rejectionReason && (
                  <div className="mt-4 bg-red-50 p-4 rounded-lg">
                    <p className="text-sm font-semibold text-red-800">
                      Latest Rejection Reason:
                    </p>
                    <p className="text-red-700">
                      {selectedVerification.rejectionReason}
                    </p>
                  </div>
                )}

              {/* Rejection History Section */}
              {isLoadingHistory ? (
                <div className="mt-4 flex items-center justify-center py-4">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-orange-600"></div>
                  <span className="ml-2 text-sm text-gray-500">
                    Loading history...
                  </span>
                </div>
              ) : (
                rejectionHistory.length > 0 && (
                  <div className="mt-4 bg-orange-50 p-4 rounded-lg border border-orange-200">
                    <p className="text-sm font-semibold text-orange-800 mb-3 flex items-center gap-2">
                      📋 Rejection History ({rejectionHistory.length})
                    </p>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {rejectionHistory.map((history, index) => (
                        <div
                          key={history.id}
                          className="bg-white p-3 rounded-lg border border-orange-100 shadow-sm"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium text-orange-600">
                              #{rejectionHistory.length - index}
                            </span>
                            <span className="text-xs text-gray-500">
                              {new Date(history.rejectedAt).toLocaleString(
                                "th-TH",
                                {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                  hour: "numeric",
                                  minute: "2-digit",
                                  hour12: true,
                                  timeZone: "Asia/Bangkok",
                                },
                              )}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700">
                            {history.reason}
                          </p>
                          {history.rejectedByName && (
                            <p className="text-xs text-gray-500 mt-1">
                              Rejected by:{" "}
                              <span className="font-medium">
                                {history.rejectedByName}
                              </span>
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              )}
            </div>
            <div className="p-6 border-t border-gray-100 flex gap-3 justify-end">
              <button
                onClick={() => setShowViewModal(false)}
                className="btn-secondary"
              >
                Close
              </button>
              {selectedVerification.status === "pending" && (
                <>
                  <button
                    onClick={() => {
                      setShowViewModal(false);
                      setShowApproveModal(true);
                    }}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2"
                  >
                    <IconCheck size={18} /> Approve
                  </button>
                  <button
                    onClick={() => {
                      setShowViewModal(false);
                      setShowRejectModal(true);
                    }}
                    className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 flex items-center gap-2"
                  >
                    <IconX size={18} /> Reject
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Approve Modal */}
      {showApproveModal && selectedVerification && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full">
            <div className="p-6 bg-green-600 rounded-t-2xl">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <IconCheck size={20} /> Approve Verification
              </h3>
            </div>
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <IconCheck size={32} className="text-green-600" />
              </div>
              <p className="mb-2 text-gray-600">
                Approve student verification for:
              </p>
              <p className="text-xl font-semibold text-gray-800">
                {selectedVerification.name}
              </p>
              <p className="text-gray-500">{selectedVerification.university}</p>

              <div className="mt-4 bg-blue-50 p-3 rounded-lg text-left text-sm border border-blue-200">
                <p className="font-semibold text-blue-900">
                  What happens next:
                </p>
                <ul className="list-disc list-inside text-blue-800 mt-1">
                  <li>Registration will be updated to student rate</li>
                  <li>User will receive confirmation email</li>
                  <li className="text-blue-800">
                    Student badge will be added to registration
                  </li>
                </ul>
              </div>

              <div className="mt-4 text-left">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Comment (optional)
                </label>
                <textarea
                  className="input-field h-20"
                  placeholder="Add a comment for the confirmation email..."
                  value={approveComment}
                  onChange={(e) => setApproveComment(e.target.value)}
                />
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 flex gap-3 justify-end">
              <button
                onClick={() => setShowApproveModal(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleApprove}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
              >
                Approve Verification
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedVerification && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full">
            <div className="p-6 bg-red-600 rounded-t-2xl">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <IconX size={20} /> Reject Verification
              </h3>
            </div>
            <div className="p-6">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <IconX size={32} className="text-red-600" />
              </div>
              <p className="text-center mb-2 text-gray-600">
                Reject verification for:
              </p>
              <p className="text-center text-xl font-semibold text-gray-800 mb-4">
                {selectedVerification.name}
              </p>

              <div className="text-left">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rejection Reason <span className="text-red-500">*</span>
                </label>
                <select
                  className="input-field mb-3"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                >
                  <option value="">Select reason...</option>
                  <option value="Document expired">Document expired</option>
                  <option value="Document not readable/unclear">
                    Document not readable/unclear
                  </option>
                  <option value="Name does not match registration">
                    Name does not match registration
                  </option>
                  <option value="Invalid document type">
                    Invalid document type
                  </option>
                  <option value="Suspected fraudulent document">
                    Suspected fraudulent document
                  </option>
                  <option value="Other">Other</option>
                </select>

                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Additional Notes
                </label>
                <textarea
                  className="input-field h-20"
                  placeholder="Provide details to help user resubmit..."
                ></textarea>
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 flex gap-3 justify-end">
              <button
                onClick={() => setShowRejectModal(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50"
                disabled={!rejectionReason}
              >
                Reject Verification
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
