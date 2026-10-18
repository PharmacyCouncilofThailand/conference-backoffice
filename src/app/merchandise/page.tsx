import { Suspense } from 'react';

export default function MerchandiseOverviewRoute() {
  return (
    <Suspense fallback={<p>กำลังโหลด</p>}>
      <div className="card">ภาพรวม</div>
    </Suspense>
  );
}
