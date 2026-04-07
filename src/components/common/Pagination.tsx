"use client";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  pageSize?: number; // Default: 10
  onPageChange: (page: number) => void;
  itemName?: string; // Default: "items"
  showPageInfo?: boolean; // Default: false
  hideIfSinglePage?: boolean; // Default: false
  className?: string;
}

export default function Pagination({
  currentPage,
  totalPages,
  totalCount,
  pageSize = 10, // Default 10 items per page
  onPageChange,
  itemName = "items",
  showPageInfo = false,
  hideIfSinglePage = false,
  className = "",
}: PaginationProps) {
  // คำนวณจำนวน items ที่แสดงในหน้านี้
  const startItem = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalCount);

  // ซ่อนถ้ามีแค่ 1 หน้าและตั้งค่า hideIfSinglePage
  if (hideIfSinglePage && totalPages <= 1) {
    return null;
  }

  return (
    <div
      className={`flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/50 ${className}`}
    >
      {/* Showing Text */}
      <p className="text-sm text-gray-500">
        {showPageInfo ? (
          <>Page {currentPage} of {totalPages} ({totalCount} total)</>
        ) : (
          <>
            Showing <span className="font-medium">{startItem}-{endItem}</span> of{" "}
            <span className="font-medium">{totalCount}</span> {itemName}
          </>
        )}
      </p>

      {/* Pagination Buttons */}
      <div className="flex gap-2">
        <button
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-900 bg-white hover:bg-gray-50 hover:border-gray-400 disabled:text-gray-400 disabled:cursor-not-allowed transition-all"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
        >
          Previous
        </button>

        {/* Page Numbers (แสดง max 5 หน้า) */}
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
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                currentPage === pageNum
                  ? "bg-blue-600 text-white"
                  : "border border-gray-300 text-gray-900 bg-white hover:bg-gray-50 hover:border-gray-400"
              }`}
            >
              {pageNum}
            </button>
          );
        })}

        <button
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-900 bg-white hover:bg-gray-50 hover:border-gray-400 disabled:text-gray-400 disabled:cursor-not-allowed transition-all"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
