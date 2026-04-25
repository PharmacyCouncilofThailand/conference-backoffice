"use client";

import { useState, useEffect, useRef } from "react";
import { AdminLayout } from "@/components/layout";
import {
  IconMailForward,
  IconSend,
  IconEye,
  IconCheck,
  IconX,
  IconAlertTriangle,
  IconClock,
  IconRefresh,
  IconInfoCircle,
  IconUpload,
  IconFileText,
  IconTrash,
  IconMail,
} from "@tabler/icons-react";
import toast from "react-hot-toast";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type RetrosendType =
  | "payment"
  | "signup"
  | "abstract-submission"
  | "abstract-status"
  | "free-registration";

interface EmailPreviewField {
  label: string;
  value: string;
}

interface RetrosendResult {
  id: number | string;
  email: string;
  name: string;
  type: string;
  status: "sent" | "skipped" | "failed" | "pending";
  reason?: string;
  preview?: {
    subject: string;
    fields: EmailPreviewField[];
  };
}

interface RetrosendSummary {
  sent: number;
  pending: number;
  skipped: number;
  failed: number;
}

interface RetrosendResponse {
  success: boolean;
  dryRun: boolean;
  type: string;
  results: RetrosendResult[];
  summary: RetrosendSummary;
  error?: string;
}

interface LogEntry {
  message: string;
  severity: string;
  timestamp: string;
  attributes?: {
    req?: { method?: string; url?: string };
    reqId?: string;
    [key: string]: unknown;
  };
}

interface ParsedLog {
  fileName: string;
  totalEntries: number;
  windowFrom: string; // ISO datetime-local
  windowTo: string;
  orderIds: string; // comma-separated
  abstractIds: string; // comma-separated, extracted from nearby PATCH requests
  registrationIds: string; // comma-separated free registration ids (rarely populated)
  counts: Record<RetrosendType, number>;
  abstractStatusBreakdown: {
    acceptedPoster: number;
    acceptedOral: number;
    rejected: number;
    pendingApproval: number;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Log parser (runs entirely in the browser — no server upload)
// ─────────────────────────────────────────────────────────────────────────────

const PATTERNS: Record<string, RegExp> = {
  payment: /Failed to send receipt email for order (\d+)/,
  signup: /Error sending signup notification email.*NipaMail/,
  pendingApproval:
    /Error sending pending approval email.*NipaMail|Failed to send pending approval email/,
  abstractSubmission: /Error sending abstract submission email.*NipaMail/,
  acceptedPoster: /Error sending abstract accepted poster email.*NipaMail|Error sending abstract accepted \(poster\) email/,
  acceptedOral: /Error sending abstract accepted oral email.*NipaMail|Error sending abstract accepted \(oral\) email/,
  rejected: /Error sending abstract rejected email.*NipaMail/,
  freeRegistration: /\[Generic\] Error sending registration email|\[FREE-REG\] Failed to send confirmation email/,
};

function toLocalDatetime(iso: string, addMinutes = 0): string {
  const d = new Date(new Date(iso).getTime() + addMinutes * 60_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function parseLogEntries(entries: LogEntry[]): ParsedLog | null {
  // Payment order IDs: scan ALL entries regardless of severity. fastify.log.error()
  // is often serialised as severity "info" by Railway's pino parser.
  const orderIdSet = new Set<number>();
  const timestamps: Date[] = [];
  const paymentErrorTimestamps: Date[] = [];

  // Abstract status IDs: extract from PATCH /api/backoffice/abstracts/{id}/status
  // request log entries that were made close in time to an abstract status email error.
  const abstractStatusRequests: { id: number; ts: Date }[] = [];

  // Free registration: correlate "[FREE-REG] Created registration N (regCode=X)" with
  // "[FREE-REG] Failed to send confirmation email" within ±5s to extract exact IDs.
  // This avoids the date-range truncation bug (datetime-local has only minute precision)
  // and the overcount issue from sharing "[Generic] Error sending registration email"
  // with non-free flows (manual / bulk admin registration).
  const freeRegCreated: { id: number; ts: Date }[] = [];
  const freeRegFailedTimestamps: Date[] = [];

  for (const entry of entries) {
    const url = entry.attributes?.req?.url ?? "";
    const method = entry.attributes?.req?.method ?? "";
    if (method === "PATCH" || (entry.message === "incoming request" && url)) {
      const m = url.match(/\/api\/backoffice\/abstracts\/(\d+)\/status/);
      if (m) abstractStatusRequests.push({ id: parseInt(m[1]), ts: new Date(entry.timestamp) });
    }
    if (entry.message) {
      const created = entry.message.match(/\[FREE-REG\] Created registration (\d+)/);
      if (created) {
        freeRegCreated.push({ id: parseInt(created[1]), ts: new Date(entry.timestamp) });
      }
      if (/\[FREE-REG\] Failed to send confirmation email/.test(entry.message)) {
        freeRegFailedTimestamps.push(new Date(entry.timestamp));
      }
    }
  }

  for (const entry of entries) {
    if (!entry.message) continue;
    const orderMatch = entry.message.match(PATTERNS.payment);
    if (orderMatch) {
      orderIdSet.add(parseInt(orderMatch[1]));
      timestamps.push(new Date(entry.timestamp));
    }
  }

  const errorEntries = entries.filter((e) => e.severity === "error" && e.message);

  let signupCount = 0;
  let pendingApprovalCount = 0;
  let abstractSubmissionCount = 0;
  let acceptedPosterCount = 0;
  let acceptedOralCount = 0;
  let rejectedCount = 0;
  let freeRegistrationCount = 0;

  for (const entry of errorEntries) {
    const msg = entry.message;
    const ts = new Date(entry.timestamp);

    if (/Error sending payment receipt email/.test(msg)) {
      paymentErrorTimestamps.push(ts);
      timestamps.push(ts);
      continue;
    }
    if (PATTERNS.signup.test(msg)) { signupCount++; timestamps.push(ts); continue; }
    if (PATTERNS.pendingApproval.test(msg)) { pendingApprovalCount++; timestamps.push(ts); continue; }
    if (PATTERNS.abstractSubmission.test(msg)) { abstractSubmissionCount++; timestamps.push(ts); continue; }
    if (PATTERNS.acceptedPoster.test(msg)) { acceptedPosterCount++; timestamps.push(ts); continue; }
    if (PATTERNS.acceptedOral.test(msg)) { acceptedOralCount++; timestamps.push(ts); continue; }
    if (PATTERNS.rejected.test(msg)) { rejectedCount++; timestamps.push(ts); continue; }
    if (PATTERNS.freeRegistration.test(msg)) { freeRegistrationCount++; timestamps.push(ts); }
  }

  const paymentCount = orderIdSet.size > 0 ? orderIdSet.size : paymentErrorTimestamps.length;

  const abstractStatusErrorTimestamps: Date[] = [];
  for (const entry of errorEntries) {
    if (
      PATTERNS.acceptedPoster.test(entry.message) ||
      PATTERNS.acceptedOral.test(entry.message) ||
      PATTERNS.rejected.test(entry.message)
    ) {
      abstractStatusErrorTimestamps.push(new Date(entry.timestamp));
    }
  }
  for (const entry of entries) {
    if (/Failed to send abstract status email/.test(entry.message ?? "")) {
      abstractStatusErrorTimestamps.push(new Date(entry.timestamp));
      const m = entry.message.match(/Failed to send abstract status email for abstract (\d+)/);
      if (m) abstractStatusRequests.push({ id: parseInt(m[1]), ts: new Date(entry.timestamp) });
    }
  }

  // Correlate: for each abstract status error, find nearest PATCH request within ±10s
  const abstractIdSet = new Set<number>();
  for (const errTs of abstractStatusErrorTimestamps) {
    let best: { id: number; ts: Date } | null = null;
    let bestDiff = Infinity;
    for (const req of abstractStatusRequests) {
      const diff = Math.abs(req.ts.getTime() - errTs.getTime());
      if (diff < bestDiff && diff <= 10_000) { best = req; bestDiff = diff; }
    }
    if (best) abstractIdSet.add(best.id);
  }

  // Correlate free-registration: for each Failed event, find the closest Created event
  // within ±5s. The Created log carries the exact registration ID. This is more reliable
  // than counting "[Generic] Error sending registration email" (shared with non-free flows).
  const freeRegIdSet = new Set<number>();
  for (const failTs of freeRegFailedTimestamps) {
    let best: { id: number; ts: Date } | null = null;
    let bestDiff = Infinity;
    for (const created of freeRegCreated) {
      const diff = Math.abs(created.ts.getTime() - failTs.getTime());
      if (diff < bestDiff && diff <= 5_000) {
        best = created;
        bestDiff = diff;
      }
    }
    if (best) freeRegIdSet.add(best.id);
  }

  if (timestamps.length === 0) return null;

  timestamps.sort((a, b) => a.getTime() - b.getTime());
  const windowFrom = toLocalDatetime(timestamps[0].toISOString());
  // +1 minute buffer to compensate for the seconds dropped by datetime-local input precision.
  // Without this buffer, an event happening at HH:MM:SS would be cut off by toDate=HH:MM:00.
  const windowTo = toLocalDatetime(timestamps[timestamps.length - 1].toISOString(), 1);

  // Use the correlation count when available (more accurate); fall back to the regex count.
  const accurateFreeRegCount =
    freeRegIdSet.size > 0 ? freeRegIdSet.size : freeRegistrationCount;

  return {
    fileName: "",
    totalEntries: entries.length,
    windowFrom,
    windowTo,
    orderIds: [...orderIdSet].sort((a, b) => a - b).join(", "),
    abstractIds: [...abstractIdSet].sort((a, b) => a - b).join(", "),
    registrationIds: [...freeRegIdSet].sort((a, b) => a - b).join(", "),
    counts: {
      payment: paymentCount,
      signup: signupCount + pendingApprovalCount,
      "abstract-submission": abstractSubmissionCount,
      "abstract-status": acceptedPosterCount + acceptedOralCount + rejectedCount,
      "free-registration": accurateFreeRegCount,
    },
    abstractStatusBreakdown: {
      acceptedPoster: acceptedPosterCount,
      acceptedOral: acceptedOralCount,
      rejected: rejectedCount,
      pendingApproval: pendingApprovalCount,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const EMPTY_COUNTS: Record<RetrosendType, number> = {
  payment: 0,
  signup: 0,
  "abstract-submission": 0,
  "abstract-status": 0,
  "free-registration": 0,
};

const TYPE_DESC: Record<RetrosendType, string> = {
  payment:
    "ส่ง receipt email ให้ผู้ชำระเงินที่ระบบยืนยันการชำระแล้ว แต่ email ไม่ถูกส่ง",
  signup:
    "ส่ง welcome email หรือ pending-approval email ให้ user ที่สมัครในช่วงเวลา token หมดอายุ",
  "abstract-submission":
    "ส่ง email ยืนยันการ submit abstract ให้ผู้เขียนที่ส่ง abstract ในช่วงเวลาดังกล่าว",
  "abstract-status":
    "ส่ง email แจ้งผลการพิจารณา (accepted/rejected) — ต้องระบุ Abstract IDs เอง เนื่องจากตาราง abstracts ไม่มี updatedAt",
  "free-registration":
    "ส่ง email ยืนยันการลงทะเบียน (regCode + QR) ให้ผู้ลงทะเบียนงานฟรีที่ระบบสร้าง registration แล้วแต่ email ไม่ถูกส่ง",
};

// ─────────────────────────────────────────────────────────────────────────────
// Email Preview Modal
// ─────────────────────────────────────────────────────────────────────────────

function EmailPreviewModal({
  result,
  apiBase,
  onClose,
}: {
  result: RetrosendResult;
  apiBase: string;
  onClose: () => void;
}) {
  const [html, setHtml] = useState<string | null>(null);
  const [subject, setSubject] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [loadErr, setLoadErr] = useState<string | null>(null);

  // Determine the type string the render endpoint expects
  const renderType =
    result.type.startsWith("abstract-accepted") || result.type === "abstract-rejected"
      ? "abstract-status"
      : result.type;

  useEffect(() => {
    if (!apiBase) return;
    const token =
      localStorage.getItem("backoffice_token") ||
      sessionStorage.getItem("backoffice_token") ||
      "";
    const url = `${apiBase}/api/backoffice/email-retrosend/render?type=${encodeURIComponent(renderType)}&id=${encodeURIComponent(String(result.id))}`;
    fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setHtml(data.html);
          setSubject(data.subject ?? "");
          setTo(data.to ?? result.email);
        } else {
          setLoadErr(data.error ?? "Failed to load preview");
        }
      })
      .catch(() => setLoadErr("Network error"));
  }, [apiBase, renderType, result.id, result.email]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl h-[88vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <IconMail size={17} className="text-blue-500 shrink-0" />
            <span className="font-semibold text-slate-800 text-sm truncate">
              ดูตัวอย่าง Email จริง
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors ml-3 shrink-0"
          >
            <IconX size={18} />
          </button>
        </div>

        {/* Meta: To / Subject */}
        {(subject || to) && (
          <div className="px-5 py-2.5 border-b border-slate-100 bg-slate-50 shrink-0 space-y-0.5">
            {to && (
              <div className="flex gap-2 text-xs">
                <span className="text-slate-400 w-14 shrink-0">To</span>
                <span className="text-slate-700 font-medium">{to}</span>
              </div>
            )}
            {subject && (
              <div className="flex gap-2 text-xs">
                <span className="text-slate-400 w-14 shrink-0">Subject</span>
                <span className="text-slate-700 font-medium">{subject}</span>
              </div>
            )}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-hidden">
          {!html && !loadErr && (
            <div className="flex items-center justify-center h-full text-slate-400 text-sm gap-2">
              <IconRefresh size={16} className="animate-spin" />
              กำลังโหลด email preview...
            </div>
          )}
          {loadErr && (
            <div className="flex items-center justify-center h-full text-red-500 text-sm gap-2">
              <IconAlertTriangle size={16} />
              {loadErr}
            </div>
          )}
          {html && (
            <iframe
              srcDoc={html}
              className="w-full h-full border-0"
              sandbox="allow-same-origin"
              title="Email Preview"
            />
          )}
        </div>

        <div className="px-5 py-3 border-t border-slate-100 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition-colors"
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Status badge
// ─────────────────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: RetrosendResult["status"] }) {
  const map = {
    sent: { icon: <IconCheck size={12} />, label: "ส่งแล้ว", cls: "bg-green-100 text-green-700" },
    failed: { icon: <IconX size={12} />, label: "ล้มเหลว", cls: "bg-red-100 text-red-700" },
    skipped: { icon: <IconAlertTriangle size={12} />, label: "ข้าม", cls: "bg-yellow-100 text-yellow-700" },
    pending: { icon: <IconClock size={12} />, label: "จะส่ง", cls: "bg-blue-100 text-blue-700" },
  };
  const { icon, label, cls } = map[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {icon} {label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────

export default function EmailRetrosendPage() {
  const [selectedType, setSelectedType] = useState<RetrosendType>("payment");

  // log file state
  const [parsedLog, setParsedLog] = useState<ParsedLog | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // form inputs (populated from log or editable manually)
  const [orderIds, setOrderIds] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [abstractIds, setAbstractIds] = useState("");
  const [registrationIds, setRegistrationIds] = useState("");

  // results state
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<RetrosendResult[] | null>(null);
  const [summary, setSummary] = useState<RetrosendSummary | null>(null);
  const [isPreviewed, setIsPreviewed] = useState(false);

  // selection state
  const [selected, setSelected] = useState<Set<number>>(new Set());

  // preview modal
  const [previewRow, setPreviewRow] = useState<RetrosendResult | null>(null);

  const API_BASE = process.env.NEXT_PUBLIC_API_URL;

  // ── log parsing ───────────────────────────────────────────────────────────

  async function handleFile(file: File) {
    if (!file.name.endsWith(".json")) {
      toast.error("กรุณาเลือกไฟล์ .json");
      return;
    }
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const entries: LogEntry[] = Array.isArray(data)
        ? data
        : data.logs ?? data.entries ?? [];
      if (entries.length === 0) {
        toast.error("ไม่พบ log entries ในไฟล์นี้");
        return;
      }

      const parsed = parseLogEntries(entries);
      if (!parsed) {
        toast.error("ไม่พบ email failure ใดๆ ในไฟล์นี้");
        return;
      }

      parsed.fileName = file.name;
      setParsedLog(parsed);
      setOrderIds(parsed.orderIds);
      setAbstractIds(parsed.abstractIds);
      setRegistrationIds(parsed.registrationIds);
      setFromDate(parsed.windowFrom);
      setToDate(parsed.windowTo);
      setResults(null);
      setSummary(null);
      setIsPreviewed(false);
      setSelected(new Set());
      toast.success(
        `วิเคราะห์ log สำเร็จ — พบ email ล้มเหลว ${Object.values(parsed.counts).reduce((a, b) => a + b, 0)} รายการ`,
      );
    } catch {
      toast.error("ไม่สามารถอ่านไฟล์ได้ — ตรวจสอบว่าเป็น JSON ที่ถูกต้อง");
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function clearLog() {
    setParsedLog(null);
    setOrderIds("");
    setFromDate("");
    setToDate("");
    setRegistrationIds("");
    setResults(null);
    setSummary(null);
    setIsPreviewed(false);
    setSelected(new Set());
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // ── tab data ──────────────────────────────────────────────────────────────

  const counts = parsedLog?.counts ?? EMPTY_COUNTS;
  const TABS: { type: RetrosendType; label: string }[] = [
    { type: "payment", label: "Payment Receipts" },
    { type: "signup", label: "Signup / Pending" },
    { type: "abstract-submission", label: "Abstract Submission" },
    { type: "abstract-status", label: "Abstract Accepted/Rejected" },
    { type: "free-registration", label: "Free Registration" },
  ];

  // ── selection helpers ─────────────────────────────────────────────────────

  const selectableIndices =
    results?.map((r, i) => (r.status === "pending" ? i : -1)).filter((i) => i >= 0) ?? [];
  const allSelected = selectableIndices.length > 0 && selectableIndices.every((i) => selected.has(i));
  const someSelected = selected.size > 0;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(selectableIndices));
  }

  function toggleRow(i: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) {
        next.delete(i);
      } else {
        next.add(i);
      }
      return next;
    });
  }

  // ── API helpers ───────────────────────────────────────────────────────────

  function parseIds(str: string) {
    return str
      .split(",")
      .map((s) => parseInt(s.trim()))
      .filter((n) => !isNaN(n) && n > 0);
  }

  function buildPreviewPayload() {
    const base = { type: selectedType, dryRun: true };
    if (selectedType === "payment") return { ...base, orderIds: parseIds(orderIds) };
    if (selectedType === "abstract-status") return { ...base, abstractIds: parseIds(abstractIds) };
    if (selectedType === "free-registration") {
      const ids = parseIds(registrationIds);
      return ids.length > 0
        ? { ...base, registrationIds: ids }
        : {
            ...base,
            fromDate: new Date(fromDate).toISOString(),
            toDate: new Date(toDate).toISOString(),
          };
    }
    return {
      ...base,
      fromDate: new Date(fromDate).toISOString(),
      toDate: new Date(toDate).toISOString(),
    };
  }

  function buildSendPayload(selectedResults: RetrosendResult[]) {
    const base = { type: selectedType, dryRun: false };
    const ids = selectedResults.map((r) => Number(r.id));
    if (selectedType === "payment") return { ...base, orderIds: ids };
    if (selectedType === "abstract-status") return { ...base, abstractIds: ids };
    if (selectedType === "abstract-submission") return { ...base, abstractIds: ids };
    if (selectedType === "free-registration") return { ...base, registrationIds: ids };
    return { ...base, userIds: ids };
  }

  async function callAPI(payload: object): Promise<RetrosendResponse | null> {
    const token =
      localStorage.getItem("backoffice_token") ||
      sessionStorage.getItem("backoffice_token") ||
      "";
    const res = await fetch(`${API_BASE}/api/backoffice/email-retrosend`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    return res.json();
  }

  async function handlePreview() {
    if (selectedType === "abstract-status" && !abstractIds.trim()) {
      toast.error("กรุณากรอก Abstract IDs ก่อน");
      return;
    }
    if ((selectedType === "signup" || selectedType === "abstract-submission") && (!fromDate || !toDate)) {
      toast.error("กรุณาระบุช่วงเวลา หรือ upload log file ก่อน");
      return;
    }
    if (selectedType === "free-registration" && !registrationIds.trim() && (!fromDate || !toDate)) {
      toast.error("กรุณาระบุ Registration IDs หรือช่วงเวลาก่อน");
      return;
    }
    setLoading(true);
    setResults(null);
    setSummary(null);
    setSelected(new Set());
    setIsPreviewed(false);
    try {
      const data = await callAPI(buildPreviewPayload());
      if (!data?.success) {
        toast.error(data?.error || "เกิดข้อผิดพลาด");
        return;
      }
      setResults(data.results);
      setSummary(data.summary);
      setIsPreviewed(true);
      const indices = data.results
        .map((r: RetrosendResult, i: number) => (r.status === "pending" ? i : -1))
        .filter((i: number) => i >= 0);
      setSelected(new Set(indices));
      toast.success(`Preview: พบ ${data.summary.pending} รายการที่จะส่ง`);
    } catch {
      toast.error("เชื่อมต่อ API ไม่ได้");
    } finally {
      setLoading(false);
    }
  }

  async function handleSendSelected() {
    if (!isPreviewed || !results) {
      toast.error("กรุณา Preview ก่อน");
      return;
    }
    const selectedResults = [...selected].map((i) => results[i]).filter(Boolean);
    if (selectedResults.length === 0) {
      toast.error("ยังไม่ได้เลือกรายการ");
      return;
    }
    if (!confirm(`ยืนยันส่ง email จริง ${selectedResults.length} รายการ?`)) return;
    setLoading(true);
    try {
      const data = await callAPI(buildSendPayload(selectedResults));
      if (!data?.success) {
        toast.error(data?.error || "เกิดข้อผิดพลาด");
        return;
      }
      setResults(data.results);
      setSummary(data.summary);
      setIsPreviewed(false);
      setSelected(new Set());
      const { sent, failed } = data.summary;
      if (failed > 0) {
        toast.error(`ส่งสำเร็จ ${sent} รายการ, ล้มเหลว ${failed} รายการ`);
      } else {
        toast.success(`ส่งสำเร็จทั้งหมด ${sent} รายการ`);
      }
    } catch {
      toast.error("เชื่อมต่อ API ไม่ได้");
    } finally {
      setLoading(false);
    }
  }

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <AdminLayout>
      <div className="p-6 space-y-5">
        {/* ── Header ── */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <IconMailForward size={22} className="text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Email Retrosend</h1>
            <p className="text-xs text-slate-500">
              Upload log file เพื่อ auto-detect email ที่ส่งไม่สำเร็จ แล้วส่งย้อนหลัง
            </p>
          </div>
        </div>

        {/* ── Log upload zone ── */}
        {!parsedLog ? (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
              isDragging
                ? "border-blue-400 bg-blue-50"
                : "border-slate-300 hover:border-blue-400 hover:bg-slate-50"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
            <IconUpload size={36} className="mx-auto mb-3 text-slate-400" />
            <p className="font-medium text-slate-700">
              Drop log file here หรือ click เพื่อเลือกไฟล์
            </p>
            <p className="text-xs text-slate-400 mt-1">
              รองรับไฟล์ .json — วิเคราะห์ฝั่ง browser ไม่ upload ขึ้น server
            </p>
          </div>
        ) : (
          /* ── Parsed log summary card ── */
          <div className="bg-white border border-green-200 rounded-xl p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg shrink-0">
                  <IconFileText size={20} className="text-green-600" />
                </div>
                <div>
                  <p className="font-semibold text-slate-800">{parsedLog.fileName}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {parsedLog.totalEntries.toLocaleString()} log entries · failure window{" "}
                    <span className="font-mono">{parsedLog.windowFrom.replace("T", " ")}</span>
                    {" → "}
                    <span className="font-mono">{parsedLog.windowTo.replace("T", " ")}</span>
                    {" (UTC+local)"}
                  </p>
                </div>
              </div>
              <button
                onClick={clearLog}
                className="text-slate-400 hover:text-red-500 transition-colors p-1"
              >
                <IconTrash size={18} />
              </button>
            </div>

            {/* counts per type */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
              {TABS.map((tab) => (
                <div
                  key={tab.type}
                  className={`rounded-lg px-3 py-2 text-center border ${
                    counts[tab.type] > 0
                      ? "bg-red-50 border-red-200"
                      : "bg-slate-50 border-slate-200"
                  }`}
                >
                  <p
                    className={`text-2xl font-bold ${
                      counts[tab.type] > 0 ? "text-red-600" : "text-slate-400"
                    }`}
                  >
                    {counts[tab.type]}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">{tab.label}</p>
                </div>
              ))}
            </div>

            {/* abstract-status breakdown hint */}
            {parsedLog.abstractStatusBreakdown.acceptedPoster +
              parsedLog.abstractStatusBreakdown.acceptedOral +
              parsedLog.abstractStatusBreakdown.rejected >
              0 && (
              <div className="mt-3 p-2 bg-orange-50 border border-orange-200 rounded-lg flex items-start gap-2">
                <IconInfoCircle size={14} className="text-orange-500 shrink-0 mt-0.5" />
                <p className="text-xs text-orange-700">
                  Abstract status breakdown — accepted poster:{" "}
                  <strong>{parsedLog.abstractStatusBreakdown.acceptedPoster}</strong> · accepted
                  oral: <strong>{parsedLog.abstractStatusBreakdown.acceptedOral}</strong> ·
                  rejected: <strong>{parsedLog.abstractStatusBreakdown.rejected}</strong>{" "}
                  · ต้องระบุ Abstract IDs เองเนื่องจากตาราง abstracts ไม่มี updatedAt
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── Type tabs ── */}
        <div className="flex gap-2 flex-wrap">
          {TABS.map((tab) => (
            <button
              key={tab.type}
              onClick={() => {
                setSelectedType(tab.type);
                setResults(null);
                setSummary(null);
                setIsPreviewed(false);
                setSelected(new Set());
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedType === tab.type
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {tab.label}
              {counts[tab.type] > 0 && (
                <span
                  className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                    selectedType === tab.type ? "bg-blue-500 text-white" : "bg-red-100 text-red-600"
                  }`}
                >
                  {counts[tab.type]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Config bar ── */}
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex flex-wrap gap-4 items-end">
            <p className="text-sm text-slate-500 self-center flex-1">
              {TYPE_DESC[selectedType]}
            </p>

            <div className="flex flex-wrap gap-3 items-end">
              {selectedType === "payment" && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Order IDs{" "}
                    {parsedLog && (
                      <span className="text-green-600">(auto-filled จาก log)</span>
                    )}
                  </label>
                  <input
                    type="text"
                    value={orderIds}
                    onChange={(e) => setOrderIds(e.target.value)}
                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono w-72 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="207, 208, 213"
                  />
                </div>
              )}

              {(selectedType === "signup" ||
                selectedType === "abstract-submission" ||
                selectedType === "free-registration") && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      From {parsedLog && <span className="text-green-600">(auto-filled)</span>}
                    </label>
                    <input
                      type="datetime-local"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                      className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      To {parsedLog && <span className="text-green-600">(auto-filled)</span>}
                    </label>
                    <input
                      type="datetime-local"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                      className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                </>
              )}

              {selectedType === "free-registration" && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Registration IDs{" "}
                    {parsedLog && registrationIds ? (
                      <span className="text-green-600">(auto-filled จาก log)</span>
                    ) : (
                      <span className="text-slate-400">(optional, override date)</span>
                    )}
                  </label>
                  <input
                    type="text"
                    value={registrationIds}
                    onChange={(e) => setRegistrationIds(e.target.value)}
                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono w-72 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="42, 43, 47"
                  />
                </div>
              )}

              {selectedType === "abstract-status" && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Abstract IDs{" "}
                    {parsedLog && abstractIds ? (
                      <span className="text-green-600">(auto-filled จาก log)</span>
                    ) : (
                      <span className="text-slate-400">(ระบุเอง)</span>
                    )}
                  </label>
                  <input
                    type="text"
                    value={abstractIds}
                    onChange={(e) => setAbstractIds(e.target.value)}
                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono w-72 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="101, 102, 103"
                  />
                  {parsedLog && !abstractIds && (
                    <p className="text-xs text-orange-600 mt-1">
                      ⚠ ไม่พบ PATCH request ใน log — ต้องระบุ IDs เอง
                    </p>
                  )}
                </div>
              )}

              <button
                onClick={handlePreview}
                disabled={loading}
                className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                {loading ? (
                  <IconRefresh size={16} className="animate-spin" />
                ) : (
                  <IconEye size={16} />
                )}
                Preview
              </button>
            </div>
          </div>
        </div>

        {/* ── API result summary ── */}
        {summary && (
          <div className="grid grid-cols-4 gap-3">
            {[
              {
                label: isPreviewed ? "จะส่ง" : "ส่งแล้ว",
                value: isPreviewed ? summary.pending : summary.sent,
                cls: "text-blue-700",
              },
              { label: "สำเร็จ", value: summary.sent, cls: "text-green-700" },
              { label: "ข้าม", value: summary.skipped, cls: "text-yellow-700" },
              { label: "ล้มเหลว", value: summary.failed, cls: "text-red-700" },
            ].map((c) => (
              <div
                key={c.label}
                className="bg-white border border-slate-200 rounded-xl p-4 text-center"
              >
                <p className={`text-3xl font-bold ${c.cls}`}>{c.value}</p>
                <p className="text-xs text-slate-500 mt-1">{c.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── Empty / loading state ── */}
        {results === null && !loading && (
          <div className="bg-white border border-slate-200 rounded-xl py-14 text-center text-slate-400">
            <IconMailForward size={44} className="mx-auto mb-3 opacity-25" />
            <p className="text-sm">
              {parsedLog
                ? "กด Preview เพื่อดูรายชื่อผู้รับก่อนส่งจริง"
                : "Upload log file ก่อน หรือกรอกค่าด้วยตัวเองแล้วกด Preview"}
            </p>
          </div>
        )}

        {loading && (
          <div className="bg-white border border-slate-200 rounded-xl py-14 text-center text-slate-400">
            <IconRefresh size={36} className="mx-auto mb-3 animate-spin opacity-40" />
            <p className="text-sm">กำลังประมวลผล...</p>
          </div>
        )}

        {/* ── Results table ── */}
        {results && !loading && (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-semibold text-slate-700">
                {isPreviewed ? "Preview — เลือกรายการที่ต้องการส่ง" : "ผลการส่ง"}
              </h3>
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-400">{results.length} รายการทั้งหมด</span>
                {isPreviewed && someSelected && (
                  <button
                    onClick={handleSendSelected}
                    disabled={loading}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <IconSend size={15} />
                    ส่งที่เลือก ({selected.size})
                  </button>
                )}
              </div>
            </div>

            {results.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-sm">
                ไม่พบรายการในช่วงเวลาที่กำหนด
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide border-b border-slate-100">
                      {isPreviewed && (
                        <th className="px-4 py-3 w-10">
                          <input
                            type="checkbox"
                            checked={allSelected}
                            onChange={toggleAll}
                            className="accent-blue-600 w-4 h-4"
                            title="เลือกทั้งหมด"
                          />
                        </th>
                      )}
                      <th className="text-left px-4 py-3">ID</th>
                      <th className="text-left px-4 py-3">Email</th>
                      <th className="text-left px-4 py-3">ชื่อ</th>
                      <th className="text-left px-4 py-3">ประเภท Email</th>
                      <th className="text-left px-4 py-3">สถานะ</th>
                      <th className="text-left px-4 py-3">หมายเหตุ</th>
                      <th className="px-4 py-3 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {results.map((row, i) => {
                      const isSelectable = row.status === "pending";
                      const isChecked = selected.has(i);
                      return (
                        <tr
                          key={i}
                          onClick={() => isPreviewed && isSelectable && toggleRow(i)}
                          className={`transition-colors ${
                            isPreviewed && isSelectable ? "cursor-pointer" : ""
                          } ${isChecked ? "bg-blue-50 hover:bg-blue-50" : "hover:bg-slate-50"}`}
                        >
                          {isPreviewed && (
                            <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                              {isSelectable && (
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleRow(i)}
                                  className="accent-blue-600 w-4 h-4"
                                />
                              )}
                            </td>
                          )}
                          <td className="px-4 py-3 font-mono text-xs text-slate-400">{row.id}</td>
                          <td className="px-4 py-3 text-slate-800">{row.email}</td>
                          <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{row.name}</td>
                          <td className="px-4 py-3">
                            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full whitespace-nowrap">
                              {row.type}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={row.status} />
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-400">{row.reason ?? "—"}</td>
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            {row.preview && (
                              <button
                                onClick={() => setPreviewRow(row)}
                                title="ดูรายละเอียด email"
                                className="p-1.5 rounded-lg hover:bg-blue-100 text-slate-400 hover:text-blue-600 transition-colors"
                              >
                                <IconMail size={15} />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Email preview modal ── */}
      {previewRow && (
        <EmailPreviewModal
          result={previewRow}
          apiBase={API_BASE ?? ""}
          onClose={() => setPreviewRow(null)}
        />
      )}
    </AdminLayout>
  );
}
