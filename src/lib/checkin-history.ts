// Formatting + export helpers for the PRIS daily check-in history view.

export const PRIS_EVENT_CODE = 'PRIS-2026';
export { MEAL_COUPON_ELIGIBLE_LABEL as MEAL_COUPON_LABEL } from './meal-coupon';
import { mealCouponExportText, type MealCouponStatus } from './meal-coupon';

const TZ = 'Asia/Bangkok';

/** "2026-10-29" -> "29 ต.ค. 2569" (calendar date, no timezone shift). */
export function formatThaiShortDate(ymd: string | null | undefined): string {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd || '-';
  return new Date(`${ymd}T00:00:00Z`).toLocaleDateString('th-TH', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** "29 ต.ค." for the quick day buttons. */
export function formatThaiDayMonth(ymd: string): string {
  return new Date(`${ymd}T00:00:00Z`).toLocaleDateString('th-TH', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
  });
}

/** Asia/Bangkok HH:mm. */
export function formatBangkokTime(iso: string | null | undefined): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleTimeString('en-GB', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/** Asia/Bangkok "YYYY-MM-DD HH:mm:ss". */
export function formatBangkokStamp(iso: string | null | undefined): string {
  if (!iso) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const hour = get('hour') === '24' ? '00' : get('hour');
  return `${get('year')}-${get('month')}-${get('day')} ${hour}:${get('minute')}:${get('second')}`;
}

/** Event day list from first..last (inclusive, YYYY-MM-DD). Capped for safety. */
export function listEventDays(first: string, last: string): string[] {
  const days: string[] = [];
  const cur = new Date(`${first}T00:00:00Z`);
  const end = new Date(`${last}T00:00:00Z`);
  if (Number.isNaN(cur.getTime()) || Number.isNaN(end.getTime())) return [first];
  while (cur <= end && days.length < 14) {
    days.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return days;
}

interface PrisExportSource {
  regCode: string;
  firstName: string;
  lastName: string;
  email: string;
  ticketName?: string | null;
  holderTypeLabel?: string | null;
  holderGift?: string | null;
  booth?: { mealCouponEligible: boolean | null } | null;
  mealCouponEligible?: boolean | null;
  mealCouponStatus?: MealCouponStatus;
  attendanceDate?: string | null;
  scannedAt: string;
  scannedBy: { firstName: string | null; lastName: string | null } | null;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
}

export function toPrisExportRow(row: PrisExportSource) {
  return {
    'Reg Code': row.regCode,
    ชื่อ: row.firstName,
    นามสกุล: row.lastName,
    Email: row.email,
    Ticket: row.ticketName ?? '',
    'Ticket Type': row.holderTypeLabel || 'ยังไม่ระบุ',
    Gift: row.holderGift === 'ให้' ? 'ให้' : '',
    คูปองอาหาร: mealCouponExportText(row),
    วันที่เข้างาน: row.attendanceDate ?? '',
    'เวลาสแกน': formatBangkokStamp(row.scannedAt),
    ผู้สแกน: row.scannedBy
      ? `${row.scannedBy.firstName ?? ''} ${row.scannedBy.lastName ?? ''}`.trim()
      : '',
    สถานะ: row.cancelledAt ? 'ยกเลิก' : 'เข้างาน',
    เหตุผลยกเลิก: row.cancellationReason ?? '',
  };
}
