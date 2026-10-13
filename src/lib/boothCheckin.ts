import { ApiError } from './api';
export function couponRegistrationFromError(
  error: unknown,
): { name: string; mealCouponEligible: boolean | null } | null {
  if (
    !(error instanceof ApiError) ||
    error.code !== 'ALREADY_CHECKED_IN' ||
    !error.details ||
    typeof error.details !== 'object' ||
    !('registration' in error.details)
  )
    return null;
  const r = error.details.registration;
  if (
    !r ||
    typeof r !== 'object' ||
    !('firstName' in r) ||
    typeof r.firstName !== 'string' ||
    !('lastName' in r) ||
    typeof r.lastName !== 'string' ||
    !('booth' in r)
  )
    return null;
  if (r.booth === null)
    return { name: `${r.firstName} ${r.lastName}`, mealCouponEligible: null };
  if (
    !r.booth ||
    typeof r.booth !== 'object' ||
    !('mealCouponEligible' in r.booth)
  )
    return null;
  const x = r.booth.mealCouponEligible;
  if (x !== null && typeof x !== 'boolean') return null;
  return { name: `${r.firstName} ${r.lastName}`, mealCouponEligible: x };
}
