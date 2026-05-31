"use client";

import { useState, useRef, useEffect } from "react";
import { IconChevronDown, IconCheck } from "@tabler/icons-react";

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  itemName?: string;
  showPageInfo?: boolean;
  hideIfSinglePage?: boolean;
  className?: string;
}

function RowsDropdown({
  value,
  onChange,
}: {
  value: number;
  onChange: (size: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-[13px] font-medium text-zinc-600 bg-zinc-100 rounded-lg px-2.5 py-1 hover:bg-zinc-200 transition-colors"
      >
        <span className="text-[12px] text-zinc-400 font-normal">Rows</span>
        {value}
        <IconChevronDown
          size={14}
          className={`text-zinc-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-1 bg-white rounded-xl shadow-lg border border-zinc-100 py-1 min-w-[80px] z-50 animate-in fade-in slide-in-from-bottom-2 duration-150">
          {PAGE_SIZE_OPTIONS.map((size) => (
            <button
              key={size}
              onClick={() => {
                onChange(size);
                setOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3 py-1.5 text-[13px] transition-colors ${
                value === size
                  ? "text-emerald-600 font-semibold bg-emerald-50"
                  : "text-zinc-600 hover:bg-zinc-50"
              }`}
            >
              {size}
              {value === size && <IconCheck size={14} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Pagination({
  currentPage,
  totalPages,
  totalCount,
  pageSize = 10,
  onPageChange,
  onPageSizeChange,
  itemName = "items",
  showPageInfo = false,
  hideIfSinglePage = false,
  className = "",
}: PaginationProps) {
  const startItem = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalCount);

  if (hideIfSinglePage && totalPages <= 1 && !onPageSizeChange) {
    return null;
  }

  return (
    <div className={`flex items-center justify-between px-6 py-4 ${className}`}>
      {/* Left: info + rows per page */}
      <div className="flex items-center gap-4">
        <p className="text-[13px] text-zinc-400">
          {showPageInfo ? (
            <>Page {currentPage} of {totalPages}</>
          ) : (
            <>
              <span className="font-medium text-zinc-600">{startItem}–{endItem}</span> of{" "}
              <span className="font-medium text-zinc-600">{totalCount}</span> {itemName}
            </>
          )}
        </p>

        {onPageSizeChange && (
          <RowsDropdown
            value={pageSize}
            onChange={(size) => {
              onPageSizeChange(size);
              onPageChange(1);
            }}
          />
        )}
      </div>

      {/* Right: page buttons */}
      <div className="flex items-center gap-0.5">
        <button
          className="px-3 py-1.5 rounded-full text-[13px] font-medium text-zinc-500 hover:bg-zinc-100 disabled:text-zinc-300 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
        >
          Prev
        </button>

        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
          let pageNum: number;
          if (totalPages <= 5) {
            pageNum = i + 1;
          } else if (currentPage <= 3) {
            pageNum = i + 1;
          } else if (currentPage >= totalPages - 2) {
            pageNum = totalPages - 4 + i;
          } else {
            pageNum = currentPage - 2 + i;
          }

          return (
            <button
              key={pageNum}
              onClick={() => onPageChange(pageNum)}
              className={`w-8 h-8 rounded-full text-[13px] font-semibold transition-all ${
                currentPage === pageNum
                  ? "bg-zinc-900 text-white"
                  : "text-zinc-500 hover:bg-zinc-100"
              }`}
            >
              {pageNum}
            </button>
          );
        })}

        <button
          className="px-3 py-1.5 rounded-full text-[13px] font-medium text-zinc-500 hover:bg-zinc-100 disabled:text-zinc-300 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
