import { Suspense } from 'react';
import OverviewPage from '@/components/merchandise/OverviewPage';

export default function MerchandiseOverviewRoute() {
  return (
    <Suspense fallback={<p>กำลังโหลด</p>}>
      <OverviewPage />
    </Suspense>
  );
}
