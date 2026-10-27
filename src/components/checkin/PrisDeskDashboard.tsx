'use client';

import { useEffect, useState } from 'react';
import { IconAlertCircle, IconCalendarEvent, IconGift, IconRefresh } from '@tabler/icons-react';
import { api, type CheckinDeskSummary } from '@/lib/api';
import { holderTypeTone } from '@/lib/holder-type-colors';

const POLL_MS = 15000;
const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

function thaiDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${Number(m[3])} ${THAI_MONTHS[Number(m[2]) - 1] ?? ''} ${Number(m[1]) + 543}`;
}

const clamp = (n: number) => Math.max(0, Math.min(100, Number.isFinite(n) ? n : 0));

function Bar({ value, label, fill, height = 'h-3' }: { value: number; label: string; fill: string; height?: string }) {
  const v = clamp(value);
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(v)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={`w-full ${height} bg-zinc-100 rounded-full overflow-hidden`}
    >
      <div className={`h-full rounded-full transition-all duration-700 ${fill}`} style={{ width: `${v}%` }} />
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="กำลังโหลด">
      {[0, 1].map((i) => (
        <div key={i} className="card animate-pulse space-y-4">
          <div className="h-5 w-40 rounded bg-zinc-100" />
          <div className="h-4 rounded bg-zinc-100" />
          <div className="h-4 rounded bg-zinc-100" />
          <div className="h-4 rounded bg-zinc-100" />
          <div className="h-3 rounded-full bg-zinc-100" />
        </div>
      ))}
    </div>
  );
}

function GiftRow({ title, caption, given, eligible, percentage, fill }: {
  title: string; caption: string; given: number; eligible: number; percentage: number; fill: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-1.5">
        <span className="text-zinc-700 font-medium">{title}</span>
        <span className="text-sm font-medium text-zinc-600 tabular-nums">{percentage}%</span>
      </div>
      <p className="text-sm text-zinc-800 mb-2">
        แจกแล้ว <span className="font-bold text-lg tabular-nums">{given}</span>
        <span className="tabular-nums"> / {eligible}</span> คน
      </p>
      <Bar value={percentage} label={`${title} ${percentage}%`} fill={fill} height="h-2.5" />
      <p className="text-xs text-zinc-400 mt-1.5">{caption}</p>
    </div>
  );
}

export function PrisDeskDashboard({ token, eventId, refreshKey }: { token: string; eventId: number; refreshKey: number }) {
  const [data, setData] = useState<CheckinDeskSummary | null>(null);
  const [error, setError] = useState(false);
  const [retryTick, setRetryTick] = useState(0);
  const retry = () => setRetryTick((n) => n + 1);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const res = await api.checkins.deskSummary(token, eventId);
        if (cancelled) return;
        setData(res);
        setError(false);
      } catch {
        if (!cancelled) setError(true);
      }
    };
    void run();
    const t = setInterval(() => void run(), POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [token, eventId, refreshKey, retryTick]);

  if (!data) {
    return error ? (
      <div className="card">
        <ErrorLine onRetry={retry} />
      </div>
    ) : (
      <Skeleton />
    );
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <h3 className="text-lg font-semibold text-zinc-800 mb-4 flex items-center gap-2">
          <IconCalendarEvent size={20} className="text-emerald-600 shrink-0" />
          <span className="min-w-0">การเข้างานวันนี้</span>
          <span className="ml-auto text-sm font-normal text-zinc-500 tabular-nums whitespace-nowrap">
            {thaiDate(data.serverDate)}
          </span>
        </h3>
        {error && <ErrorLine onRetry={retry} />}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-zinc-500">Total Registered</span>
            <span className="text-2xl font-bold text-zinc-800 tabular-nums">{data.total}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-zinc-500">Checked In</span>
            <span className="text-2xl font-bold text-green-600 tabular-nums">{data.checkedIn}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-zinc-500">Remaining</span>
            <span className="text-2xl font-bold text-yellow-600 tabular-nums">{data.remaining}</span>
          </div>
          <div className="pt-2">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-zinc-400">Progress</span>
              <span className="text-2xl font-bold text-zinc-800 tabular-nums">{data.percentage}%</span>
            </div>
            <Bar value={data.percentage} label="ความคืบหน้าการเข้างานวันนี้" fill="bg-emerald-500" />
          </div>
          {data.byHolderType.length > 0 && (
            <ul className="space-y-3 pt-2 border-t border-zinc-100">
              {data.byHolderType.map((t) => {
                const tone = holderTypeTone(t.key);
                const label = t.label || 'ยังไม่ระบุ';
                return (
                  <li key={t.key ?? 'unassigned'} className="pt-3 first:pt-3">
                    <div className="flex items-start justify-between gap-3 mb-1.5">
                      <span className="flex items-start gap-2 min-w-0 text-sm text-zinc-700">
                        <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${tone.dot}`} aria-hidden="true" />
                        <span className="min-w-0 break-words">{label}</span>
                      </span>
                      <span className="shrink-0 text-right text-sm tabular-nums">
                        <span className="font-semibold text-zinc-800">{t.checkedIn} / {t.total}</span>
                        <span className="ml-2 text-zinc-500 inline-block min-w-[2.75rem]">{t.percentage}%</span>
                      </span>
                    </div>
                    <Bar value={t.percentage} label={`${label} เช็คอิน ${t.checkedIn} จาก ${t.total}`} fill={tone.bar} height="h-1.5" />
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <div className="card">
        <h3 className="text-lg font-semibold text-zinc-800 mb-4 flex items-center gap-2">
          <IconGift size={20} className="text-amber-500 shrink-0" />
          การแจกของ
        </h3>
        <div className="space-y-6">
          <GiftRow
            title="Gift"
            caption="นับเมื่อผู้มีสิทธิ์เช็คอินเข้างาน"
            given={data.gift.given}
            eligible={data.gift.eligible}
            percentage={data.gift.percentage}
            fill="bg-amber-400"
          />
          <GiftRow
            title="คูปองอาหาร"
            caption="คนละ 1 ใบ · นับเมื่อผู้มีสิทธิ์เช็คอินเข้างาน"
            given={data.mealCoupon.given}
            eligible={data.mealCoupon.eligible}
            percentage={data.mealCoupon.percentage}
            fill="bg-emerald-500"
          />
        </div>
      </div>
    </div>
  );
}

function ErrorLine({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="mb-4 flex items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
      <IconAlertCircle size={16} className="shrink-0" />
      <span className="min-w-0 flex-1">โหลดข้อมูลไม่สำเร็จ</span>
      <button type="button" onClick={onRetry} className="inline-flex items-center gap-1 font-medium underline">
        <IconRefresh size={14} />
        ลองใหม่
      </button>
    </div>
  );
}

export default PrisDeskDashboard;
