import assert from 'node:assert/strict';
import test from 'node:test';
import { holderReviewReason, holderSourceLabel } from './holder-types';

test('review sources explain why an admin must decide', () => {
  assert.equal(holderReviewReason('review:v1:vip-code'), 'ใช้ PRISVIP2026 ต้องเลือก VIP หรือกรรมการ');
  assert.equal(holderReviewReason('review:v1:has-abstract'), 'มีบทคัดย่อ ต้องเลือกผู้นำเสนอหรือผู้เข้าร่วม');
  assert.equal(holderReviewReason('review:v2:new-reason'), 'รอแอดมินตรวจ');
  for (const source of [null, undefined, '', 'auto:v1:promo-MODPRIS2026', 'manual:admin:1', 'excel:abc'])
    assert.equal(holderReviewReason(source), null);
});

test('source labels distinguish auto, admin, review and Excel', () => {
  assert.equal(holderSourceLabel('auto:v1:paid-no-promo-no-abstract'), 'ระบบอัตโนมัติ');
  assert.equal(holderSourceLabel('manual:admin:7'), 'แอดมินกำหนด');
  assert.equal(holderSourceLabel('review:v1:owner-changed'), 'รอตรวจ');
  assert.equal(holderSourceLabel('excel:abc'), 'นำเข้าจาก Excel');
  assert.equal(holderSourceLabel(null), 'ยังไม่จัดประเภท');
});
