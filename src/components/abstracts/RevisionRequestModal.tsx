"use client";

import { useState } from "react";
import {
  IconFileText,
  IconLoader2,
  IconPencil,
  IconUpload,
  IconX,
} from "@tabler/icons-react";

export const revisionTopicOptions = [
  { value: "title", label: "Complete Abstract Title" },
  { value: "keywords", label: "Keywords" },
  { value: "background", label: "Background" },
  { value: "objective", label: "Objective" },
  { value: "methods", label: "Methods" },
  { value: "results", label: "Results" },
  { value: "conclusion", label: "Conclusion" },
  { value: "documents", label: "Attached Documents" },
  { value: "other", label: "Other" },
];

const getTopicLabel = (topic: string) =>
  revisionTopicOptions.find((option) => option.value === topic)?.label || topic;

export function RevisionTopicLabel({ topic }: { topic: string }) {
  return <>{getTopicLabel(topic)}</>;
}

interface RevisionRequestModalProps {
  abstractTitle: string;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (payload: { topic: string; comment: string; file: File | null }) => Promise<void> | void;
}

export function RevisionRequestModal({
  abstractTitle,
  isSubmitting,
  onClose,
  onSubmit,
}: RevisionRequestModalProps) {
  const [topic, setTopic] = useState("");
  const [comment, setComment] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    const trimmedTopic = topic.trim();
    const trimmedComment = comment.trim();
    if (!trimmedTopic) {
      setError("Please enter a revise topic.");
      return;
    }

    setError("");
    await onSubmit({ topic: trimmedTopic, comment: trimmedComment, file });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-xl overflow-hidden">
        <div className="p-6 bg-amber-600 text-white flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <IconPencil size={20} /> Request Revise
            </h3>
            <p className="text-sm text-amber-50 mt-1 line-clamp-2">
              {abstractTitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Close revise modal"
          >
            <IconX size={20} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Revise Topic <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              placeholder="e.g. Complete Abstract Title, Methodology, Figure 1..."
              className="input-field w-full"
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Short Details <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              className="input-field h-28"
              placeholder="Briefly describe what the author should revise..."
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              disabled={isSubmitting}
              maxLength={1000}
            />
            <p className="text-xs text-gray-400 text-right mt-1">
              {comment.length}/1000
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Attachment (optional)
            </label>
            <label className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-3 cursor-pointer hover:border-amber-400 hover:bg-amber-50/50 transition-colors">
              <span className="min-w-0 flex items-center gap-3 text-sm text-gray-600">
                {file ? (
                  <IconFileText size={18} className="text-amber-600 shrink-0" />
                ) : (
                  <IconUpload size={18} className="text-gray-400 shrink-0" />
                )}
                <span className="truncate">
                  {file ? file.name : "PDF, DOC, DOCX, JPG, or PNG"}
                </span>
              </span>
              <span className="text-xs font-semibold text-amber-700 shrink-0">
                Browse
              </span>
              <input
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                disabled={isSubmitting}
                onChange={(event) => setFile(event.target.files?.[0] || null)}
              />
            </label>
            {file && (
              <button
                type="button"
                onClick={() => setFile(null)}
                disabled={isSubmitting}
                className="text-xs text-gray-500 hover:text-red-600 mt-2"
              >
                Remove attachment
              </button>
            )}
          </div>

          {error && (
            <p className="text-sm font-medium text-red-600">{error}</p>
          )}
        </div>

        <div className="p-6 border-t border-gray-100 flex gap-3 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700 flex items-center gap-2 disabled:opacity-60"
            disabled={isSubmitting}
          >
            {isSubmitting && <IconLoader2 size={18} className="animate-spin" />}
            Send Revise Request
          </button>
        </div>
      </div>
    </div>
  );
}
