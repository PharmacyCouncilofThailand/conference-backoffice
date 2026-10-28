'use client';

import { useEffect, useMemo, useState } from 'react';
import { AdminLayout } from '@/components/layout';
import {
  IconAlertTriangle,
  IconCheck,
  IconEye,
  IconLoader2,
  IconMail,
  IconMailBolt,
  IconRefresh,
  IconSearch,
  IconSend,
  IconX,
} from '@tabler/icons-react';
import toast from 'react-hot-toast';
import {
  EMAIL_MANUAL_CHUNK_SIZE,
  chunkIds,
  estimateSendSeconds,
  markSentRecipients,
} from '@/lib/emailManualBatch';
import { SendHistory } from './SendHistory';

interface EventOption {
  id: number;
  eventCode: string;
  eventName: string;
  status?: string;
}

interface TemplateInfo {
  id: string;
  label: string;
  recipientType: 'user' | 'order' | 'abstract' | 'registration';
  requiresComment: boolean;
  description: string;
}

interface RecipientRow {
  id: number;
  label: string;
  email: string;
  detail: string;
  tag: string;
  lastSentAt?: string | null;
}

interface ManualEmailResult {
  id: number;
  email: string;
  name: string;
  type: string;
  status: 'pending' | 'sent' | 'failed' | 'skipped';
  reason?: string;
}

interface ManualEmailResponse {
  success: boolean;
  batchId?: string;
  results: ManualEmailResult[];
  summary: {
    pending: number;
    sent: number;
    skipped: number;
    failed: number;
  };
  error?: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

const TEMPLATE_GROUPS = [
  {
    category: 'Account',
    templates: ['signup-notification', 'pending-approval'],
  },
  { category: 'Payment', templates: ['payment-receipt'] },
  {
    category: 'Abstract',
    templates: [
      'abstract-submission',
      'abstract-accepted-poster',
      'abstract-accepted-oral',
      'abstract-rejected',
    ],
  },
  {
    category: 'Registration',
    templates: [
      'pris-early-bird-reminder',
      'manual-registration',
      'event-reminder',
      'pris-pre-event',
      'pris-ticket-reminder',
    ],
  },
];

function getBackofficeToken(): string {
  if (typeof window === 'undefined') return '';
  return (
    localStorage.getItem('backoffice_token') ||
    sessionStorage.getItem('backoffice_token') ||
    ''
  );
}

function statusTone(status: ManualEmailResult['status']) {
  if (status === 'sent')
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (status === 'failed') return 'bg-red-50 text-red-700 border-red-200';
  if (status === 'skipped')
    return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-sky-50 text-sky-700 border-sky-200';
}

function PreviewModal({
  eventId,
  templateId,
  recipient,
  comment,
  onClose,
}: {
  eventId: number;
  templateId: string;
  recipient: RecipientRow;
  comment: string;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState<{
    to: string;
    subject: string;
    html: string;
  } | null>(null);

  useEffect(() => {
    const token = getBackofficeToken();
    const params = new URLSearchParams({
      eventId: String(eventId),
      template: templateId,
      id: String(recipient.id),
    });
    if (comment) params.set('comment', comment);

    fetch(`${API_BASE}/api/backoffice/email-manual/render?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error || 'Preview failed');
        }
        setData(json);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Preview failed'),
      )
      .finally(() => setLoading(false));
  }, [eventId, templateId, recipient.id, comment]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-5xl h-[86vh] rounded-xl shadow-xl border border-slate-200 flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <IconMail size={17} className="text-sky-600" />
              Email Preview
            </div>
            <p className="text-xs text-slate-500 mt-1 truncate">
              {recipient.label} / {data?.to ?? recipient.email}
            </p>
            {data && (
              <p className="text-xs text-slate-600 mt-2">
                <span className="font-semibold">Subject:</span> {data.subject}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            aria-label="Close preview"
          >
            <IconX size={18} />
          </button>
        </div>

        <div className="flex-1 bg-slate-100">
          {loading && (
            <div className="h-full flex items-center justify-center text-slate-500 gap-2">
              <IconLoader2 size={18} className="animate-spin" />
              Loading preview...
            </div>
          )}
          {error && (
            <div className="h-full flex items-center justify-center p-6">
              <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                {error}
              </div>
            </div>
          )}
          {data && !loading && !error && (
            <iframe
              srcDoc={data.html}
              className="w-full h-full border-0 bg-white"
              sandbox="allow-same-origin"
              title="Email preview"
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default function EmailManualPage() {
  const [events, setEvents] = useState<EventOption[]>([]);
  const [eventId, setEventId] = useState<number | ''>('');
  const [templates, setTemplates] = useState<TemplateInfo[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [recipients, setRecipients] = useState<RecipientRow[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState('');
  const [registrationSource, setRegistrationSource] = useState<'all' | 'manual'>('all');
  const [recipientsRefreshKey, setRecipientsRefreshKey] = useState(0);
  const [comment, setComment] = useState('');
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [sending, setSending] = useState(false);
  const [previewTarget, setPreviewTarget] = useState<RecipientRow | null>(null);
  const [results, setResults] = useState<ManualEmailResult[] | null>(null);
  const [progress, setProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);

  // Remaining chunks are only sent while this page stays open.
  useEffect(() => {
    if (!sending) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [sending]);

  const selectedTemplate = useMemo(
    () =>
      templates.find((template) => template.id === selectedTemplateId) || null,
    [templates, selectedTemplateId],
  );

  const selectedCount = useMemo(
    () => recipients.filter((recipient) => selected.has(recipient.id)).length,
    [recipients, selected],
  );

  const allVisibleSelected =
    recipients.length > 0 &&
    recipients.every((recipient) => selected.has(recipient.id));

  useEffect(() => {
    const token = getBackofficeToken();
    setLoadingEvents(true);
    fetch(`${API_BASE}/api/backoffice/events?limit=1000`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to load events');
        const rows = (json.events || []).map(
          (event: Record<string, unknown>) => ({
            id: Number(event.id),
            eventCode: String(event.eventCode || ''),
            eventName: String(event.eventName || ''),
            status: event.status ? String(event.status) : undefined,
          }),
        );
        setEvents(rows);
        if (rows.length === 1) setEventId(rows[0].id);
      })
      .catch((err) =>
        toast.error(
          err instanceof Error ? err.message : 'Failed to load events',
        ),
      )
      .finally(() => setLoadingEvents(false));
  }, []);

  useEffect(() => {
    const token = getBackofficeToken();
    setLoadingTemplates(true);
    fetch(`${API_BASE}/api/backoffice/email-manual/templates`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok || !json.success)
          throw new Error(json.error || 'Failed to load templates');
        setTemplates(json.templates || []);
      })
      .catch((err) =>
        toast.error(
          err instanceof Error ? err.message : 'Failed to load templates',
        ),
      )
      .finally(() => setLoadingTemplates(false));
  }, []);

  useEffect(() => {
    setRecipients([]);
    setSelected(new Set());
    setResults(null);
    setPreviewTarget(null);
    if (!eventId || !selectedTemplateId) {
      setLoadingRecipients(false);
      return;
    }

    const token = getBackofficeToken();
    const controller = new AbortController();
    setLoadingRecipients(true);
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({
        eventId: String(eventId),
        template: selectedTemplateId,
      });
      if (search.trim()) params.set('q', search.trim());
      if (selectedTemplateId === 'manual-registration' && registrationSource === 'manual') {
        params.set('source', 'manual');
      }

      fetch(`${API_BASE}/api/backoffice/email-manual/recipients?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      })
        .then(async (res) => {
          const json = await res.json();
          if (controller.signal.aborted) return;
          if (!res.ok || !json.success)
            throw new Error(json.error || 'Failed to load recipients');
          setRecipients(json.recipients || []);
          setSelected(new Set());
          setResults(null);
        })
        .catch((err) => {
          if (controller.signal.aborted) return;
          toast.error(
            err instanceof Error ? err.message : 'Failed to load recipients',
          );
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoadingRecipients(false);
        });
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [eventId, selectedTemplateId, search, registrationSource, recipientsRefreshKey]);

  function toggleAllVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        recipients.forEach((recipient) => next.delete(recipient.id));
      } else {
        recipients.forEach((recipient) => next.add(recipient.id));
      }
      return next;
    });
  }

  function toggleRecipient(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectUnsent() {
    setSelected(
      new Set(
        recipients
          .filter((recipient) => !recipient.lastSentAt)
          .map((recipient) => recipient.id),
      ),
    );
  }

  async function submitManualEmail(dryRun: boolean) {
    if (loadingRecipients || sending || !eventId || !selectedTemplate || selectedCount === 0) return;
    const chosen = recipients.filter((recipient) => selected.has(recipient.id));
    if (!dryRun) {
      const minutes = Math.max(
        1,
        Math.ceil(estimateSendSeconds(chosen.length) / 60),
      );
      const alreadySent = chosen.filter((r) => r.lastSentAt).length;
      const warning =
        alreadySent > 0
          ? `\n\n${alreadySent} คนในรายการนี้เคยได้รับอีเมลนี้แล้ว`
          : '';
      if (
        !confirm(
          `Send "${selectedTemplate.label}" to ${chosen.length} recipients? (~${minutes} นาที)${warning}`,
        )
      ) {
        return;
      }
    }

    const token = getBackofficeToken();
    const chunks = chunkIds(
      chosen.map((r) => r.id),
      EMAIL_MANUAL_CHUNK_SIZE,
    );
    const batchId = crypto.randomUUID();
    const collected: ManualEmailResult[] = [];
    const totals = { pending: 0, sent: 0, skipped: 0, failed: 0 };
    let done = 0;
    setSending(true);
    setResults([]);
    setProgress({ done: 0, total: chosen.length });

    try {
      for (let i = 0; i < chunks.length; i++) {
        let json: ManualEmailResponse;
        try {
          const res = await fetch(`${API_BASE}/api/backoffice/email-manual`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              eventId,
              template: selectedTemplate.id,
              recipientIds: chunks[i],
              dryRun,
              batchId,
              comment: comment || undefined,
            }),
          });
          json = await res.json();
          if (!res.ok || !json.success)
            throw new Error(json.error || 'Manual email request failed');
        } catch (err) {
          const detail = err instanceof Error ? err.message : 'request failed';
          toast.error(
            `หยุดที่ชุด ${i + 1}: ส่ง/ตรวจแล้ว ${done} จาก ${chosen.length} คน — ตรวจประวัติการส่งก่อนส่งต่อ (${detail})`,
            { duration: 12000 },
          );
          return;
        }

        collected.push(...(json.results || []));
        if (!dryRun) {
          const chunkResults = json.results || [];
          const sentAt = new Date().toISOString();
          setRecipients((prev) =>
            markSentRecipients(prev, chunkResults, sentAt),
          );
        }
        totals.pending += json.summary.pending;
        totals.sent += json.summary.sent;
        totals.skipped += json.summary.skipped;
        totals.failed += json.summary.failed;
        done += chunks[i].length;
        setResults([...collected]);
        setProgress({ done, total: chosen.length });
      }

      if (dryRun) {
        toast.success(`Validated ${totals.pending + totals.skipped} recipients`);
      } else {
        toast.success(
          `Sent ${totals.sent} emails` +
            (totals.failed ? `, ${totals.failed} failed` : '') +
            (totals.skipped ? `, ${totals.skipped} skipped` : ''),
        );
      }
    } finally {
      setSending(false);
      setProgress(null);
      if (!dryRun) setHistoryRefreshKey((key) => key + 1);
    }
  }

  return (
    <AdminLayout>
      <div className="p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-sky-100 rounded-lg">
              <IconMailBolt size={22} className="text-sky-700" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">Manual Email</h1>
              <p className="text-xs text-slate-500">
                Event-scoped email sender for registrations, payments,
                abstracts, and account notices.
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              setSearch('');
              setRegistrationSource('all');
              setSelected(new Set());
              setResults(null);
            }}
            disabled={sending}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            <IconRefresh size={16} />
            Reset
          </button>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(260px,360px)_1fr] gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Event
              </label>
              <select
                value={eventId}
                onChange={(e) => {
                  setEventId(e.target.value ? Number(e.target.value) : '');
                  setSelectedTemplateId('');
                  setRegistrationSource('all');
                  setRecipients([]);
                  setSelected(new Set());
                  setResults(null);
                }}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                disabled={loadingEvents || sending}
              >
                <option value="">Select event</option>
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.eventCode} - {event.eventName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Template
              </label>
              <div className="flex flex-wrap gap-2">
                {TEMPLATE_GROUPS.map((group) => (
                  <div
                    key={group.category}
                    className="flex flex-wrap gap-2 items-center"
                  >
                    <span className="text-[11px] uppercase tracking-wide text-slate-400 px-1">
                      {group.category}
                    </span>
                    {group.templates.map((templateId) => {
                      const template = templates.find(
                        (item) => item.id === templateId,
                      );
                      if (!template) return null;
                      const active = selectedTemplateId === template.id;
                      return (
                        <button
                          key={template.id}
                          onClick={() => {
                            setSelectedTemplateId(template.id);
                            setRegistrationSource('all');
                            setComment('');
                            setResults(null);
                          }}
                          disabled={!eventId || loadingTemplates || sending}
                          className={`px-3 py-2 rounded-lg text-sm border transition-colors ${
                            active
                              ? 'bg-sky-600 border-sky-600 text-white'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50'
                          }`}
                        >
                          {template.label}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {selectedTemplate && (
            <div className="mt-4 p-3 rounded-lg bg-slate-50 border border-slate-200">
              <p className="text-sm font-medium text-slate-700">
                {selectedTemplate.description}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Recipient type: {selectedTemplate.recipientType}. Results are
                limited to the selected event.
              </p>
            </div>
          )}

          {selectedTemplateId === 'pris-early-bird-reminder' && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <p>
                รายชื่อด้านล่างถูกคัดจาก API แล้ว: บัญชีสร้างก่อน cutoff, มี
                PRIS 2026 abstract ก่อน cutoff และยังไม่มี confirmed primary
                registration. ระบบจะตรวจสิทธิ์ซ้ำตอน Preview / Validate / Send.
              </p>
              <p className="mt-1 font-medium">
                กำหนดชำระ Early Bird: 15 Sep 2026 23:59 Bangkok. Select All
                หมายถึงรายการที่ API ส่งกลับมาและกำลังแสดงเท่านั้น
                ไม่ได้หมายถึงผู้มีสิทธิ์ทั้งหมดในฐานข้อมูล.
              </p>
            </div>
          )}
        </div>

        {selectedTemplate && eventId && (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 flex flex-wrap items-end gap-3 justify-between">
              <div className="relative flex-1 min-w-[260px]">
                <IconSearch
                  size={17}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  disabled={sending}
                  className="w-full border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="Search by name, email, order, code, or title..."
                />
              </div>

              {selectedTemplateId === 'manual-registration' && (
                <div>
                  <label
                    htmlFor="registration-source"
                    className="block text-xs font-semibold text-slate-600 mb-1"
                  >
                    ที่มาของการลงทะเบียน
                  </label>
                  <select
                    id="registration-source"
                    value={registrationSource}
                    onChange={(e) => setRegistrationSource(e.target.value as 'all' | 'manual')}
                    disabled={sending}
                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-50"
                  >
                    <option value="all">ทั้งหมด</option>
                    <option value="manual">เพิ่มแบบ Manual</option>
                  </select>
                </div>
              )}
              <button
                type="button"
                onClick={() => setRecipientsRefreshKey((key) => key + 1)}
                disabled={sending || loadingRecipients}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                <IconRefresh size={16} className={loadingRecipients ? 'animate-spin' : ''} />
                โหลดรายชื่อใหม่
              </button>

              {selectedTemplate.requiresComment && (
                <input
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-full md:w-96 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="Optional reviewer comment included in the email"
                />
              )}

              <div className="flex flex-wrap gap-2 items-center">
                {progress && (
                  <span className="text-xs font-medium text-sky-700">
                    กำลังส่ง {progress.done} / {progress.total}
                  </span>
                )}
                <button
                  onClick={selectUnsent}
                  disabled={sending || loadingRecipients || recipients.length === 0}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  เลือกเฉพาะที่ยังไม่เคยส่ง
                </button>
                <button
                  onClick={() => submitManualEmail(true)}
                  disabled={sending || loadingRecipients || selectedCount === 0}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  <IconCheck size={16} />
                  Validate ({selectedCount})
                </button>
                <button
                  onClick={() => submitManualEmail(false)}
                  disabled={sending || loadingRecipients || selectedCount === 0}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-600 text-white text-sm font-semibold hover:bg-sky-700 disabled:opacity-50"
                >
                  {sending ? (
                    <IconLoader2 size={16} className="animate-spin" />
                  ) : (
                    <IconSend size={16} />
                  )}
                  Send ({selectedCount})
                </button>
              </div>
            </div>

            {sending && (
              <div className="px-4 py-2 border-b border-amber-200 bg-amber-50 text-xs text-amber-800">
                กรุณาเปิดหน้านี้ค้างไว้จนกว่าจะส่งเสร็จ — ระบบส่งทีละชุด{' '}
                {EMAIL_MANUAL_CHUNK_SIZE} คน และเว้น 700ms ระหว่างอีเมลแต่ละฉบับ
              </div>
            )}

            {loadingRecipients ? (
              <div className="h-72 flex items-center justify-center gap-2 text-slate-500">
                <IconLoader2 size={18} className="animate-spin" />
                Loading recipients...
              </div>
            ) : recipients.length === 0 ? (
              <div className="h-72 flex flex-col items-center justify-center text-slate-400">
                <IconMail size={36} stroke={1.5} />
                <p className="mt-2 text-sm">
                  No recipients for this template and event.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3 text-left w-12">
                        <input
                          type="checkbox"
                          checked={allVisibleSelected}
                          onChange={toggleAllVisible}
                          className="rounded border-slate-300"
                        />
                      </th>
                      <th className="px-4 py-3 text-left">Recipient</th>
                      <th className="px-4 py-3 text-left">Email</th>
                      <th className="px-4 py-3 text-left">Detail</th>
                      <th className="px-4 py-3 text-left">Status</th>
                      <th className="px-4 py-3 text-right">Preview</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {recipients.map((recipient) => (
                      <tr key={recipient.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selected.has(recipient.id)}
                            onChange={() => toggleRecipient(recipient.id)}
                            className="rounded border-slate-300"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-800">
                            {recipient.label}
                          </p>
                          <p className="text-xs text-slate-400">
                            ID: {recipient.id}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {recipient.email}
                        </td>
                        <td className="px-4 py-3 text-slate-500 max-w-md truncate">
                          {recipient.detail}
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-1 rounded-md bg-slate-100 text-slate-600 text-xs">
                            {recipient.tag}
                          </span>
                          {recipient.lastSentAt && (
                            <span className="ml-1 px-2 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs whitespace-nowrap">
                              ส่งแล้ว{' '}
                              {new Date(recipient.lastSentAt).toLocaleString(
                                'th-TH',
                                {
                                  dateStyle: 'short',
                                  timeStyle: 'short',
                                  timeZone: 'Asia/Bangkok',
                                },
                              )}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => setPreviewTarget(recipient)}
                            className="inline-flex items-center justify-center p-2 rounded-lg text-slate-500 hover:text-sky-700 hover:bg-sky-50"
                            aria-label="Preview email"
                          >
                            <IconEye size={17} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {!selectedTemplate && (
          <div className="bg-white border border-dashed border-slate-300 rounded-xl h-64 flex flex-col items-center justify-center text-slate-400">
            <IconMailBolt size={42} stroke={1.4} />
            <p className="mt-3 text-sm">
              Select an event and template to load recipients.
            </p>
          </div>
        )}

        {results && (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-2">
              <IconAlertTriangle size={17} className="text-amber-500" />
              <h2 className="text-sm font-semibold text-slate-800">Result</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Name</th>
                    <th className="px-4 py-3 text-left">Email</th>
                    <th className="px-4 py-3 text-left">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {results.map((row) => (
                    <tr key={`${row.id}-${row.status}-${row.email}`}>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex px-2 py-1 rounded-md border text-xs ${statusTone(row.status)}`}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{row.name}</td>
                      <td className="px-4 py-3 text-slate-600">{row.email}</td>
                      <td className="px-4 py-3 text-slate-500">
                        {row.reason || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {eventId && (
          <SendHistory
            key={`${eventId}-${selectedTemplateId}`}
            apiBase={API_BASE}
            token={getBackofficeToken()}
            eventId={eventId}
            templateOptions={templates.map((t) => ({ id: t.id, label: t.label }))}
            defaultTemplate={selectedTemplateId}
            refreshKey={historyRefreshKey}
          />
        )}
      </div>

      {previewTarget && selectedTemplate && eventId && (
        <PreviewModal
          key={`${eventId}-${selectedTemplate.id}-${previewTarget.id}-${comment}`}
          eventId={eventId}
          templateId={selectedTemplate.id}
          recipient={previewTarget}
          comment={comment}
          onClose={() => setPreviewTarget(null)}
        />
      )}
    </AdminLayout>
  );
}
