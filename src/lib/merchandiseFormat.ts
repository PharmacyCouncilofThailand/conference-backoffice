const bahtFormatter = new Intl.NumberFormat('th-TH', {
  maximumFractionDigits: 0,
});

const bangkokDisplayFormatter = new Intl.DateTimeFormat('th-TH', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Bangkok',
});

const bangkokPartsFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Bangkok',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export const MAX_BAHT = 1_000_000;

export function formatBaht(n: number): string {
  return `${bahtFormatter.format(Math.trunc(n))} บาท`;
}

export function parseBahtInput(raw: string): number | null | 'invalid' {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const cleaned = trimmed.replace(/,/g, '');
  if (!/^\d+$/.test(cleaned)) return 'invalid';
  const value = Number(cleaned);
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_BAHT) {
    return 'invalid';
  }
  return value;
}

export function formatBangkok(iso: string | null): string {
  if (!iso) return 'ยังไม่กำหนด';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'ยังไม่กำหนด';
  return bangkokDisplayFormatter.format(date);
}

export function bangkokInputToIso(value: string): string {
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(trimmed)) {
    throw new Error('รูปแบบวันเวลาไม่ถูกต้อง');
  }
  const iso = `${trimmed}:00+07:00`;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('รูปแบบวันเวลาไม่ถูกต้อง');
  }
  return iso;
}

export function isoToBangkokInput(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const parts = bangkokPartsFormatter.formatToParts(date);
  const byType = new Map(parts.map((p) => [p.type, p.value]));
  const year = byType.get('year');
  const month = byType.get('month');
  const day = byType.get('day');
  const hour = byType.get('hour');
  const minute = byType.get('minute');
  if (!year || !month || !day || !hour || !minute) return '';
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

export function bangkokDateInputToday(): string {
  return isoToBangkokInput(new Date().toISOString()).slice(0, 10);
}

export const storeStateLabel: Record<
  'disabled' | 'not_open' | 'open' | 'closed',
  string
> = {
  disabled: 'ปิดร้าน',
  not_open: 'ยังไม่เปิดพรีออเดอร์',
  open: 'เปิดรับพรีออเดอร์',
  closed: 'ปิดรับพรีออเดอร์แล้ว',
};

export const paymentStatusLabel: Record<
  'pending' | 'paid' | 'expired',
  string
> = {
  pending: 'รอชำระ',
  paid: 'ชำระแล้ว',
  expired: 'หมดเวลาชำระ',
};

export const shippingStatusLabel: Record<'not_shipped' | 'shipped', string> = {
  not_shipped: 'ยังไม่จัดส่ง',
  shipped: 'จัดส่งแล้ว',
};

export const paymentStateLabel: Record<
  | 'awaiting_qr'
  | 'qr_active'
  | 'verifying'
  | 'qr_expired_open'
  | 'qr_expired_closed'
  | 'check_failed'
  | 'review'
  | 'paid',
  string
> = {
  awaiting_qr: 'รอออก QR ชำระเงิน',
  qr_active: 'QR พร้อมชำระเงิน',
  verifying: 'กำลังตรวจสอบยอดหลัง QR หมดอายุ',
  qr_expired_open: 'QR หมดอายุ (ขอใบใหม่ได้)',
  qr_expired_closed: 'หมดเวลาชำระเงิน',
  check_failed: 'ตรวจสอบยอดล่าสุดไม่สำเร็จ',
  review: 'รอเจ้าหน้าที่ตรวจสอบ',
  paid: 'ชำระแล้ว',
};

export const attemptStatusLabel: Record<string, string> = {
  creating: 'กำลังสร้าง QR',
  active: 'QR ใช้งานได้',
  create_failed: 'สร้าง QR ไม่สำเร็จ',
  create_unknown: 'ไม่ทราบผลการสร้าง QR',
  expired: 'QR หมดอายุ',
  paid: 'ชำระแล้ว',
};

export const notificationStatusLabel: Record<string, string> = {
  queued: 'รอส่ง',
  sending: 'กำลังส่ง',
  sent: 'ส่งแล้ว',
  failed: 'ส่งไม่สำเร็จ',
  unknown: 'ไม่ทราบผล',
};

export const notificationTypeLabel: Record<'paid' | 'shipped', string> = {
  paid: 'ชำระสำเร็จ',
  shipped: 'จัดส่งแล้ว',
};

export const reviewReasonLabel: Record<string, string> = {
  duplicate_payment: 'ชำระซ้ำ',
  amount_mismatch: 'ยอดไม่ตรงกับออเดอร์',
  merchant_mismatch: 'merchant ไม่ตรง',
  currency_mismatch: 'สกุลเงินไม่ตรง',
  test_status_in_production: 'รายการทดสอบบนระบบจริง',
};

export const publishIssueLabel: Record<string, string> = {
  NAME_REQUIRED: 'ต้องมีชื่อ',
  IMAGE_REQUIRED: 'ต้องมีรูปอย่างน้อย 1 รูป',
  ENABLED_VARIANT_REQUIRED: 'ต้องเปิดขายอย่างน้อย 1 ตัวเลือก',
  VARIANT_PRICE_REQUIRED: 'ทุกตัวเลือกที่เปิดขายต้องมีราคา',
  VARIANT_SHAPE_MIXED: 'ตัวเลือกปนแบบมี/ไม่มีไซซ์สี',
  BUNDLE_PRICE_REQUIRED: 'ต้องตั้งราคาชุด',
  COMPONENT_REQUIRED: 'ต้องมีส่วนประกอบ',
  COMPONENT_NOT_SINGLE: 'ส่วนประกอบต้องเป็นสินค้าเดี่ยว',
  FIXED_VARIANT_INVALID: 'ตัวเลือกตายตัวไม่ถูกต้อง',
  ALLOWED_VARIANTS_REQUIRED: 'ต้องเลือกตัวเลือกที่ลูกค้าเลือกได้',
};

export const unavailableLabel: Record<string, string> = {
  STORE_NOT_OPEN: 'ร้านยังไม่เปิด',
  PRODUCT_DISABLED: 'สินค้าปิดขาย',
  VARIANT_DISABLED: 'ตัวเลือกปิดขาย',
  COMPONENT_UNAVAILABLE: 'ส่วนประกอบซื้อไม่ได้',
};

export function badgeClassForStore(
  state: 'disabled' | 'not_open' | 'open' | 'closed',
): string {
  switch (state) {
    case 'disabled':
      return 'badge badge-error';
    case 'not_open':
      return 'badge badge-warning';
    case 'open':
      return 'badge badge-success';
    case 'closed':
      return 'badge badge-info';
  }
}

export function badgeClassForPayment(
  status: 'pending' | 'paid' | 'expired',
): string {
  switch (status) {
    case 'pending':
      return 'badge badge-warning';
    case 'paid':
      return 'badge badge-success';
    case 'expired':
      return 'badge badge-error';
  }
}

export function badgeClassForShipping(
  status: 'not_shipped' | 'shipped',
): string {
  return status === 'shipped' ? 'badge badge-success' : 'badge badge-warning';
}
