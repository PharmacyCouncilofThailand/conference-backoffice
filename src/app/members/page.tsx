"use client";

import { useState, useEffect, useCallback } from "react";
import { AdminLayout } from "@/components/layout";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Pagination } from "@/components/common";
import {
  IconSearch,
  IconRefresh,
  IconUsers,
  IconUserCheck,
  IconClock,
  IconUserX,
  IconMail,
  IconPhone,
  IconBuilding,
  IconWorld,
  IconTrash,
} from "@tabler/icons-react";

// Types
interface Member {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: "pharmacist" | "medical_professional" | "student" | "general";
  status: "pending_approval" | "active" | "rejected";
  phone: string | null;
  country: string | null;
  institution: string | null;
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// Role labels
const roleLabels: Record<string, { label: string; className: string }> = {
  pharmacist: { label: "Pharmacist", className: "bg-green-100 text-green-800" },
  medical_professional: {
    label: "Medical Professional",
    className: "bg-indigo-100 text-indigo-800",
  },
  student: { label: "Student", className: "bg-blue-100 text-blue-800" },
  guest: {
    label: "Guest",
    className: "bg-teal-100 text-teal-800",
  },
  general: {
    label: "General",
    className: "bg-gray-100 text-gray-800",
  },
  admin: {
    label: "Admin",
    className: "bg-red-100 text-red-800",
  },
};

// Status labels
const statusLabels: Record<string, { label: string; className: string }> = {
  pending_approval: {
    label: "Pending",
    className: "bg-yellow-50 text-yellow-700 border-yellow-200",
  },
  active: {
    label: "Active",
    className: "bg-green-50 text-green-700 border-green-200",
  },
  rejected: {
    label: "Rejected",
    className: "bg-red-50 text-red-700 border-red-200",
  },
};

export default function MembersPage() {
  const { token } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [eventFilter, setEventFilter] = useState("");
  const [eventOptions, setEventOptions] = useState<{ id: number; name: string }[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Member | null>(null);

  // Stats (global totals from API)
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    pending: 0,
    rejected: 0,
  });

  const fetchStats = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api.members.stats(token);
      const getCount = (status: string) =>
        data.byStatus.find((s: any) => s.status === status)?.count || 0;
      setStats({
        total: data.total,
        active: getCount("active"),
        pending: getCount("pending_approval"),
        rejected: getCount("rejected"),
      });
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    }
  }, [token]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Fetch events for filter dropdown
  useEffect(() => {
    if (!token) return;
    api.backofficeEvents.list(token, 'limit=100').then((res) => {
      setEventOptions((res.events as any[]).map((e) => ({ id: e.id as number, name: e.eventName as string })));
    }).catch(() => {});
  }, [token]);

  const fetchMembers = useCallback(async () => {
    if (!token) return;

    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("page", currentPage.toString());
      params.append("limit", "10");
      if (search) params.append("search", search);
      if (roleFilter) params.append("role", roleFilter);
      if (statusFilter) params.append("status", statusFilter);
      if (eventFilter) params.append("eventId", eventFilter);

      const response = await api.members.list(token, params.toString());
      setMembers(response.members as unknown as Member[]);
      setPagination(response.pagination);
    } catch (error) {
      console.error("Failed to fetch members:", error);
    } finally {
      setLoading(false);
    }
  }, [token, currentPage, search, roleFilter, statusFilter, eventFilter]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const handleReset = () => {
    setSearch("");
    setRoleFilter("");
    setStatusFilter("");
    setEventFilter("");
    setCurrentPage(1);
  };

  const handleDelete = async () => {
    if (!token || !deleteConfirm) return;
    setDeletingId(deleteConfirm.id);
    try {
      await api.members.delete(token, deleteConfirm.id);
      setDeleteConfirm(null);
      fetchMembers();
      fetchStats();
    } catch (error) {
      console.error("Failed to delete member:", error);
      alert(error instanceof Error ? error.message : "Failed to delete member");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <AdminLayout title="Members">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="card py-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
              <IconUsers size={24} stroke={1.5} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
              <p className="text-sm text-gray-500">Total Members</p>
            </div>
          </div>
        </div>
        <div className="card py-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center text-green-600">
              <IconUserCheck size={24} stroke={1.5} />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">
                {stats.active}
              </p>
              <p className="text-sm text-gray-500">Active</p>
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
              <p className="text-sm text-gray-500">Pending</p>
            </div>
          </div>
        </div>
        <div className="card py-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center text-red-600">
              <IconUserX size={24} stroke={1.5} />
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
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <h2 className="text-lg font-semibold text-gray-800">Member List</h2>
          <div className="relative flex-1 max-w-md">
            <IconSearch
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              size={18}
            />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field !pl-10"
            />
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="input-field w-auto"
          >
            <option value="">All Roles</option>
            <option value="pharmacist">Pharmacist</option>
            <option value="medical_professional">Medical Professional</option>
            <option value="student">Student</option>
            <option value="general">General</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="input-field w-auto"
          >
            <option value="">All Status</option>
            <option value="pending_approval">Pending</option>
            <option value="active">Active</option>
            <option value="rejected">Rejected</option>
          </select>

          {eventOptions.length > 1 && (
            <select
              value={eventFilter}
              onChange={(e) => { setEventFilter(e.target.value); setCurrentPage(1); }}
              className="input-field w-auto"
            >
              <option value="">All Events</option>
              {eventOptions.map((e) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={handleReset}
            className="btn-secondary"
            title="Reset filters"
          >
            <IconRefresh size={18} />
          </button>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-500">Loading members...</span>
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
                      Member
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Institution
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Joined
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {members.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="text-center py-8 text-gray-500"
                      >
                        No members found
                      </td>
                    </tr>
                  ) : (
                    members.map((member) => (
                      <tr
                        key={member.id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-4 py-4 text-center">
                          <span className="font-mono text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded">
                            {member.id}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-medium">
                              {member.firstName.charAt(0)}
                              {member.lastName.charAt(0)}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">
                                {member.firstName} {member.lastName}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <IconMail size={14} />
                              {member.email}
                            </div>
                            {member.phone && (
                              <div className="flex items-center gap-2 text-sm text-gray-600">
                                <IconPhone size={14} />
                                {member.phone}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium ${roleLabels[member.role]?.className}`}
                          >
                            {roleLabels[member.role]?.label}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${statusLabels[member.status]?.className}`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${member.status === "active"
                                  ? "bg-green-500"
                                  : member.status === "pending_approval"
                                    ? "bg-yellow-500"
                                    : "bg-red-500"
                                }`}
                            ></span>
                            {statusLabels[member.status]?.label}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="space-y-1">
                            {member.institution && (
                              <div className="flex items-center gap-2 text-sm text-gray-600">
                                <IconBuilding size={14} />
                                {member.institution}
                              </div>
                            )}
                            {member.country && (
                              <div className="flex items-center gap-2 text-sm text-gray-500">
                                <IconWorld size={14} />
                                {member.country}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className="text-sm text-gray-600">
                            {new Date(member.createdAt).toLocaleDateString(
                              "th-TH",
                              {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              },
                            )}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <button
                            type="button"
                            onClick={() => setDeleteConfirm(member)}
                            disabled={deletingId === member.id}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                            title="Delete member"
                          >
                            {deletingId === member.id ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                            ) : (
                              <IconTrash size={18} stroke={1.5} />
                            )}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <Pagination
              currentPage={currentPage}
              totalPages={pagination?.totalPages || 1}
              totalCount={pagination?.total || 0}
              onPageChange={setCurrentPage}
              itemName="members"
            />
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center text-red-600">
                <IconTrash size={20} />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">
                Delete Member
              </h3>
            </div>
            <p className="text-gray-600 mb-2">
              Are you sure you want to delete{" "}
              <span className="font-medium text-gray-900">
                {deleteConfirm.firstName} {deleteConfirm.lastName}
              </span>
              ?
            </p>
            <p className="text-sm text-red-600 mb-6">
              This will permanently remove the member and all related data
              (orders, registrations, abstracts, etc.).
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="btn-secondary"
                disabled={deletingId !== null}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deletingId !== null}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deletingId !== null ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
