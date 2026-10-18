import { Suspense } from 'react';
import CategoryManager from '@/components/merchandise/CategoryManager';

export default function MerchandiseCategoriesRoute() {
  return (
    <Suspense fallback={<p>กำลังโหลด</p>}>
      <CategoryManager />
    </Suspense>
  );
}
