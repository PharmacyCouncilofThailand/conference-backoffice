import type { WheelSegmentState } from '@/types/lucky-wheel';

type RateSegment = Pick<
  WheelSegmentState,
  'id' | 'kind' | 'enabled' | 'remaining'
> & { winPercent: number | null };

// Mirrors the API draw (conference-api lucky-wheel/policy.ts): a segment with
// winPercent keeps that share; the rest of 100% is split evenly across live
// segments without one. Returns the actual chance (0–100) per segment ID.
export function effectiveWinRates(
  segments: RateSegment[],
): Map<string, number> {
  const live = segments.filter(
    (segment) =>
      segment.enabled &&
      (segment.kind === 'no_prize' || (segment.remaining ?? 0) > 0),
  );
  const rates = new Map(segments.map((segment) => [segment.id, 0]));
  if (!live.some((segment) => segment.kind === 'prize')) return rates;

  const hundredths = live.map((segment) =>
    segment.winPercent == null ? null : Math.round(segment.winPercent * 100),
  );
  const hasFixed = hundredths.some((value) => value !== null);
  const fixedTotal = hundredths.reduce<number>(
    (sum, value) => sum + (value ?? 0),
    0,
  );
  const freeCount = hundredths.filter((value) => value === null).length;
  const leftover = Math.max(0, 10_000 - fixedTotal);
  const weights = hundredths.map((value) => {
    if (!hasFixed) return 1;
    if (freeCount === 0 || leftover === 0) return value ?? 0;
    return value === null ? leftover : value * freeCount;
  });
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  live.forEach((segment, index) => {
    rates.set(segment.id, total > 0 ? (weights[index] / total) * 100 : 0);
  });
  return rates;
}

export function parseWinPercent(
  value: string,
): { ok: true; value: number | null } | { ok: false } {
  const trimmed = value.trim();
  if (!trimmed) return { ok: true, value: null };
  const parsed = Number(trimmed);
  if (
    !Number.isFinite(parsed) ||
    parsed <= 0 ||
    parsed > 100 ||
    Math.abs(Math.round(parsed * 100) - parsed * 100) > 1e-6
  ) {
    return { ok: false };
  }
  return { ok: true, value: Math.round(parsed * 100) / 100 };
}
