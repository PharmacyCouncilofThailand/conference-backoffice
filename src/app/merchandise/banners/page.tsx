import { Suspense } from 'react';
import BannerManager from '@/components/merchandise/BannerManager';

export default function MerchandiseBannersRoute() {
  return (
    <Suspense fallback={<p>กำลังโหลด</p>}>
      <BannerManager />
    </Suspense>
  );
}
