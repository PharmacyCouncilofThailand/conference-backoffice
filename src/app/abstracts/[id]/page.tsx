"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { AdminLayout } from "@/components/layout";
import { api } from "@/lib/api";
import {
  RevisionRequestModal,
  RevisionTopicLabel,
} from "@/components/abstracts/RevisionRequestModal";
import toast from "react-hot-toast";
import {
  IconArrowLeft,
  IconCheck,
  IconX,
  IconLoader2,
  IconFileText,
  IconUser,
  IconUsers,
  IconMail,
  IconPhone,
  IconMapPin,
  IconBuilding,
  IconCalendar,
  IconTag,
  IconPresentation,
  IconDownload,
  IconPencil,
} from "@tabler/icons-react";

const statusColors: { [key: string]: string } = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-300",
  accepted: "bg-green-100 text-green-800 border-green-300",
  rejected: "bg-red-100 text-red-800 border-red-300",
  revision: "bg-amber-100 text-amber-800 border-amber-300",
};

const statusLabels: Record<string, string> = {
  pending: "Pending",
  accepted: "Accepted",
  rejected: "Rejected",
  revision: "Revision Requested",
};

const categoryLabels: { [key: string]: string } = {
  clinical_pharmacy: "Clinical Pharmacy",
  social_administrative: "Social and Administrative Pharmacy",
  community_pharmacy: "Community Pharmacy",
  pharmacology_toxicology: "Pharmacology and Toxicology",
  pharmacy_education: "Pharmacy Education",
  digital_pharmacy: "Digital Pharmacy and Innovation",
};

const getBackofficeToken = () =>
  localStorage.getItem("backoffice_token") ||
  sessionStorage.getItem("backoffice_token") ||
  "";

interface CoAuthor {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  institution: string | null;
  country: string | null;
}

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

interface RevisionRequestFile {
  id: number;
  revisionRequestId: number;
  fileName: string;
  fileUrl: string;
  fileType?: string | null;
  fileSize?: number | null;
  createdAt: string;
}

interface RevisionRequest {
  id: number;
  abstractId: number;
  requestedBy?: number | null;
  topic: string;
  comment: string;
  status: string;
  createdAt: string;
  resubmittedAt?: string | null;
  files?: RevisionRequestFile[];
}

interface AbstractDetail {
  id: number;
  trackingId: string | null;
  title: string;
  category: string;
  presentationType: string | null;
  keywords: string | null;
  background: string;
  objective: string;
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
  };
  event: {
    name: string;
    code: string;
  };
  coAuthors: CoAuthor[];
  files?: AbstractFile[];
  latestRevisionRequest?: RevisionRequest | null;
  revisionRequests?: RevisionRequest[];
}

const formatFileSize = (size?: number | null) => {
  if (!size) return "";
  return `${(size / 1024 / 1024).toFixed(2)} MB`;
};

const getAttachedFiles = (abstract: Pick<AbstractDetail, "files" | "fullPaperUrl">) => {
  const files = Array.isArray(abstract.files)
    ? abstract.files.filter((file) => file.fileUrl)
    : [];

  if (files.length > 0) return files;

  return abstract.fullPaperUrl
    ? [
        {
          id: 0,
          fileName: "Full Paper",
          fileUrl: abstract.fullPaperUrl,
          sortOrder: 0,
        },
      ]
    : [];
};

export default function AbstractDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [abstract, setAbstract] = useState<AbstractDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [reviewComment, setReviewComment] = useState("");

  const abstractId = params.id as string;

  useEffect(() => {
    fetchAbstract();
  }, [abstractId]);

  const fetchAbstract = async () => {
    setIsLoading(true);
    try {
      const token = getBackofficeToken();
      const res = await api.abstracts.get(token, parseInt(abstractId));
      setAbstract(res.abstract as unknown as AbstractDetail);
    } catch (error) {
      console.error("Failed to fetch abstract:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateStatus = async (status: string, comment?: string) => {
    if (!abstract) return;
    setIsSubmitting(true);
    try {
      const token = getBackofficeToken();
      await api.abstracts.updateStatus(token, abstract.id, status, comment);

      // Refresh data
      await fetchAbstract();

      setShowApproveModal(false);
      setShowRejectModal(false);
      setShowRevisionModal(false);
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

  const handleRequestRevision = async (payload: { topic: string; comment: string; file: File | null }) => {
    if (!abstract) return;
    setIsSubmitting(true);
    try {
      const token = getBackofficeToken();
      await api.abstracts.requestRevision(token, abstract.id, payload);

      await fetchAbstract();

      setShowRevisionModal(false);
      toast.success("Revise request sent successfully!");
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Failed to request revise");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <AdminLayout title="Abstract Details">
        <div className="flex justify-center items-center py-20">
          <IconLoader2 size={48} className="animate-spin text-blue-600" />
        </div>
      </AdminLayout>
    );
  }

  if (!abstract) {
    return (
      <AdminLayout title="Abstract Not Found">
        <div className="text-center py-20">
          <p className="text-gray-500 mb-4">
            Abstract not found or has been deleted.
          </p>
          <button onClick={() => router.back()} className="btn-primary">
            <IconArrowLeft size={18} className="mr-2" /> Go Back
          </button>
        </div>
      </AdminLayout>
    );
  }

  const attachedFiles = getAttachedFiles(abstract);
  const revisionRequests = abstract.revisionRequests || [];

  return (
    <AdminLayout title={`Abstract ${abstract.trackingId || "#" + abstract.id}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
        >
          <IconArrowLeft size={20} />
          <span>Back to List</span>
        </button>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Abstract Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Title & Status */}
          <div className="card">
            <div className="flex items-start justify-between mb-4">
              <span className="text-sm text-gray-500 font-mono">
                {abstract.trackingId || `ABS-${abstract.id}`}
              </span>
              <span
                className={`px-3 py-1 rounded-full text-sm font-medium border ${statusColors[abstract.status]}`}
              >
                {statusLabels[abstract.status] ||
                  abstract.status.charAt(0).toUpperCase() +
                    abstract.status.slice(1)}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-gray-800 mb-4">
              {abstract.title}
            </h1>

            {abstract.keywords && (
              <div className="flex items-center gap-2 text-sm">
                <IconTag size={16} className="text-blue-500" />
                <span className="text-blue-600">{abstract.keywords}</span>
              </div>
            )}
          </div>

          {/* Abstract Sections */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <IconFileText size={20} className="text-gray-600" />
              Abstract Content
            </h2>

            {/* Background */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-5">
              <h3 className="font-semibold text-gray-700 mb-3 text-base">
                Background
              </h3>
              <p className="text-gray-600 whitespace-pre-wrap leading-relaxed">
                {abstract.background}
              </p>
            </div>

            {/* Objectives */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-5">
              <h3 className="font-semibold text-gray-700 mb-3 text-base">
                Objectives
              </h3>
              <p className="text-gray-600 whitespace-pre-wrap leading-relaxed">
                {abstract.objective}
              </p>
            </div>

            {/* Methods */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-5">
              <h3 className="font-semibold text-gray-700 mb-3 text-base">
                Methods
              </h3>
              <p className="text-gray-600 whitespace-pre-wrap leading-relaxed">
                {abstract.methods}
              </p>
            </div>

            {/* Results */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-5">
              <h3 className="font-semibold text-gray-700 mb-3 text-base">
                Results
              </h3>
              <p className="text-gray-600 whitespace-pre-wrap leading-relaxed">
                {abstract.results}
              </p>
            </div>

            {/* Conclusion */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-5">
              <h3 className="font-semibold text-gray-700 mb-3 text-base">
                Conclusion
              </h3>
              <p className="text-gray-600 whitespace-pre-wrap leading-relaxed">
                {abstract.conclusion}
              </p>
            </div>
          </div>

          {/* Uploaded Files */}
          {attachedFiles.length > 0 && (
            <div className="card">
              <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <IconFileText size={20} className="text-blue-600" />
                Uploaded Files ({attachedFiles.length})
              </h2>
              <div className="space-y-3">
                {attachedFiles.map((file, index) => (
                  <div
                    key={`${file.id}-${file.fileUrl}`}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-gray-800 truncate">
                        {index + 1}. {file.fileName}
                      </p>
                      {file.fileSize ? (
                        <p className="text-xs text-gray-500 mt-1">
                          {formatFileSize(file.fileSize)}
                        </p>
                      ) : null}
                    </div>
                    <a
                      href={file.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-primary inline-flex items-center justify-center gap-2 shrink-0"
                    >
                      <IconDownload size={18} />
                      View/Download
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {revisionRequests.length > 0 && (
            <div className="card">
              <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <IconPencil size={20} className="text-amber-600" />
                Revision Requests ({revisionRequests.length})
              </h2>
              <div className="space-y-4">
                {revisionRequests.map((request) => (
                  <div
                    key={request.id}
                    className="rounded-xl border border-amber-100 bg-amber-50/40 p-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-800">
                          <RevisionTopicLabel topic={request.topic} />
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Requested {new Date(request.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <span className="self-start rounded-full bg-white px-2.5 py-1 text-xs font-semibold capitalize text-amber-700 border border-amber-200">
                        {request.status.replace(/_/g, " ")}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                      {request.comment}
                    </p>
                    {request.files && request.files.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {request.files.map((file) => (
                          <a
                            key={file.id}
                            href={file.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex max-w-full items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 border border-blue-100"
                          >
                            <IconFileText size={16} className="shrink-0" />
                            <span className="truncate">{file.fileName}</span>
                            <IconDownload size={14} className="shrink-0" />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Author Info & Metadata */}
        <div className="space-y-6">
          {/* Corresponding Author */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <IconUser size={20} className="text-blue-600" />
              Corresponding Author
            </h2>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3">
                <IconUser size={16} className="text-gray-400" />
                <span className="font-medium text-gray-800">
                  {abstract.author.firstName} {abstract.author.lastName}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <IconMail size={16} className="text-gray-400" />
                <a
                  href={`mailto:${abstract.author.email}`}
                  className="text-blue-600 hover:underline"
                >
                  {abstract.author.email}
                </a>
              </div>
              {abstract.author.phone && (
                <div className="flex items-center gap-3">
                  <IconPhone size={16} className="text-gray-400" />
                  <span className="text-gray-700">{abstract.author.phone}</span>
                </div>
              )}
              {abstract.author.institution && (
                <div className="flex items-center gap-3">
                  <IconBuilding size={16} className="text-gray-400" />
                  <span className="text-gray-700">
                    {abstract.author.institution}
                  </span>
                </div>
              )}
              {abstract.author.country && (
                <div className="flex items-center gap-3">
                  <IconMapPin size={16} className="text-gray-400" />
                  <span className="text-gray-700">
                    {abstract.author.country}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Co-Authors */}
          {abstract.coAuthors && abstract.coAuthors.length > 0 && (
            <div className="card">
              <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <IconUsers size={20} className="text-purple-600" />
                Co-Authors ({abstract.coAuthors.length})
              </h2>
              <div className="space-y-3">
                {abstract.coAuthors.map((ca, idx) => (
                  <div
                    key={ca.id}
                    className="p-3 bg-gray-50 rounded-lg text-sm"
                  >
                    <div className="font-medium text-gray-800">
                      {idx + 1}. {ca.firstName} {ca.lastName}
                    </div>
                    <div className="text-gray-600">{ca.email}</div>
                    {(ca.institution || ca.country) && (
                      <div className="text-gray-400 text-xs mt-1">
                        {ca.institution}
                        {ca.country && `, ${ca.country}`}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              Submission Details
            </h2>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500 flex items-center gap-2">
                  <IconCalendar size={16} /> Event
                </span>
                <span className="font-medium text-gray-800">
                  {abstract.event.name}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500 flex items-center gap-2">
                  <IconTag size={16} /> Category
                </span>
                <span className="font-medium text-right text-gray-800">
                  {categoryLabels[abstract.category] || abstract.category}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500 flex items-center gap-2">
                  <IconPresentation size={16} /> Presentation
                </span>
                <span className="font-medium capitalize text-gray-800">
                  {abstract.presentationType || "Not specified"}
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-gray-500 flex items-center gap-2">
                  <IconCalendar size={16} /> Submitted
                </span>
                <span className="font-medium text-gray-800">
                  {new Date(abstract.createdAt).toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          {abstract.status === "pending" && (
            <div className="space-y-3">
              <button
                onClick={() => setShowApproveModal(true)}
                className="w-full bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 flex items-center justify-center gap-2 font-semibold shadow-sm transition-colors"
              >
                <IconCheck size={20} /> Approve
              </button>
              <button
                onClick={() => setShowRevisionModal(true)}
                className="w-full bg-amber-600 text-white px-4 py-3 rounded-lg hover:bg-amber-700 flex items-center justify-center gap-2 font-semibold shadow-sm transition-colors"
              >
                <IconPencil size={20} /> Request Revise
              </button>
              <button
                onClick={() => setShowRejectModal(true)}
                className="w-full bg-red-600 text-white px-4 py-3 rounded-lg hover:bg-red-700 flex items-center justify-center gap-2 font-semibold shadow-sm transition-colors"
              >
                <IconX size={20} /> Reject
              </button>
            </div>
          )}
          {abstract.status === "revision" && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              Waiting for the author to resubmit the revised abstract.
            </div>
          )}
        </div>
      </div>

      {/* Approve Modal */}
      {showApproveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full">
            <div className="p-6 bg-green-600 rounded-t-2xl">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <IconCheck size={20} /> Approve Abstract
              </h3>
            </div>
            <div className="p-6">
              <p className="mb-4 text-gray-600">
                Are you sure you want to approve this abstract?
              </p>
              <div className="text-left">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Comments (optional)
                </label>
                <textarea
                  className="input-field h-20"
                  placeholder="Reviewer comments..."
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                />
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
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full">
            <div className="p-6 bg-red-600 rounded-t-2xl">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <IconX size={20} /> Reject Abstract
              </h3>
            </div>
            <div className="p-6">
              <p className="mb-4 text-gray-600">
                Are you sure you want to reject this abstract?
              </p>
              <div className="text-left">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason / Comments
                </label>
                <textarea
                  className="input-field h-20"
                  placeholder="Provide feedback to the author..."
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                />
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

      {showRevisionModal && (
        <RevisionRequestModal
          abstractTitle={abstract.title}
          isSubmitting={isSubmitting}
          onClose={() => {
            if (isSubmitting) return;
            setShowRevisionModal(false);
          }}
          onSubmit={handleRequestRevision}
        />
      )}
    </AdminLayout>
  );
}
