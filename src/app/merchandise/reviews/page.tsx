'use client';

import { Suspense } from 'react';
import PaymentReviews from '@/components/merchandise/PaymentReviews';

export default function MerchandiseReviewsPage() {
  return (
    <Suspense
      fallback={<div className="card text-sm text-zinc-500">กำลังโหลด...</div>}
    >
      <PaymentReviews />
    </Suspense>
  );
}
