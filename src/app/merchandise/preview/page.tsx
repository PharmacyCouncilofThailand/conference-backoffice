import { Suspense } from 'react';
import StorePreview from '@/components/merchandise/StorePreview';

export default function MerchandisePreviewRoute() {
  return (
    <Suspense fallback={<p>กำลังโหลด</p>}>
      <StorePreview />
    </Suspense>
  );
}
