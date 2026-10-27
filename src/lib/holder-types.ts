// PRIS-2026 holder types. The list and gift labels come from the API
// catalog; only the review reasons are described here.

export type HolderGiftCode = 'gift' | 'none';

export interface HolderTypeOption {
  key: string;
  label: string;
  giftCode: HolderGiftCode;
  giftLabel: string;
}

export interface HolderTypeHistoryEntry {
  id: number;
  previousType: string | null;
  newType: string | null;
  previousSource: string | null;
  newSource: string;
  reason: string | null;
  createdAt: string;
  actorFirstName: string | null;
  actorLastName: string | null;
}

const REVIEW_REASONS: Record<string, string> = {
  'vip-code': 'ใช้ PRISVIP2026 ต้องเลือก VIP หรือกรรมการ',
  'has-abstract': 'มีบทคัดย่อ ต้องเลือกผู้นำเสนอหรือผู้เข้าร่วม',
  'no-matching-rule': 'ไม่มี Promo Code ที่ใช้ตัดสินได้',
  'unknown-promo': 'Promo Code นี้ไม่มีกฎจัดประเภท',
  'promo-other-event': 'Promo Code ไม่ใช่ของงานนี้',
  'promo-ticket-mismatch': 'Promo Code ไม่ตรงกับ Ticket',
  'owner-changed': 'เปลี่ยนเจ้าของทะเบียน ต้องเลือกใหม่',
};

/** Thai explanation for a `review:v1:<reason>` source, or null. */
export function holderReviewReason(source?: string | null): string | null {
  if (!source?.startsWith('review:')) return null;
  const reason = source.split(':').slice(2).join(':');
  return REVIEW_REASONS[reason] ?? 'รอแอดมินตรวจ';
}

/** Short Thai label for where the current holder type came from. */
export function holderSourceLabel(source?: string | null): string {
  if (!source) return 'ยังไม่จัดประเภท';
  if (source.startsWith('auto:')) return 'ระบบอัตโนมัติ';
  if (source.startsWith('review:')) return 'รอตรวจ';
  if (source.startsWith('manual:')) return 'แอดมินกำหนด';
  if (source.startsWith('excel:')) return 'นำเข้าจาก Excel';
  return source;
}
