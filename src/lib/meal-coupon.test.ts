import assert from 'node:assert/strict';
import test from 'node:test';
import { mealCouponExportText, mealCouponStatusOf } from './meal-coupon';

test('meal coupon status prefers the API value', () => {
  assert.equal(mealCouponStatusOf({ mealCouponStatus: 'over_quota', mealCouponEligible: true }), 'over_quota');
  assert.equal(mealCouponStatusOf({ mealCouponStatus: null, booth: { mealCouponEligible: true } }), null);
});

test('older API fields still resolve', () => {
  assert.equal(mealCouponStatusOf({ mealCouponEligible: true }), 'eligible');
  assert.equal(mealCouponStatusOf({ booth: { mealCouponEligible: true } }), 'eligible');
  assert.equal(mealCouponStatusOf({ booth: { mealCouponEligible: false } }), 'over_quota');
  assert.equal(mealCouponStatusOf({ booth: { mealCouponEligible: null } }), null);
  assert.equal(mealCouponStatusOf({}), null);
});

test('export text', () => {
  assert.equal(mealCouponExportText({ mealCouponStatus: 'eligible' }), 'วันละ 1 ใบ');
  assert.equal(mealCouponExportText({ mealCouponStatus: 'over_quota' }), 'เกินโควตา');
  assert.equal(mealCouponExportText({ mealCouponStatus: null }), '');
});
