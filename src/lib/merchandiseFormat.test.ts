import assert from 'node:assert/strict';
import test from 'node:test';
import {
  bangkokDateInputToday,
  bangkokInputToIso,
  formatBaht,
  formatBangkok,
  isoToBangkokInput,
  parseBahtInput,
  paymentStateLabel,
} from './merchandiseFormat';

test('formatBaht formats integer baht in Thai locale', () => {
  assert.equal(formatBaht(1250), '1,250 บาท');
  assert.equal(formatBaht(0), '0 บาท');
});

test('parseBahtInput handles commas, spaces, empty string, and invalid numbers', () => {
  assert.equal(parseBahtInput('1,250'), 1250);
  assert.equal(parseBahtInput(' 250 '), 250);
  assert.equal(parseBahtInput(''), null);
  assert.equal(parseBahtInput('   '), null);
  assert.equal(parseBahtInput('0'), 0);
  assert.equal(parseBahtInput('1000000'), 1000000);
  assert.equal(parseBahtInput('1,000,000'), 1000000);
  assert.equal(parseBahtInput('12.5'), 'invalid');
  assert.equal(parseBahtInput('-1'), 'invalid');
  assert.equal(parseBahtInput('1,000,001'), 'invalid');
  assert.equal(parseBahtInput('abc'), 'invalid');
});

test('Bangkok datetime conversions preserve Asia/Bangkok day and time', () => {
  assert.equal(
    bangkokInputToIso('2026-10-16T23:30'),
    '2026-10-16T23:30:00+07:00',
  );
  assert.equal(
    new Date(bangkokInputToIso('2026-10-16T23:30')).toISOString(),
    '2026-10-16T16:30:00.000Z',
  );
  assert.equal(
    isoToBangkokInput('2026-10-16T16:30:00.000Z'),
    '2026-10-16T23:30',
  );
  assert.equal(isoToBangkokInput(null), '');
  assert.throws(() => bangkokInputToIso('bad'));
  assert.match(bangkokDateInputToday(), /^\d{4}-\d{2}-\d{2}$/);
});

test('formatBangkok handles null and ISO timestamps', () => {
  assert.equal(formatBangkok(null), 'ยังไม่กำหนด');
  const formatted = formatBangkok('2026-10-16T07:30:00.000Z');
  assert.ok(formatted.includes('14:30'));
});

test('every PaymentState key has a non-empty paymentStateLabel', () => {
  const states = [
    'awaiting_qr',
    'qr_active',
    'verifying',
    'qr_expired_open',
    'qr_expired_closed',
    'check_failed',
    'review',
    'paid',
  ] as const;
  for (const state of states) {
    assert.ok(paymentStateLabel[state] && paymentStateLabel[state].length > 0);
  }
});
