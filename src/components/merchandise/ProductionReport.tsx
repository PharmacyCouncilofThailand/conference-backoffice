'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { IconDownload, IconLoader2, IconRefresh } from '@tabler/icons-react';
import { merchandiseApi } from '@/lib/merchandiseApi';
import { merchErrorMessage } from '@/lib/merchandiseErrors';
import type { ProductionRow } from '@/types/merchandise';
import { useMerchandise } from './MerchandiseContext';

export default function ProductionReport() {
  const { eventId, eventCode, token } = useMerchandise();

  const [rows, setRows] = useState<ProductionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!eventId || !token) return;
      setLoading(true);
      setError('');
      try {
        const res = await merchandiseApi.production(eventId, token, signal);
        if (!signal?.aborted) {
          setRows(res);
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
    [eventId, token],
  );

  useEffect(() => {
    const c = new AbortController();
    void load(c.signal);
    return () => c.abort();
  }, [load]);

  const totals = useMemo(() => {
    let single = 0;
    let bundle = 0;
    let total = 0;
    for (const r of rows) {
      single += r.singleQuantity;
      bundle += r.bundleQuantity;
      total += r.totalQuantity;
    }
    return { single, bundle, total };
  }, [rows]);

  async function handleDownloadExcel() {
    if (!eventId || !token || downloading) return;
    setDownloading(true);
    try {
      await merchandiseApi.downloadProductionXlsx(eventId, token, eventCode);
      toast.success('ดาวน์โหลดไฟล์ Excel เรียบร้อยแล้ว');
    } catch (err) {
      toast.error(merchErrorMessage(err));
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-zinc-900">ยอดผลิต</h1>
            <p className="text-xs text-zinc-500">
              นับเฉพาะออเดอร์ที่ชำระสำเร็จ Bundle แตกเป็นส่วนประกอบตามจำนวนชุด
            </p>
          </div>
          <button
            type="button"
            disabled={downloading}
            onClick={() => void handleDownloadExcel()}
            className="btn-primary min-h-11 gap-2"
          >
            {downloading ? (
              <IconLoader2 size={18} className="animate-spin" />
            ) : (
              <IconDownload size={18} />
            )}
            ดาวน์โหลด Excel
          </button>
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

      <div className="card overflow-hidden p-0">
        {loading && rows.length === 0 ? (
          <div className="p-6 text-center text-sm text-zinc-500">
            กำลังโหลดรายงานยอดผลิต...
          </div>
        ) : rows.length === 0 ? (
          <div className="p-6 text-center text-sm text-zinc-500">
            ยังไม่มีข้อมูลยอดผลิตจากออเดอร์ที่ชำระสำเร็จ
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>สินค้า</th>
                  <th>ไซซ์</th>
                  <th>สี</th>
                  <th className="text-right">ขายแยก</th>
                  <th className="text-right">จาก Bundle</th>
                  <th className="text-right">รวม</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr
                    key={`${row.productId}-${row.sizeTh ?? ''}-${row.colorTh ?? ''}-${idx}`}
                  >
                    <td className="font-semibold text-zinc-900">
                      {row.nameTh}
                    </td>
                    <td>{row.sizeTh ?? '—'}</td>
                    <td>{row.colorTh ?? '—'}</td>
                    <td className="text-right">
                      {row.singleQuantity.toLocaleString('th-TH')}
                    </td>
                    <td className="text-right">
                      {row.bundleQuantity.toLocaleString('th-TH')}
                    </td>
                    <td className="text-right font-bold text-zinc-900">
                      {row.totalQuantity.toLocaleString('th-TH')}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-zinc-200 bg-zinc-50 font-bold text-zinc-900">
                  <td colSpan={3}>รวมทั้งหมด</td>
                  <td className="text-right">
                    {totals.single.toLocaleString('th-TH')}
                  </td>
                  <td className="text-right">
                    {totals.bundle.toLocaleString('th-TH')}
                  </td>
                  <td className="text-right text-emerald-700">
                    {totals.total.toLocaleString('th-TH')}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
