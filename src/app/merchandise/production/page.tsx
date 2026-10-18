'use client';

import { Suspense } from 'react';
import ProductionReport from '@/components/merchandise/ProductionReport';

export default function MerchandiseProductionPage() {
  return (
    <Suspense
      fallback={<div className="card text-sm text-zinc-500">กำลังโหลด...</div>}
    >
      <ProductionReport />
    </Suspense>
  );
}
