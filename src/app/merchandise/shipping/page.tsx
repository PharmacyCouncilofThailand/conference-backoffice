'use client';

import { Suspense } from 'react';
import BulkShipping from '@/components/merchandise/BulkShipping';

export default function MerchandiseShippingPage() {
  return (
    <Suspense
      fallback={<div className="card text-sm text-zinc-500">กำลังโหลด...</div>}
    >
      <BulkShipping />
    </Suspense>
  );
}
