import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiError } from './api';
import { couponRegistrationFromError } from './boothCheckin';
test('duplicate eligibility accepts only authorized structured error data', () => {
  for (const eligible of [true, false, null])
    assert.equal(
      couponRegistrationFromError(
        new ApiError('duplicate', 409, 'ALREADY_CHECKED_IN', {
          registration: {
            firstName: 'A',
            lastName: 'B',
            booth: { mealCouponEligible: eligible },
          },
        }),
      )?.mealCouponEligible,
      eligible,
    );
  assert.equal(
    couponRegistrationFromError(
      new ApiError('denied', 403, 'SESSION_NOT_ASSIGNED', {
        registration: {
          firstName: 'A',
          lastName: 'B',
          booth: { mealCouponEligible: true },
        },
      }),
    ),
    null,
  );
  assert.equal(
    couponRegistrationFromError(
      new ApiError('duplicate', 409, 'ALREADY_CHECKED_IN', {
        registration: {
          firstName: 'A',
          lastName: 'B',
          booth: { mealCouponEligible: 'true' },
        },
      }),
    ),
    null,
  );
});
