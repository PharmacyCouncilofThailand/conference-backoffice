'use client';

import { useEffect, useState } from 'react';
import { IconHistory, IconLoader2, IconSearch, IconX } from '@tabler/icons-react';

type LogStatus = 'sending' | 'sent' | 'failed' | 'skipped';

interface ManualEmailLogRow {
  id: number;
  batchId: string;
  template: string;
  recipientId: number;
  recipientEmail: string | null;
  recipientName: string | null;
  subject: string | null;
  status: LogStatus;
  reason: string | null;
  triggeredBy: string | null;
  createdAt: string;
  finishedAt: string | null;
}

interface LogsResponse {
  success: boolean;
  logs: ManualEmailLogRow[];
  total: number;
  page: number;
  pageSize: number;
  summary: Record<LogStatus, number>;
  error?: string;
}

const STATUS_LABEL: Record<LogStatus, string> = {
  sending: 'ไม่ทราบผล',
  sent: 'sent',
  failed: 'failed',
  skipped: 'skipped',
};

const STATUS_TONE: Record<LogStatus, string> = {
  sending: 'bg-violet-50 text-violet-700 border-violet-200',
  sent: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  failed: 'bg-red-50 text-red-700 border-red-200',
  skipped: 'bg-amber-50 text-amber-700 border-amber-200',
};

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('th-TH', {
    dateStyle: 'short',
    timeStyle: 'medium',
    timeZone: 'Asia/Bangkok',
  });
}

export function SendHistory({
  apiBase,
  token,
  eventId,
  templateOptions,
  defaultTemplate,
  refreshKey,
}: {
  apiBase: string;
  token: string;
  eventId: number;
  templateOptions: { id: string; label: string }[];
  defaultTemplate: string;
  refreshKey: number;
}) {
  const [template, setTemplate] = useState(defaultTemplate);
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');
  const [batchId, setBatchId] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<LogsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ eventId: String(eventId), page: String(page) });
      if (template) params.set('template', template);
      if (status) params.set('status', status);
      if (batchId) params.set('batchId', batchId);
      if (query.trim()) params.set('q', query.trim());

      setLoading(true);
      setError('');
      fetch(`${apiBase}/api/backoffice/email-manual/logs?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      })
        .then(async (res) => {
          const json: LogsResponse = await res.json();
          if (!res.ok || !json.success) throw new Error(json.error || 'Failed to load history');
          setData(json);
        })
        .catch((err) => {
          if (err instanceof DOMException && err.name === 'AbortError') return;
          setError(err instanceof Error ? err.message : 'Failed to load history');
        })
        .finally(() => setLoading(false));
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [apiBase, token, eventId, template, status, batchId, query, page, refreshKey]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-2">
          <IconHistory size={17} className="text-sky-600" />
          <h2 className="text-sm font-semibold text-slate-800">ประวัติการส่ง</h2>
          {loading && <IconLoader2 size={15} className="animate-spin text-slate-400" />}
        </div>
        {data && (
          <div className="flex flex-wrap gap-2 text-xs">
            {(Object.keys(STATUS_LABEL) as LogStatus[]).map((key) => (
              <span key={key} className={`px-2 py-1 rounded-md border ${STATUS_TONE[key]}`}>
                {STATUS_LABEL[key]}: {data.summary[key]}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap gap-2 items-center">
        <select
          value={template}
          onChange={(e) => { setTemplate(e.target.value); setPage(1); }}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">ทุก template</option>
          {templateOptions.map((option) => (
            <option key={option.id} value={option.id}>{option.label}</option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">ทุกสถานะ</option>
          {(Object.keys(STATUS_LABEL) as LogStatus[]).map((key) => (
            <option key={key} value={key}>{STATUS_LABEL[key]}</option>
          ))}
        </select>
        <div className="relative flex-1 min-w-[220px]">
          <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1); }}
            className="w-full border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-sm"
            placeholder="ค้นหา email หรือชื่อ"
          />
        </div>
        {batchId && (
          <button
            onClick={() => { setBatchId(''); setPage(1); }}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-sky-50 border border-sky-200 text-xs text-sky-700"
          >
            batch {batchId.slice(0, 8)} <IconX size={13} />
          </button>
        )}
      </div>

      {error ? (
        <div className="p-4 text-sm text-red-700">{error}</div>
      ) : !data || data.logs.length === 0 ? (
        <div className="p-6 text-sm text-slate-400 text-center">ยังไม่มีประวัติการส่ง</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left">เวลา</th>
                <th className="px-4 py-3 text-left">Template</th>
                <th className="px-4 py-3 text-left">ผู้รับ</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">สถานะ</th>
                <th className="px-4 py-3 text-left">เหตุผล</th>
                <th className="px-4 py-3 text-left">ผู้กดส่ง</th>
                <th className="px-4 py-3 text-left">Batch</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.logs.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatDateTime(row.createdAt)}</td>
                  <td className="px-4 py-3 text-slate-600">{row.template}</td>
                  <td className="px-4 py-3 text-slate-700">
                    {row.recipientName || '-'}
                    <span className="block text-xs text-slate-400">ID: {row.recipientId}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{row.recipientEmail || '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-1 rounded-md border text-xs ${STATUS_TONE[row.status]}`}>
                      {STATUS_LABEL[row.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 max-w-xs truncate" title={row.reason ?? ''}>
                    {row.reason || '-'}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{row.triggeredBy || '-'}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => { setBatchId(row.batchId); setPage(1); }}
                      className="text-xs text-sky-700 hover:underline font-mono"
                    >
                      {row.batchId.slice(0, 8)}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && data.total > data.pageSize && (
        <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>หน้า {page} / {totalPages} ({data.total} รายการ)</span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1 rounded-md border border-slate-200 disabled:opacity-50"
            >
              ก่อนหน้า
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1 rounded-md border border-slate-200 disabled:opacity-50"
            >
              ถัดไป
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
