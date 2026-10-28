import {
  MEAL_COUPON_ELIGIBLE_LABEL,
  MEAL_COUPON_OVER_QUOTA_LABEL,
  type MealCouponStatus,
} from '@/lib/meal-coupon';

/** Meal coupon pill: green when eligible, grey when past the Booth quota, "-" otherwise. */
export function MealCouponBadge({
  status,
  size = 'sm',
}: {
  status: MealCouponStatus;
  size?: 'sm' | 'lg';
}) {
  const base =
    size === 'lg'
      ? 'inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold sm:text-base'
      : 'inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium';
  if (status === 'eligible')
    return (
      <span className={`${base} border-emerald-300 bg-emerald-50 text-emerald-800`}>
        {MEAL_COUPON_ELIGIBLE_LABEL}
      </span>
    );
  if (status === 'over_quota')
    return (
      <span
        className={`${base} border-zinc-300 bg-zinc-100 text-zinc-600`}
        title="สมาชิกบูธที่เกินโควตาคูปองของบูธ"
      >
        {MEAL_COUPON_OVER_QUOTA_LABEL}
      </span>
    );
  return <span className={size === 'lg' ? 'text-base text-zinc-400' : 'text-sm text-zinc-400'}>-</span>;
}
