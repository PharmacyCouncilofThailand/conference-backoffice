"use client";

import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/layout";
import { api } from "@/lib/api";
import toast from "react-hot-toast";
import {
  IconCategory,
  IconPlus,
  IconPencil,
  IconTrash,
  IconSearch,
  IconCheck,
  IconX,
  IconLoader2,
  IconCalendarEvent,
  IconAlertTriangle,
  IconToggleLeft,
  IconToggleRight,
} from "@tabler/icons-react";

interface Category {
  id: number;
  eventId: number;
  name: string;
  isActive: boolean;
  createdAt: string;
  eventCode: string | null;
  eventName: string | null;
}

interface EventOption {
  id: number;
  eventCode: string;
  eventName: string;
}

const getBackofficeToken = () =>
  localStorage.getItem("backoffice_token") ||
  sessionStorage.getItem("backoffice_token") ||
  "";

export default function AbstractCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [eventFilter, setEventFilter] = useState<number | "">("");

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(
    null,
  );

  const [formData, setFormData] = useState({
    eventId: null as number | null,
    name: "",
    isActive: true,
  });

  useEffect(() => {
    fetchCategories();
    fetchEvents();
  }, [eventFilter]);

  const fetchEvents = async () => {
    try {
      const token = getBackofficeToken();
      const res = await api.backofficeEvents.list(token);
      setEvents(
        (res.events || []).map((e: Record<string, unknown>) => ({
          id: e.id as number,
          eventCode: e.eventCode as string,
          eventName: e.eventName as string,
        })),
      );
    } catch (error) {
      console.error("Failed to fetch events:", error);
    }
  };

  const fetchCategories = async () => {
    setIsLoading(true);
    try {
      const token = getBackofficeToken();
      const query = eventFilter ? `eventId=${eventFilter}` : "";
      const res = await api.abstractCategories.list(token, query);
      setCategories((res.categories || []) as unknown as Category[]);
    } catch (error) {
      console.error("Failed to fetch categories:", error);
      toast.error("Failed to load categories");
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      eventId: null,
      name: "",
      isActive: true,
    });
  };

  const openCreateModal = () => {
    resetForm();
    // Pre-select event if filter is active
    if (eventFilter) {
      setFormData((prev) => ({ ...prev, eventId: eventFilter as number }));
    }
    setShowCreateModal(true);
  };

  const openEditModal = (cat: Category) => {
    setSelectedCategory(cat);
    setFormData({
      eventId: cat.eventId,
      name: cat.name,
      isActive: cat.isActive,
    });
    setShowEditModal(true);
  };

  const openDeleteModal = (cat: Category) => {
    setSelectedCategory(cat);
    setShowDeleteModal(true);
  };

  const handleCreate = async () => {
    if (!formData.eventId || !formData.name) {
      toast.error("Event and name are required");
      return;
    }
    setIsSubmitting(true);
    try {
      const token = getBackofficeToken();
      await api.abstractCategories.create(token, formData);
      toast.success("Category created successfully");
      setShowCreateModal(false);
      fetchCategories();
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create category",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedCategory) return;
    setIsSubmitting(true);
    try {
      const token = getBackofficeToken();
      await api.abstractCategories.update(token, selectedCategory.id, {
        name: formData.name,
        isActive: formData.isActive,
      });
      toast.success("Category updated successfully");
      setShowEditModal(false);
      fetchCategories();
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update category",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedCategory) return;
    setIsSubmitting(true);
    try {
      const token = getBackofficeToken();
      await api.abstractCategories.delete(token, selectedCategory.id);
      toast.success("Category deleted");
      setShowDeleteModal(false);
      fetchCategories();
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete category",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggle = async (cat: Category) => {
    try {
      const token = getBackofficeToken();
      await api.abstractCategories.toggle(token, cat.id);
      toast.success(
        cat.isActive ? "Category deactivated" : "Category activated",
      );
      fetchCategories();
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Failed to toggle category",
      );
    }
  };

  const handleNameChange = (value: string) => {
    setFormData((prev) => ({ ...prev, name: value }));
  };

  // Filter categories by search
  const filteredCategories = categories.filter(
    (cat) =>
      cat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (cat.eventCode || "").toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // Compute stats
  const stats = {
    total: categories.length,
    active: categories.filter((c) => c.isActive).length,
    inactive: categories.filter((c) => !c.isActive).length,
  };

  return (
    <AdminLayout title="Abstract Categories">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="card py-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
              <IconCategory size={24} stroke={1.5} />
            </div>
            <div>
              <p className="text-2xl font-bold text-zinc-800">{stats.total}</p>
              <p className="text-sm text-zinc-400">Total Categories</p>
            </div>
          </div>
        </div>
        <div className="card py-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center text-green-600">
              <IconCheck size={24} stroke={1.5} />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{stats.active}</p>
              <p className="text-sm text-zinc-400">Active</p>
            </div>
          </div>
        </div>
        <div className="card py-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-zinc-100 rounded-xl flex items-center justify-center text-zinc-400">
              <IconX size={24} stroke={1.5} />
            </div>
            <div>
              <p className="text-2xl font-bold text-zinc-400">{stats.inactive}</p>
              <p className="text-sm text-zinc-400">Inactive</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-zinc-800">All Categories</h2>
          <button
            onClick={openCreateModal}
            className="btn-primary flex items-center gap-2"
          >
            <IconPlus size={18} /> Add Category
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <select
            value={eventFilter}
            onChange={(e) =>
              setEventFilter(
                e.target.value ? parseInt(e.target.value, 10) : "",
              )
            }
            className="input-field w-auto"
          >
            <option value="">-- เลือก Event --</option>
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.eventCode} — {ev.eventName}
              </option>
            ))}
          </select>

          <div className="relative flex-1 max-w-md">
            <IconSearch
              className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
              size={18}
            />
            <input
              type="text"
              placeholder="Search categories..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field-search"
            />
          </div>
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <IconLoader2 size={32} className="animate-spin text-emerald-600" />
            <span className="ml-2 text-zinc-400">Loading categories...</span>
          </div>
        ) : filteredCategories.length === 0 ? (
          <div className="text-center py-12 text-zinc-400">
            No categories found.{" "}
            <button
              onClick={openCreateModal}
              className="text-emerald-600 hover:underline"
            >
              Create one
            </button>
          </div>
        ) : (
          /* Table */
          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
            <table className="w-full">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-200">
                  <th className="px-4 py-3 text-center text-xs font-semibold text-zinc-500 uppercase tracking-wider w-16">
                    #
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    Event
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-zinc-500 uppercase tracking-wider w-[120px]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredCategories.map((cat, idx) => (
                  <tr
                    key={cat.id}
                    className="hover:bg-zinc-50 transition-colors"
                  >
                    <td className="px-4 py-4 text-center">
                      <span className="font-mono text-sm text-zinc-400 bg-zinc-100 px-2 py-1 rounded">
                        {idx + 1}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-600">
                          <IconCategory size={20} stroke={1.5} />
                        </div>
                        <div>
                          <p className="font-medium text-zinc-900">{cat.name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <IconCalendarEvent size={16} className="text-zinc-400" stroke={1.5} />
                        <div>
                          <p className="text-sm font-medium text-zinc-600">
                            {cat.eventCode || `ID: ${cat.eventId}`}
                          </p>
                          {cat.eventName && (
                            <p className="text-xs text-zinc-400">{cat.eventName}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <button
                        onClick={() => handleToggle(cat)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                          cat.isActive
                            ? "bg-green-100 text-green-700 hover:bg-green-200"
                            : "bg-zinc-100 text-zinc-400 hover:bg-zinc-200"
                        }`}
                      >
                        {cat.isActive ? (
                          <>
                            <IconToggleRight size={14} /> Active
                          </>
                        ) : (
                          <>
                            <IconToggleLeft size={14} /> Inactive
                          </>
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <div className="flex gap-1 justify-center items-center">
                        <button
                          className="p-2 hover:bg-yellow-50 rounded-lg text-zinc-400 hover:text-yellow-600 transition-colors"
                          title="Edit"
                          onClick={() => openEditModal(cat)}
                        >
                          <IconPencil size={18} />
                        </button>
                        <button
                          className="p-2 hover:bg-red-50 rounded-lg text-zinc-400 hover:text-red-600 transition-colors"
                          title="Delete"
                          onClick={() => openDeleteModal(cat)}
                        >
                          <IconTrash size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── Create Modal ────────────────────────────────────────────────── */}
      {showCreateModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-lg w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-zinc-100">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-zinc-900">
                  Add Abstract Category
                </h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-zinc-400 hover:text-zinc-500"
                >
                  <IconX size={20} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-600 mb-1">
                  Event <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.eventId || ""}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      eventId: e.target.value
                        ? parseInt(e.target.value, 10)
                        : null,
                    }))
                  }
                  className="input-field w-full"
                >
                  <option value="">Select Event</option>
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.eventCode} — {ev.eventName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-600 mb-1">
                  Category Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="input-field w-full"
                  placeholder="e.g. Clinical Pharmacy"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-600 mb-1">
                  Status
                </label>
                <select
                  value={formData.isActive ? "active" : "inactive"}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      isActive: e.target.value === "active",
                    }))
                  }
                  className="input-field w-full"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>

            <div className="p-6 border-t border-zinc-100 flex gap-3 justify-end">
              <button
                onClick={() => setShowCreateModal(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={isSubmitting}
                className="btn-primary flex items-center gap-2"
              >
                {isSubmitting ? (
                  <IconLoader2 size={18} className="animate-spin" />
                ) : (
                  <IconCheck size={18} />
                )}
                Create Category
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Edit Modal ──────────────────────────────────────────────────── */}
      {showEditModal && selectedCategory && (
        <div
          className="modal-overlay"
          onClick={() => setShowEditModal(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-lg w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-zinc-100">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-zinc-900">
                  Edit Category
                </h3>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="text-zinc-400 hover:text-zinc-500"
                >
                  <IconX size={20} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-600 mb-1">
                  Event
                </label>
                <input
                  type="text"
                  value={`${selectedCategory.eventCode || ""} — ${selectedCategory.eventName || ""}`}
                  disabled
                  className="input-field w-full bg-zinc-50 text-zinc-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-600 mb-1">
                  Category Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="input-field w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-600 mb-1">
                  Status
                </label>
                <select
                  value={formData.isActive ? "active" : "inactive"}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      isActive: e.target.value === "active",
                    }))
                  }
                  className="input-field w-full"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>

            <div className="p-6 border-t border-zinc-100 flex gap-3 justify-end">
              <button
                onClick={() => setShowEditModal(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdate}
                disabled={isSubmitting}
                className="btn-primary flex items-center gap-2"
              >
                {isSubmitting ? (
                  <IconLoader2 size={18} className="animate-spin" />
                ) : (
                  <IconPencil size={18} />
                )}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Delete Modal ────────────────────────────────────────────────── */}
      {showDeleteModal && selectedCategory && (
        <div
          className="modal-overlay"
          onClick={() => setShowDeleteModal(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 bg-red-600 rounded-t-2xl">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <IconTrash size={20} /> Delete Category
              </h3>
            </div>
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <IconAlertTriangle size={32} className="text-red-600" />
              </div>
              <p className="mb-2 text-zinc-600">
                Are you sure you want to delete this category?
              </p>
              <p className="font-semibold text-zinc-800">
                {selectedCategory.name}
              </p>
              <p className="text-sm text-zinc-400 mt-4">
                This action cannot be undone. Abstracts already submitted under
                this category will not be affected.
              </p>
            </div>
            <div className="p-6 border-t border-zinc-100 flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="btn-secondary"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
                disabled={isSubmitting}
              >
                {isSubmitting && (
                  <IconLoader2 size={18} className="animate-spin" />
                )}
                Delete Category
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
