import { Suspense } from 'react';
import StoreSettingsForm from '@/components/merchandise/StoreSettingsForm';

export default function MerchandiseStoreRoute() {
  return (
    <Suspense fallback={<p>กำลังโหลด</p>}>
      <StoreSettingsForm />
    </Suspense>
  );
}
