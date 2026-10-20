'use client';

import { createContext, useContext } from 'react';
import type { AdminStoreDto } from '@/types/merchandise';

export interface MerchandiseContextValue {
  eventId: number;
  eventCode: string;
  eventName: string;
  token: string;
  store: AdminStoreDto | null;
  reloadStore(): Promise<void>;
  openReviews: number;
  reloadReviews(): Promise<void>;
}

export const MerchandiseContext = createContext<MerchandiseContextValue | null>(
  null,
);

export function useMerchandise(): MerchandiseContextValue {
  const ctx = useContext(MerchandiseContext);
  if (!ctx) {
    throw new Error('useMerchandise must be used inside MerchandiseShell');
  }
  return ctx;
}

export function merchHref(
  path: string,
  eventId: number,
  extra?: Record<string, string>,
): string {
  const params = new URLSearchParams();
  if (eventId > 0) {
    params.set('eventId', String(eventId));
  }
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      if (v !== '') {
        params.set(k, v);
      }
    }
  }
  const q = params.toString();
  return q ? `${path}?${q}` : path;
}

export const MERCH_TABS: readonly (readonly [string, string])[] = [
  ['/merchandise', 'ภาพรวม'],
  ['/merchandise/store', 'ตั้งค่าร้าน'],
  ['/merchandise/products', 'สินค้า'],
  ['/merchandise/categories', 'หมวดสินค้า'],
  ['/merchandise/banners', 'แบนเนอร์'],
  ['/merchandise/preview', 'ดูตัวอย่าง'],
  ['/merchandise/orders', 'คำสั่งซื้อ'],
  ['/merchandise/shipping', 'จัดส่ง'],
  ['/merchandise/reviews', 'รอตรวจสอบ'],
  ['/merchandise/production', 'ยอดผลิต'],
] as const;
