'use client';

import { useEffect, useMemo, useState } from 'react';
import { IconLoader2 } from '@tabler/icons-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { effectiveWinRates, parseWinPercent } from '@/lib/luckyWheelWinRates';
import type { WheelSegmentState } from '@/types/lucky-wheel';

type Props = {
  token: string;
  eventId: number;
  segments: WheelSegmentState[];
  onDone: () => Promise<void> | void;
};

function formatRate(value: number) {
  return `${value.toLocaleString('th-TH', { maximumFractionDigits: 2 })}%`;
}

function savedText(segment: WheelSegmentState) {
  return segment.winPercent == null ? '' : String(segment.winPercent);
}

export function WinRateSettings({ token, eventId, segments, onDone }: Props) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [reason, setReason] = useState('');
  const [requestKey, setRequestKey] = useState(() => crypto.randomUUID());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setDrafts(
      Object.fromEntries(
        segments.map((segment) => [segment.id, savedText(segment)]),
      ),
    );
  }, [segments]);

  const parsed = useMemo(
    () =>
      segments.map((segment) => ({
        segment,
        result: parseWinPercent(drafts[segment.id] ?? savedText(segment)),
      })),
    [segments, drafts],
  );
  const invalidIds = new Set(
    parsed.filter(({ result }) => !result.ok).map(({ segment }) => segment.id),
  );
  const changed = parsed.filter(
    ({ segment, result }) =>
      result.ok && result.value !== (segment.winPercent ?? null),
  );
  const preview = useMemo(
    () =>
      effectiveWinRates(
        parsed.map(({ segment, result }) => ({
          ...segment,
          winPercent: result.ok ? result.value : (segment.winPercent ?? null),
        })),
      ),
    [parsed],
  );
  const live = segments.filter(
    (segment) =>
      segment.enabled &&
      (segment.kind === 'no_prize' || (segment.remaining ?? 0) > 0),
  );
  const fixedTotal = parsed
    .filter(({ segment }) => live.includes(segment))
    .reduce(
      (sum, { result }) => sum + (result.ok && result.value ? result.value : 0),
      0,
    );
  const blankLive = parsed.filter(
    ({ segment, result }) =>
      live.includes(segment) && result.ok && result.value === null,
  ).length;

  const save = async () => {
    if (invalidIds.size > 0) {
      toast.error('กรอก % ระหว่าง 0.01–100 หรือเว้นว่าง');
      return;
    }
    if (changed.length === 0) return;
    if (!reason.trim()) {
      toast.error('กรอกเหตุผลก่อนบันทึก');
      return;
    }
    setSubmitting(true);
    try {
      await api.luckyWheel.setWinPercents(token, eventId, {
        segments: changed.map(({ segment, result }) => ({
          segmentId: segment.id,
          winPercent: result.ok ? result.value : null,
        })),
        reason: reason.trim(),
        idempotencyKey: requestKey,
      });
      toast.success('บันทึกโอกาสออกรางวัลแล้ว');
      setReason('');
      setRequestKey(crypto.randomUUID());
      await onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ');
    } finally {
      setSubmitting(false);
    }
  };

  const statusLabel = (segment: WheelSegmentState) =>
    !segment.enabled
      ? 'ปิดใช้งาน'
      : segment.kind === 'prize' && (segment.remaining ?? 0) <= 0
        ? 'หมดแล้ว'
        : 'สุ่มได้';

  return (
    <div className="card border border-zinc-200/80">
      <div className="mb-5 flex flex-col gap-2 border-b border-zinc-100 pb-5">
        <h2 className="text-xl font-semibold tracking-tight text-zinc-950 sm:text-2xl">
          โอกาสออกรางวัล
        </h2>
        <p className="max-w-3xl text-sm leading-6 text-zinc-600">
          กรอก % ให้ช่องที่ต้องการกำหนดเอง ช่องที่เว้นว่างจะแบ่ง % ที่เหลือเท่าๆ กัน
          ถ้ารวมกันเกิน 100% ระบบจะคิดเป็นสัดส่วน และช่องที่เว้นว่างจะไม่ออกเลย
          ช่องที่ปิดหรือของหมดจะไม่ถูกสุ่ม
        </p>
      </div>

      {fixedTotal >= 100 && blankLive > 0 && (
        <p
          role="status"
          className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900"
        >
          % ที่กำหนดรวม {formatRate(fixedTotal)} แล้ว ช่องที่เว้นว่าง {blankLive}{' '}
          ช่องจะไม่มีโอกาสออก
        </p>
      )}

      <div className="divide-y divide-zinc-100">
        <div className="hidden grid-cols-[1fr_110px_150px_120px] gap-4 pb-3 text-sm text-zinc-500 md:grid">
          <span>ช่อง</span>
          <span>สถานะ</span>
          <span>กำหนด %</span>
          <span className="text-right">โอกาสจริง</span>
        </div>
        {segments.map((segment) => {
          const inputId = `win-percent-${segment.id}`;
          const invalid = invalidIds.has(segment.id);
          return (
            <div
              key={segment.id}
              className="grid grid-cols-[1fr_96px] items-center gap-x-4 gap-y-2 py-3 md:grid-cols-[1fr_110px_150px_120px]"
            >
              <label htmlFor={inputId} className="min-w-0">
                <span className="block break-words font-medium text-zinc-900">
                  {segment.name.th}
                </span>
                <span className="block text-xs text-zinc-500">
                  {segment.kind === 'prize'
                    ? `คงเหลือ ${segment.remaining ?? 0}`
                    : 'ไม่ได้รางวัล'}
                </span>
              </label>
              <span className="justify-self-end text-xs text-zinc-600 md:justify-self-start md:text-sm">
                {statusLabel(segment)}
              </span>
              <div className="relative">
                <input
                  id={inputId}
                  className={`input-field pr-8 tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${invalid ? 'border-rose-400' : ''}`}
                  type="number"
                  inputMode="decimal"
                  min={0.01}
                  max={100}
                  step={0.01}
                  placeholder="อัตโนมัติ"
                  aria-invalid={invalid}
                  value={drafts[segment.id] ?? ''}
                  onChange={(event) =>
                    setDrafts((current) => ({
                      ...current,
                      [segment.id]: event.target.value,
                    }))
                  }
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">
                  %
                </span>
              </div>
              <span className="justify-self-end text-lg font-semibold tabular-nums text-zinc-950">
                {formatRate(preview.get(segment.id) ?? 0)}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex flex-col gap-3 border-t border-zinc-100 pt-5 sm:flex-row sm:items-end">
        <label className="block flex-1 text-sm font-medium text-zinc-700">
          เหตุผล
          <input
            className="input-field mt-1"
            value={reason}
            maxLength={500}
            onChange={(event) => setReason(event.target.value)}
            placeholder="เช่น เพิ่มโอกาสออกปากกาและสมุด"
          />
        </label>
        <button
          type="button"
          className="btn-primary min-h-11"
          onClick={() => void save()}
          disabled={submitting || changed.length === 0}
        >
          {submitting && <IconLoader2 size={17} className="animate-spin" />}
          บันทึกโอกาสออก{changed.length > 0 ? ` (${changed.length})` : ''}
        </button>
      </div>
    </div>
  );
}
