'use client';

import { useEffect, useRef } from 'react';
import { IconAlertTriangle, IconCheck, IconSparkles, IconX } from '@tabler/icons-react';
import { holderTypeTone } from '@/lib/holder-type-colors';
import { mealCouponStatusOf, type MealCouponStatus } from '@/lib/meal-coupon';
import { MealCouponBadge } from '@/components/checkin/MealCouponBadge';

export interface DeskRegistration {
  firstName: string;
  lastName: string;
  regCode: string;
  ticketName?: string | null;
  booth?: { mealCouponEligible: boolean | null } | null;
  /** Booth quota or VIP (from the API). */
  mealCouponEligible?: boolean | null;
  mealCouponStatus?: MealCouponStatus;
  holderType?: string | null;
  holderTypeLabel?: string | null;
  holderGift?: string | null;
  holderGiftCode?: 'gift' | 'none' | null;
}

export interface DeskResult {
  status: 'success' | 'duplicate' | 'error';
  message: string;
  code: string;
  registration?: DeskRegistration;
  /** HH:mm (Asia/Bangkok) of the first scan today, for duplicates. */
  checkedInTime?: string | null;
}

const HEADER = {
  success: {
    wrap: 'bg-emerald-50 text-emerald-800',
    icon: 'bg-emerald-600',
    title: 'เช็คอินสำเร็จ',
  },
  duplicate: {
    wrap: 'bg-amber-50 text-amber-900',
    icon: 'bg-amber-500',
    title: 'วันนี้เช็คอินแล้ว',
  },
  error: { wrap: 'bg-red-50 text-red-800', icon: 'bg-red-600', title: '' },
} as const;

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-zinc-500">
        {label}
      </p>
      {children}
    </div>
  );
}

const pill =
  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold sm:text-base';

export function PrisScanResultModal({
  result,
  onNext,
}: {
  result: DeskResult;
  onNext: () => void;
}) {
  const nextRef = useRef<HTMLButtonElement>(null);
  const h = HEADER[result.status];
  const reg = result.registration;

  useEffect(() => {
    nextRef.current?.focus();
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onNext();
    } else if (e.key === 'Tab') {
      // Focus trap: the Next button is the only control.
      e.preventDefault();
      nextRef.current?.focus();
    }
  };

  const isVip = reg?.holderType === 'vip';
  const tone = holderTypeTone(reg?.holderType);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4"
      onKeyDown={onKeyDown}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pris-result-title"
        className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className={`flex items-center gap-3 px-5 py-4 ${h.wrap}`}>
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white ${h.icon}`}
          >
            {result.status === 'success' ? (
              <IconCheck size={24} />
            ) : result.status === 'duplicate' ? (
              <IconAlertTriangle size={24} />
            ) : (
              <IconX size={24} />
            )}
          </span>
          <div className="min-w-0">
            <h2 id="pris-result-title" className="text-xl font-bold">
              {result.status === 'error' ? result.message : h.title}
            </h2>
            {result.status === 'duplicate' && result.checkedInTime && (
              <p className="text-sm">เช็คอินครั้งแรกเวลา {result.checkedInTime} น.</p>
            )}
          </div>
        </div>

        {reg ? (
          <div className="space-y-5 px-5 py-6">
            <div>
              <p className="break-words text-3xl font-bold leading-tight text-zinc-900">
                {reg.firstName} {reg.lastName}
              </p>
              <p className="mt-1 font-mono text-base text-zinc-500">
                {reg.regCode}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-4">
              <Field label="Ticket">
                <span className={`${pill} border-zinc-200 bg-zinc-50 text-zinc-700`}>
                  {reg.ticketName || '-'}
                </span>
              </Field>
              <Field label="Ticket type">
                {reg.holderTypeLabel ? (
                  <span className={`${pill} ${tone.badge}`}>
                    {isVip && <IconSparkles size={16} />}
                    {reg.holderTypeLabel}
                  </span>
                ) : (
                  <span className={`${pill} border-zinc-200 bg-zinc-50 text-zinc-500`}>
                    ยังไม่ระบุ
                  </span>
                )}
              </Field>
              <Field label="Gift">
                {reg.holderGiftCode === 'gift' ? (
                  <span
                    className={`${pill} border-amber-300 bg-gradient-to-br from-amber-100 via-yellow-50 to-amber-200 text-amber-950`}
                  >
                    <IconSparkles size={16} />
                    ให้
                  </span>
                ) : (
                  <span className="text-base text-zinc-400">-</span>
                )}
              </Field>
              <Field label="คูปองอาหาร">
                <MealCouponBadge status={mealCouponStatusOf(reg)} size="lg" />
              </Field>
            </div>
          </div>
        ) : (
          result.status !== 'error' && (
            <p className="px-5 py-6 font-mono text-lg">{result.code}</p>
          )
        )}
        {!reg && result.status === 'error' && (
          <p className="px-5 pt-5 font-mono text-sm text-zinc-500">{result.code}</p>
        )}

        <div className="px-5 pb-5 pt-2">
          <button
            ref={nextRef}
            type="button"
            onClick={onNext}
            className="w-full rounded-xl bg-emerald-700 py-4 text-xl font-bold text-white transition-colors hover:bg-emerald-800 focus:outline-none focus:ring-4 focus:ring-emerald-300"
          >
            ถัดไป
          </button>
        </div>
      </div>
    </div>
  );
}
