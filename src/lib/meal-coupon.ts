// PRIS meal coupon: 1 per day for Booth members within their Booth quota.
// Booth members past the quota still have a ticket but no coupon.

export type MealCouponStatus = 'eligible' | 'over_quota' | null;

export const MEAL_COUPON_ELIGIBLE_LABEL = 'วันละ 1 ใบ';
export const MEAL_COUPON_OVER_QUOTA_LABEL = 'เกินโควตา';

interface CouponSource {
  mealCouponStatus?: MealCouponStatus;
  mealCouponEligible?: boolean | null;
  booth?: { mealCouponEligible: boolean | null } | null;
}

/** Status from the API, falling back to older fields if it is missing. */
export function mealCouponStatusOf(row: CouponSource): MealCouponStatus {
  if (row.mealCouponStatus !== undefined) return row.mealCouponStatus;
  const eligible = row.mealCouponEligible ?? row.booth?.mealCouponEligible;
  if (eligible === true) return 'eligible';
  return row.booth?.mealCouponEligible === false ? 'over_quota' : null;
}

/** Text for exports: label, or empty when there is no coupon. */
export function mealCouponExportText(row: CouponSource): string {
  const status = mealCouponStatusOf(row);
  if (status === 'eligible') return MEAL_COUPON_ELIGIBLE_LABEL;
  if (status === 'over_quota') return MEAL_COUPON_OVER_QUOTA_LABEL;
  return '';
}
