'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  IconDownload,
  IconLoader2,
  IconRefresh,
  IconSearch,
  IconTruck,
} from '@tabler/icons-react';
import Pagination from '@/components/common/Pagination';
import { useDebounce } from '@/hooks/useDebounce';
import { merchandiseApi } from '@/lib/merchandiseApi';
import { merchErrorMessage } from '@/lib/merchandiseErrors';
import {
  badgeClassForPayment,
  badgeClassForShipping,
  formatBaht,
  formatBangkok,
  paymentStatusLabel,
  shippingStatusLabel,
} from '@/lib/merchandiseFormat';
import type { AdminOrderRow, OrderFilters, Page } from '@/types/merchandise';
import { merchHref, useMerchandise } from './MerchandiseContext';

export default function OrdersTable() {
  const { eventId, token } = useMerchandise();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [createdFrom, setCreatedFrom] = useState(
    searchParams.get('createdFrom') ?? '',
  );
  const [createdTo, setCreatedTo] = useState(
    searchParams.get('createdTo') ?? '',
  );
  const [paymentStatus, setPaymentStatus] = useState<
    '' | 'pending' | 'paid' | 'expired'
  >(
    (searchParams.get('paymentStatus') as
      '' | 'pending' | 'paid' | 'expired') || '',
  );
  const [shippingStatus, setShippingStatus] = useState<
    '' | 'not_shipped' | 'shipped'
  >(
    (searchParams.get('shippingStatus') as '' | 'not_shipped' | 'shipped') ||
      '',
  );
  const initialPage = Number(searchParams.get('page'));
  const [page, setPage] = useState(
    Number.isSafeInteger(initialPage) && initialPage > 0 ? initialPage : 1,
  );
  const debouncedSearch = useDebounce(search, 300);

  const [data, setData] = useState<Page<AdminOrderRow> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!eventId) return;
    router.replace(
      merchHref(pathname, eventId, {
        search: debouncedSearch.trim(),
        createdFrom,
        createdTo,
        paymentStatus,
        shippingStatus,
        page: page > 1 ? String(page) : '',
      }),
    );
  }, [
    eventId,
    pathname,
    router,
    debouncedSearch,
    createdFrom,
    createdTo,
    paymentStatus,
    shippingStatus,
    page,
  ]);

  const currentFilters = useCallback(
    (includePaging: boolean): OrderFilters => ({
      ...(debouncedSearch.trim() ? { search: debouncedSearch.trim() } : {}),
      ...(createdFrom ? { createdFrom } : {}),
      ...(createdTo ? { createdTo } : {}),
      ...(paymentStatus ? { paymentStatus } : {}),
      ...(shippingStatus ? { shippingStatus } : {}),
      ...(includePaging ? { page, limit: 20 } : {}),
    }),
    [
      debouncedSearch,
      createdFrom,
      createdTo,
      paymentStatus,
      shippingStatus,
      page,
    ],
  );

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!eventId || !token) return;
      setLoading(true);
      setError('');
      try {
        const res = await merchandiseApi.listOrders(
          eventId,
          currentFilters(true),
          token,
          signal,
        );
        if (!signal?.aborted) {
          setData(res);
        }
      } catch (err) {
        if (!signal?.aborted) {
          setError(merchErrorMessage(err));
        }
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [eventId, token, currentFilters],
  );

  useEffect(() => {
    const c = new AbortController();
    void load(c.signal);
    return () => c.abort();
  }, [load]);

  async function handleExport() {
    if (!eventId || !token || exporting) return;
    setExporting(true);
    try {
      await merchandiseApi.downloadOrdersXlsx(
        eventId,
        currentFilters(false),
        token,
      );
      toast.success('ดาวน์โหลดไฟล์ Excel แล้ว');
    } catch (err) {
      const msg = merchErrorMessage(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
            คำสั่งซื้อ
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            รายการพรีออเดอร์ สถานะการชำระเงิน การจัดส่ง และส่งออกรายงาน Excel
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={merchHref('/merchandise/shipping', eventId)}
            className="btn-secondary min-h-11 gap-2"
          >
            <IconTruck size={18} />
            จัดส่งแบบ Bulk
          </Link>
          <button
            type="button"
            disabled={exporting}
            onClick={() => void handleExport()}
            className="btn-primary min-h-11 gap-2"
          >
            {exporting ? (
              <IconLoader2 size={18} className="animate-spin" />
            ) : (
              <IconDownload size={18} />
            )}
            ดาวน์โหลด Excel (ตามตัวกรอง)
          </button>
        </div>
      </div>

      <div className="card">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="relative lg:col-span-1">
            <IconSearch
              size={18}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="เลขออเดอร์ หรือชื่อผู้ซื้อ..."
              className="input-field-search"
            />
          </div>

          <label className="block space-y-1">
            <span className="text-xs font-medium text-zinc-600">
              สร้างตั้งแต่วันที่ (เวลาไทย)
            </span>
            <input
              type="date"
              value={createdFrom}
              onChange={(e) => {
                setCreatedFrom(e.target.value);
                setPage(1);
              }}
              className="input-field"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-medium text-zinc-600">
              ถึงวันที่ (เวลาไทย)
            </span>
            <input
              type="date"
              value={createdTo}
              onChange={(e) => {
                setCreatedTo(e.target.value);
                setPage(1);
              }}
              className="input-field"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-medium text-zinc-600">
              สถานะการชำระ
            </span>
            <select
              value={paymentStatus}
              onChange={(e) => {
                setPaymentStatus(
                  e.target.value as '' | 'pending' | 'paid' | 'expired',
                );
                setPage(1);
              }}
              className="input-field"
            >
              <option value="">ทั้งหมด</option>
              <option value="pending">รอชำระ</option>
              <option value="paid">ชำระแล้ว</option>
              <option value="expired">หมดเวลาชำระ</option>
            </select>
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-medium text-zinc-600">
              สถานะการจัดส่ง
            </span>
            <select
              value={shippingStatus}
              onChange={(e) => {
                setShippingStatus(
                  e.target.value as '' | 'not_shipped' | 'shipped',
                );
                setPage(1);
              }}
              className="input-field"
            >
              <option value="">ทั้งหมด</option>
              <option value="not_shipped">ยังไม่จัดส่ง</option>
              <option value="shipped">จัดส่งแล้ว</option>
            </select>
          </label>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-red-50 p-4 text-sm text-red-700"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => void load()}
            className="btn-secondary gap-2"
          >
            <IconRefresh size={16} />
            ลองใหม่
          </button>
        </div>
      )}

      <div className="card overflow-x-auto p-0">
        {loading ? (
          <div className="p-6 text-sm text-zinc-500">
            กำลังโหลดรายการคำสั่งซื้อ...
          </div>
        ) : !data || data.items.length === 0 ? (
          <div className="p-6 text-sm text-zinc-500">ไม่พบรายการคำสั่งซื้อ</div>
        ) : (
          <>
            <table className="data-table table-sticky-actions">
              <thead>
                <tr>
                  <th>เลขออเดอร์</th>
                  <th>วันที่สร้าง</th>
                  <th>ผู้ซื้อ</th>
                  <th>รายการ</th>
                  <th>ยอดรวม</th>
                  <th>สถานะชำระ</th>
                  <th>สถานะจัดส่ง</th>
                  <th>วันที่ชำระ</th>
                  <th className="text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((row) => {
                  const detailHref = merchHref(
                    `/merchandise/orders/${row.id}`,
                    eventId,
                  );
                  return (
                    <tr key={row.id}>
                      <td>
                        <Link
                          href={detailHref}
                          className="font-semibold text-zinc-900 hover:text-emerald-700 hover:underline"
                        >
                          {row.orderNumber}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap">
                        {formatBangkok(row.createdAt)}
                      </td>
                      <td>
                        <div className="font-medium text-zinc-900">
                          {row.buyerName}
                        </div>
                        <div className="text-xs text-zinc-500">
                          {row.buyerEmail}
                        </div>
                      </td>
                      <td className="max-w-xs truncate" title={row.itemsText}>
                        {row.itemsText}
                      </td>
                      <td className="whitespace-nowrap font-semibold text-zinc-900">
                        {formatBaht(row.amounts.totalBaht)}
                      </td>
                      <td>
                        <span
                          className={badgeClassForPayment(row.paymentStatus)}
                        >
                          {paymentStatusLabel[row.paymentStatus]}
                        </span>
                      </td>
                      <td>
                        <div className="space-y-1">
                          <span
                            className={badgeClassForShipping(
                              row.shipping.status,
                            )}
                          >
                            {shippingStatusLabel[row.shipping.status]}
                          </span>
                          {row.shipping.status === 'shipped' && (
                            <div className="text-xs text-zinc-600">
                              {row.shipping.carrier} · {row.shipping.trackingId}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="whitespace-nowrap">
                        {row.paidAt ? formatBangkok(row.paidAt) : '—'}
                      </td>
                      <td className="text-right">
                        <Link href={detailHref} className="btn-secondary">
                          ดูรายละเอียด
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <Pagination
              currentPage={page}
              totalPages={data.pagination.totalPages}
              totalCount={data.pagination.total}
              pageSize={20}
              onPageChange={setPage}
              itemName="คำสั่งซื้อ"
              className="flex-wrap gap-3 border-t border-zinc-100"
            />
          </>
        )}
      </div>
    </div>
  );
}
